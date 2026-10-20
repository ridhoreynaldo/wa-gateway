import { queue, QUEUES } from "@/shared/queue";

/**
 * Setiap campaign berjalan sebagai "rantai" job delayed: tick → kirim 1 pesan → jadwalkan tick berikutnya.
 * Rantai ini disimpan di Redis (BullMQ) sehingga selamat dari restart worker.
 */
export const scheduleTick = (campaignId: string, delayMs = 0) =>
  queue(QUEUES.broadcast).add("tick", { campaignId }, { delay: Math.max(0, Math.round(delayMs)) });
