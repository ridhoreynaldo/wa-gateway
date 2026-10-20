// WORKER-ONLY: jangan diimpor dari kode web (menarik Baileys).
import { DelayedError, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { keys, redis } from "@/shared/redis";
import { phoneToJid } from "@/shared/phone";
import { getSocket } from "@/modules/wa-sessions/runtime/manager";
import { localParts, rand } from "@/modules/broadcast/limits";
import { messages } from "./schema";
import type { DirectJob } from "./direct";

const API_DAILY_CAP = 500;

/** Pesan API berbagi jeda per-nomor yang sama dengan broadcast (3–8 dtk) + batas harian. */
export async function processDirect(job: Job<DirectJob>, token?: string): Promise<void> {
  const { sessionId, phone, text, messageId } = job.data;
  const r = redis();
  const dayK = keys.dayCount(sessionId, localParts().dayKey);
  if (Number((await r.get(dayK)) ?? 0) >= API_DAILY_CAP) throw new Error("Batas harian nomor tercapai");

  const gap = Math.round(rand(3, 8) * 1000);
  if (!(await r.set(keys.sendClaim(sessionId), "1", "PX", gap, "NX"))) {
    const ttl = Math.max(await r.pttl(keys.sendClaim(sessionId)), 1000);
    await job.moveToDelayed(Date.now() + ttl + rand(200, 1500), token);
    throw new DelayedError();
  }
  const sock = getSocket(sessionId);
  if (!sock) throw new Error("Nomor WhatsApp tidak tersambung");
  const jid = phoneToJid(phone);
  const check = (await sock.onWhatsApp(jid))?.[0];
  if (!check?.exists) {
    await db().update(messages).set({ status: "failed", error: "Nomor tidak terdaftar di WhatsApp" }).where(eq(messages.id, messageId));
    return; // tidak di-retry
  }
  await sock.sendPresenceUpdate("composing", jid);
  await new Promise((res) => setTimeout(res, Math.min(6000, 600 + text.length * 30 + rand(200, 1000))));
  const sent = await sock.sendMessage(jid, { text });
  await r.multi().incr(dayK).expire(dayK, 172_800).exec();
  await db().update(messages).set({ status: "sent", waMessageId: sent?.key.id ?? null }).where(eq(messages.id, messageId));
}

export async function markDirectFailed(messageId: number, error: string) {
  await db().update(messages).set({ status: "failed", error: error.slice(0, 300) }).where(eq(messages.id, messageId));
}
