import { Redis } from "ioredis";
import { env } from "@/shared/env";

const g = globalThis as unknown as { __redis?: Redis };

/** Koneksi umum (get/set/pub). BullMQ butuh maxRetriesPerRequest=null. */
export function redis(): Redis {
  return (g.__redis ??= new Redis(env().REDIS_URL, { maxRetriesPerRequest: null }));
}

/** Koneksi baru khusus subscribe / BullMQ worker. */
export function newRedis(): Redis {
  return new Redis(env().REDIS_URL, { maxRetriesPerRequest: null });
}

export const keys = {
  qr: (sessionId: string) => `wa:qr:${sessionId}`,
  sendClaim: (sessionId: string) => `wa:claim:${sessionId}`,
  dayCount: (sessionId: string, day: string) => `wa:cnt:d:${sessionId}:${day}`,
  hourCount: (sessionId: string, hour: string) => `wa:cnt:h:${sessionId}:${hour}`,
  commands: "wa:commands",
} as const;
