// WORKER-ONLY: pengaman bersama untuk semua jalur kirim (broadcast & API).
import type { WASocket } from "@whiskeysockets/baileys";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/shared/db";
import { keys, redis } from "@/shared/redis";
import { phoneToJid } from "@/shared/phone";
import { waSessions } from "@/modules/wa-sessions/schema";
import { rand } from "@/modules/broadcast/limits";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RECENT_TTL = 24 * 3600;
const EXISTS_TTL = 7 * 24 * 3600;

/** Sudah dikirimi dari sesi ini dalam 24 jam terakhir? */
export const wasRecentlyMessaged = async (sessionId: string, phone: string) => (await redis().exists(keys.recent(sessionId, phone))) === 1;

/**
 * Cek nomor terdaftar di WhatsApp, hasil di-cache 7 hari supaya satu nomor tidak
 * dicek berulang (query onWhatsApp massal adalah sinyal spam bagi WA).
 * Mengembalikan null jika pengecekan gagal (jaringan) — pemanggil memutuskan.
 */
export async function existsOnWhatsApp(sock: WASocket, phone: string): Promise<boolean | null> {
  const k = keys.exists(phone);
  const cached = await redis().get(k);
  if (cached !== null) return cached === "1";
  try {
    const res = (await sock.onWhatsApp(phoneToJid(phone)))?.[0];
    const ok = !!res?.exists;
    await redis().set(k, ok ? "1" : "0", "EX", EXISTS_TTL);
    return ok;
  } catch {
    return null;
  }
}

/** Simulasi mengetik proporsional panjang teks, dengan batas atas. */
export async function humanTyping(sock: WASocket, jid: string, text: string, maxMs = 9000) {
  try {
    await sock.sendPresenceUpdate("composing", jid);
    await sleep(Math.min(maxMs, 700 + text.length * 35 + rand(300, 1500)));
    await sock.sendPresenceUpdate("paused", jid);
  } catch {
    /* presence gagal bukan alasan membatalkan kirim */
  }
}

/** Dipanggil SETELAH pesan terkirim: counter harian/jam, penanda recent, mulai warm-up. */
export async function afterSend(sessionId: string, phone: string, dayKey: string, hourKey?: string) {
  const r = redis();
  const m = r.multi().incr(keys.dayCount(sessionId, dayKey)).expire(keys.dayCount(sessionId, dayKey), 172_800);
  if (hourKey) m.incr(keys.hourCount(sessionId, hourKey)).expire(keys.hourCount(sessionId, hourKey), 7200);
  m.set(keys.recent(sessionId, phone), "1", "EX", RECENT_TTL);
  await m.exec();
  // warm-up dihitung sejak pesan keluar PERTAMA dari nomor ini (apa pun jalurnya)
  await db()
    .update(waSessions)
    .set({ warmupStartedAt: new Date() })
    .where(and(eq(waSessions.id, sessionId), isNull(waSessions.warmupStartedAt)))
    .catch(() => undefined);
}
