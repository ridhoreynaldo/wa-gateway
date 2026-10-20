"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/shared/action";
import { AppError, notFound } from "@/shared/errors";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { audit } from "@/modules/audit/service";
import { getSession } from "@/modules/wa-sessions/repository";
import { getList } from "@/modules/lists/repository";
import { createCampaign, deleteCampaign, getCampaign, transition } from "./repository";
import { scheduleTick } from "./scheduler";

const uuid = z.string().uuid();
const int = (min: number, max: number) => z.coerce.number().int().min(min).max(max);

// Batas keras di server: user tidak bisa menyetel di bawah angka aman, apapun yang dikirim form.
const createInput = z
  .object({
    name: z.string().trim().min(2).max(100),
    sessionId: uuid,
    listId: uuid,
    template: z.string().trim().min(1).max(4000),
    minDelaySec: int(15, 600),
    maxDelaySec: int(20, 900),
    hourlyLimit: int(1, 60),
    dailyLimit: int(1, 300),
    batchSize: int(5, 50),
    batchPauseMinSec: int(60, 1800),
    batchPauseMaxSec: int(90, 3600),
    windowStartHour: int(0, 23),
    windowEndHour: int(1, 24),
  })
  .refine((v) => v.maxDelaySec >= v.minDelaySec, "Delay maksimal harus ≥ minimal")
  .refine((v) => v.batchPauseMaxSec >= v.batchPauseMinSec, "Jeda batch maksimal harus ≥ minimal")
  .refine((v) => v.windowEndHour > v.windowStartHour, "Jam selesai harus setelah jam mulai");

export const createCampaignAction = action(async (form: FormData) => {
  const me = await requirePermission("broadcast:manage");
  const { listId, ...data } = createInput.parse(Object.fromEntries(form));
  const scope = ownerScope(me);
  const [session, list] = await Promise.all([getSession(data.sessionId, scope), getList(listId, scope)]);
  if (!session || !list) throw notFound();
  const c = await createCampaign({ ...data, ownerId: session.ownerId }, listId);
  if (c.total === 0) throw new AppError("List kosong atau semua nomor ada di blacklist");
  await audit(me.id, "campaign.create", c.id, { total: c.total });
  redirect(`/broadcasts/${c.id}`);
});

async function mine(id: string) {
  const me = await requirePermission("broadcast:manage");
  const row = await getCampaign(id, ownerScope(me));
  if (!row) throw notFound();
  return { me, c: row.c };
}

export const startCampaignAction = action(async (form: FormData) => {
  const { me, c } = await mine(uuid.parse(form.get("id")));
  const ok = await transition(c.id, "running", ["draft", "paused"], {
    pauseReason: null,
    consecutiveFailures: 0,
    startedAt: c.startedAt ?? new Date(),
  });
  if (ok) {
    await scheduleTick(c.id, 2000);
    await audit(me.id, "campaign.start", c.id);
  }
  revalidatePath(`/broadcasts/${c.id}`);
});

export const pauseCampaignAction = action(async (form: FormData) => {
  const { me, c } = await mine(uuid.parse(form.get("id")));
  if (await transition(c.id, "paused", ["running"], { pauseReason: "Dijeda manual" })) await audit(me.id, "campaign.pause", c.id);
  revalidatePath(`/broadcasts/${c.id}`);
});

export const cancelCampaignAction = action(async (form: FormData) => {
  const { me, c } = await mine(uuid.parse(form.get("id")));
  if (await transition(c.id, "cancelled", ["draft", "running", "paused"], { finishedAt: new Date() })) await audit(me.id, "campaign.cancel", c.id);
  revalidatePath(`/broadcasts/${c.id}`);
});

export const deleteCampaignAction = action(async (form: FormData) => {
  const { me, c } = await mine(uuid.parse(form.get("id")));
  if (c.status === "running") throw new AppError("Jeda atau batalkan campaign sebelum menghapus");
  await deleteCampaign(c.id);
  await audit(me.id, "campaign.delete", c.id);
  redirect("/broadcasts");
});
