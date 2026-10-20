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
  /** Klaim jeda antar pesan per nomor pengirim (SET NX PX). */
  sendClaim: (sessionId: string) => `wa:claim:${sessionId}`,
  dayCount: (sessionId: string, day: string) => `wa:cnt:d:${sessionId}:${day}`,
  hourCount: (sessionId: string, hour: string) => `wa:cnt:h:${sessionId}:${hour}`,
  /** Nomor tujuan yang baru dikirimi dari sesi ini (anti dobel dalam 24 jam). */
  recent: (sessionId: string, phone: string) => `wa:recent:${sessionId}:${phone}`,
  /** Cache hasil onWhatsApp per nomor tujuan (7 hari). */
  exists: (phone: string) => `wa:exists:${phone}`,
  /** Lock kepemilikan sesi oleh satu instance worker. */
  owner: (sessionId: string) => `wa:owner:${sessionId}`,
  commands: "wa:commands",
  heartbeat: "wa:worker:heartbeat",
} as const;
