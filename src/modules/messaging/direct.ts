import { queue, QUEUES } from "@/shared/queue";
import { logOutgoing } from "./repository";

export type DirectJob = { sessionId: string; phone: string; text: string; messageId: number };

/** Sisi WEB: antrikan pesan tunggal (API). Dicatat 'queued' dulu supaya klien dapat id untuk dilacak. */
export async function enqueueDirect(sessionId: string, phone: string, text: string) {
  const m = await logOutgoing({ sessionId, phone, body: text, status: "queued" });
  await queue(QUEUES.direct).add("send", { sessionId, phone, text, messageId: m.id } satisfies DirectJob, {
    attempts: 3,
    backoff: { type: "exponential", delay: 15_000 },
  });
  return m.id;
}
