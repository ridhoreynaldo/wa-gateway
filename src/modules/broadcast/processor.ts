import type { Job } from "bullmq";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { keys, redis } from "@/shared/redis";
import { logger } from "@/shared/logger";
import { phoneToJid } from "@/shared/phone";
import { waSessions } from "@/modules/wa-sessions/schema";
import { getSocket } from "@/modules/wa-sessions/runtime/manager";
import { blacklist } from "@/modules/lists/schema";
import { logOutgoing } from "@/modules/messaging/repository";
import { afterSend, existsOnWhatsApp, humanTyping, wasRecentlyMessaged } from "@/modules/messaging/safety.worker";
import { campaignRecipients, campaigns } from "./schema";
import { inWindow, localParts, msUntilNextHour, msUntilWindow, rand, warmupLimit } from "./limits";
import { renderTemplate } from "./template";
import { scheduleTick } from "./scheduler";

const MAX_CONSECUTIVE_FAILURES = 5;

/** Satu tick = paling banyak SATU pesan terkirim. Semua aturan keamanan dicek di sini. */
export async function processTick(job: Job<{ campaignId: string }>): Promise<void> {
  const { campaignId } = job.data;
  const log = logger.child({ campaign: campaignId });
  const lockKey = `wa:lock:camp:${campaignId}`;

  // cegah dua tick campaign yang sama berjalan bersamaan
  if (!(await redis().set(lockKey, "1", "PX", 120_000, "NX"))) return;
  try {
    const [row] = await db()
      .select({ c: campaigns, s: waSessions })
      .from(campaigns)
      .innerJoin(waSessions, eq(waSessions.id, campaigns.sessionId))
      .where(eq(campaigns.id, campaignId))
      .limit(1);
    if (!row || row.c.status !== "running") return; // dijeda/dibatalkan → rantai berhenti
    const { c, s } = row;
    const r = redis();

    // 1) nomor harus tersambung
    const sock = getSocket(s.id);
    if (s.status !== "connected" || !sock) {
      await scheduleTick(c.id, rand(20_000, 40_000));
      return;
    }

    // 2) jam kirim
    const now = localParts();
    if (!inWindow(now.hour, c.windowStartHour, c.windowEndHour)) {
      await scheduleTick(c.id, msUntilWindow(now.hour, now.minute, c.windowStartHour));
      return;
    }

    // 3) batas harian (termasuk warm-up) & per jam — counter di Redis (O(1)), dishare semua campaign/API di sesi yang sama
    const dayK = keys.dayCount(s.id, now.dayKey);
    const hourK = keys.hourCount(s.id, now.hourKey);
    const [dayN, hourN] = (await r.mget(dayK, hourK)).map((v) => Number(v ?? 0)) as [number, number];
    const dailyCap = Math.min(c.dailyLimit, warmupLimit(s.warmupStartedAt));
    if (dayN >= dailyCap) {
      log.info({ dayN, dailyCap }, "batas harian tercapai, lanjut besok");
      await scheduleTick(c.id, msUntilWindow(now.hour, now.minute, c.windowStartHour));
      return;
    }
    if (hourN >= c.hourlyLimit) {
      await scheduleTick(c.id, msUntilNextHour(now.minute));
      return;
    }

    // 4) jeda antar pesan per NOMOR: klaim atomik. Gagal klaim = ada pesan lain baru terkirim dari nomor ini.
    //    Ukuran batch diacak ±25% supaya pola "istirahat tiap N pesan" tidak kaku.
    const batchTarget = Math.max(3, Math.round(c.batchSize * rand(0.75, 1.25)));
    const batchEnd = c.batchProgress + 1 >= batchTarget;
    const gapMs = batchEnd ? rand(c.batchPauseMinSec, c.batchPauseMaxSec) * 1000 : rand(c.minDelaySec, c.maxDelaySec) * 1000;
    const claimK = keys.sendClaim(s.id);
    if (!(await r.set(claimK, "1", "PX", Math.round(gapMs), "NX"))) {
      const ttl = await r.pttl(claimK);
      await scheduleTick(c.id, Math.max(ttl, 1000) + rand(500, 3000));
      return;
    }

    // 5) ambil penerima berikutnya (index scan: campaign_id,status,id)
    const [rec] = await db()
      .select()
      .from(campaignRecipients)
      .where(and(eq(campaignRecipients.campaignId, c.id), eq(campaignRecipients.status, "pending")))
      .orderBy(campaignRecipients.id)
      .limit(1);
    if (!rec) {
      await r.del(claimK);
      await db().update(campaigns).set({ status: "completed", finishedAt: new Date() }).where(and(eq(campaigns.id, c.id), eq(campaigns.status, "running")));
      log.info("campaign selesai");
      return;
    }

    const skip = async (reason: string) => {
      await r.del(claimK); // tidak ada pesan terkirim → jeda tidak perlu
      await db().update(campaignRecipients).set({ status: "skipped", error: reason }).where(eq(campaignRecipients.id, rec.id));
      const [u] = await db()
        .update(campaigns)
        .set({ skippedCount: sql`${campaigns.skippedCount} + 1` })
        .where(eq(campaigns.id, c.id))
        .returning({ done: sql<boolean>`${campaigns.sentCount} + ${campaigns.failedCount} + ${campaigns.skippedCount} >= ${campaigns.total}` });
      await scheduleTick(c.id, u?.done ? 0 : rand(1500, 4000));
    };

    // 6) opt-out? (lookup pk)
    const [bl] = await db().select({ p: blacklist.phone }).from(blacklist).where(and(eq(blacklist.ownerId, c.ownerId), eq(blacklist.phone, rec.phone))).limit(1);
    if (bl) return skip("opt-out");

    // 7) sudah dikirimi dari nomor ini <24 jam (campaign lain / API)? → jangan dobel
    if (await wasRecentlyMessaged(s.id, rec.phone)) return skip("sudah dikirimi <24 jam");

    // 8) nomor terdaftar di WhatsApp? (hasil di-cache 7 hari)
    const exists = await existsOnWhatsApp(sock, rec.phone);
    if (exists === false) return skip("tidak terdaftar di WhatsApp");
    if (exists === null) log.warn({ phone: rec.phone }, "onWhatsApp gagal, lanjut kirim");

    // 9) kirim dengan simulasi mengetik
    const jid = phoneToJid(rec.phone);
    const text = renderTemplate(c.template, { ...rec.vars, name: rec.name ?? rec.vars.name ?? "" });
    try {
      await humanTyping(sock, jid, text);
      const sent = await sock.sendMessage(jid, { text });

      await afterSend(s.id, rec.phone, now.dayKey, now.hourKey);
      await db().update(campaignRecipients).set({ status: "sent", sentAt: new Date(), error: null }).where(eq(campaignRecipients.id, rec.id));
      await logOutgoing({ sessionId: s.id, phone: rec.phone, body: text, waMessageId: sent?.key.id ?? undefined, campaignId: c.id });

      const [u] = await db()
        .update(campaigns)
        .set({
          sentCount: sql`${campaigns.sentCount} + 1`,
          consecutiveFailures: 0,
          batchProgress: batchEnd ? 0 : sql`${campaigns.batchProgress} + 1`,
        })
        .where(eq(campaigns.id, c.id))
        .returning({ done: sql<boolean>`${campaigns.sentCount} + ${campaigns.failedCount} + ${campaigns.skippedCount} >= ${campaigns.total}` });
      if (u?.done) {
        await db().update(campaigns).set({ status: "completed", finishedAt: new Date() }).where(eq(campaigns.id, c.id));
        log.info("campaign selesai");
        return;
      }
      await scheduleTick(c.id, gapMs);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      log.warn({ phone: rec.phone, err: msg }, "kirim gagal");
      await db().update(campaignRecipients).set({ status: "failed", error: msg.slice(0, 300) }).where(eq(campaignRecipients.id, rec.id));
      const [u] = await db()
        .update(campaigns)
        .set({ failedCount: sql`${campaigns.failedCount} + 1`, consecutiveFailures: sql`${campaigns.consecutiveFailures} + 1` })
        .where(eq(campaigns.id, c.id))
        .returning({ cf: campaigns.consecutiveFailures });
      if ((u?.cf ?? 0) >= MAX_CONSECUTIVE_FAILURES) {
        // proteksi akun: berhenti otomatis kalau gagal beruntun
        await db()
          .update(campaigns)
          .set({ status: "paused", pauseReason: `Auto-pause: ${MAX_CONSECUTIVE_FAILURES} kegagalan beruntun (${msg.slice(0, 100)})` })
          .where(eq(campaigns.id, c.id));
        return;
      }
      await scheduleTick(c.id, gapMs);
    }
  } finally {
    await redis().del(lockKey);
  }
}
