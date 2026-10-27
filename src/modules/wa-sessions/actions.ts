"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { action } from "@/shared/action";
import { notFound } from "@/shared/errors";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { audit } from "@/modules/audit/service";
import { deleteSession, getSession, insertSession } from "./repository";
import { sendCommand } from "./commands";

const id = (f: FormData) => z.string().uuid().parse(f.get("id"));

async function mine(sessionId: string) {
  const me = await requirePermission("session:manage");
  const s = await getSession(sessionId, ownerScope(me));
  if (!s) throw notFound();
  return { me, s };
}

export const createSessionAction = action(async (form: FormData) => {
  const me = await requirePermission("session:manage");
  const name = z.string().trim().min(2).max(60).parse(form.get("name"));
  const s = await insertSession(me.id, name);
  await sendCommand({ type: "start", sessionId: s.id });
  await audit(me.id, "wa.create", s.id, { name });
  revalidatePath("/sessions");
});

export const connectSessionAction = action(async (form: FormData) => {
  const { me, s } = await mine(id(form));
  await sendCommand({ type: "start", sessionId: s.id });
  await audit(me.id, "wa.connect", s.id);
});

export const disconnectSessionAction = action(async (form: FormData) => {
  const { me, s } = await mine(id(form));
  await sendCommand({ type: "stop", sessionId: s.id });
  await audit(me.id, "wa.disconnect", s.id);
  revalidatePath("/sessions");
});

export const resyncSessionAction = action(async (form: FormData) => {
  const { me, s } = await mine(id(form));
  await sendCommand({ type: "resync", sessionId: s.id });
  await audit(me.id, "wa.resync", s.id);
});

export const logoutSessionAction = action(async (form: FormData) => {
  const { me, s } = await mine(id(form));
  await sendCommand({ type: "logout", sessionId: s.id });
  await audit(me.id, "wa.logout", s.id);
  revalidatePath("/sessions");
});

export const deleteSessionAction = action(async (form: FormData) => {
  const { me, s } = await mine(id(form));
  await sendCommand({ type: "logout", sessionId: s.id });
  await deleteSession(s.id);
  await audit(me.id, "wa.delete", s.id, { name: s.name });
  revalidatePath("/sessions");
});
