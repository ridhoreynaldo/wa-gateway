import { Worker } from "bullmq";
import { z } from "zod";
import { logger } from "@/shared/logger";
import { newRedis, redis, keys } from "@/shared/redis";
import { QUEUES } from "@/shared/queue";
import { bootSessions, logoutSession, resetSession, resync, shutdownAll, startSession, stopSession } from "@/modules/wa-sessions/runtime/manager";
import { processTick } from "@/modules/broadcast/processor";
import { markDirectFailed, processDirect } from "@/modules/messaging/direct.worker";

const cmdSchema = z.object({ type: z.enum(["start", "stop", "logout", "resync", "reset"]), sessionId: z.string().uuid() });

async function main() {
  const conn = newRedis();

  // Perintah dari web (scan QR, disconnect, dst.)
  const sub = newRedis();
  await sub.subscribe(keys.commands);
  sub.on("message", (_ch, raw) => {
    try {
      const cmd = cmdSchema.parse(JSON.parse(raw));
      logger.info(cmd, "command");
      const run = { start: startSession, stop: stopSession, logout: logoutSession, resync, reset: resetSession }[cmd.type];
      void run(cmd.sessionId).catch((e) => logger.error(e, "command gagal"));
    } catch (e) {
      logger.warn(e, "command tidak valid");
    }
  });

  const broadcast = new Worker(QUEUES.broadcast, (job) => processTick(job), { connection: conn, concurrency: 10 });
  const direct = new Worker(QUEUES.direct, (job, token) => processDirect(job, token), { connection: newRedis(), concurrency: 5 });

  broadcast.on("failed", (job, err) => logger.error({ job: job?.id, err: err.message }, "tick gagal"));
  direct.on("failed", (job, err) => {
    logger.warn({ job: job?.id, err: err.message }, "pesan API gagal");
    if (job && job.attemptsMade >= (job.opts.attempts ?? 1)) void markDirectFailed(job.data.messageId, err.message);
  });

  await bootSessions();

  const beat = setInterval(() => void redis().set("wa:worker:heartbeat", Date.now(), "EX", 60), 15_000);
  logger.info("worker siap");

  const stop = async () => {
    logger.info("shutdown…");
    clearInterval(beat);
    await Promise.allSettled([broadcast.close(), direct.close()]);
    await shutdownAll();
    process.exit(0);
  };
  process.on("SIGTERM", () => void stop());
  process.on("SIGINT", () => void stop());
}

process.on("unhandledRejection", (e) => logger.error(e, "unhandledRejection"));
main().catch((e) => {
  logger.fatal(e, "worker gagal start");
  process.exit(1);
});
