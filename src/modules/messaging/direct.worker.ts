// WORKER-ONLY: jangan diimpor dari kode web (menarik Baileys).
import { DelayedError, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { keys, redis } from "@/shared/redis";
import { phoneToJid } from "@/shared/phone";
import { getSocket } from "@/modules/wa-sessions/runtime/manager";
import { waSessions } from "@/modules/wa-sessions/schema";
import { localParts, rand, warmupLimit } from "@/modules/broadcast/limits";
import { afterSend, existsOnWhatsApp, humanTyping } from "@/modules/messaging/safety.worker";
import { messages } from "./schema";
import type { DirectJob } from "./direct";

/** Batas keras pesan API per nomor per hari; nomor baru tetap dibatasi warm-up. */
const API_DAILY_CAP = 500;

const fail = (messageId: number, error: string) =>
  db().update(messages).set({ status: "failed", error: error.slice(0, 300) }).where(eq(messages.id, messageId));

/** Pesan API berbagi counter harian & jeda per-nomor dengan broadcast. */
export async function processDirect(job: Job<DirectJob>, token?: string): Promise<void> {
  const { sessionId, phone, text, messageId } = job.data;
  const r = redis();
  const now = localParts();

  const [s] = await db().select({ warmupStartedAt: waSessions.warmupStartedAt, status: waSessions.status }).from(waSessions).where(eq(waSessions.id, sessionId)).limit(1);
  if (!s) {
    await fail(messageId, "Sesi tidak ditemukan");
    return;
  }
  const cap = Math.min(API_DAILY_CAP, warmupLimit(s.warmupStartedAt));
  if (Number((await r.get(keys.dayCount(sessionId, now.dayKey))) ?? 0) >= cap) {
    throw new Error(`Batas harian nomor tercapai (${cap}/hari)`); // retry dengan backoff
  }

  // jeda per nomor 3–8 dtk (transaksional); kalau sedang dipakai broadcast, tunda tanpa menghabiskan attempt
  const gap = Math.round(rand(3, 8) * 1000);
  if (!(await r.set(keys.sendClaim(sessionId), "1", "PX", gap, "NX"))) {
    const ttl = Math.max(await r.pttl(keys.sendClaim(sessionId)), 1000);
    await job.moveToDelayed(Date.now() + ttl + rand(200, 1500), token);
    throw new DelayedError();
  }

  const sock = getSocket(sessionId);
  if (!sock || s.status !== "connected") throw new Error("Nomor WhatsApp tidak tersambung");

  const exists = await existsOnWhatsApp(sock, phone);
  if (exists === false) {
    await fail(messageId, "Nomor tidak terdaftar di WhatsApp");
    return; // tidak di-retry
  }

  const jid = phoneToJid(phone);
  await humanTyping(sock, jid, text, 6000);
  const sent = await sock.sendMessage(jid, { text });
  await afterSend(sessionId, phone, now.dayKey, now.hourKey);
  await db().update(messages).set({ status: "sent", waMessageId: sent?.key.id ?? null }).where(eq(messages.id, messageId));
}

export const markDirectFailed = fail;
