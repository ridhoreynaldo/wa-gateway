import { Queue } from "bullmq";
import { redis } from "@/shared/redis";

export const QUEUES = { broadcast: "broadcast", direct: "direct" } as const;

const g = globalThis as unknown as { __queues?: Map<string, Queue> };

export function queue(name: (typeof QUEUES)[keyof typeof QUEUES]): Queue {
  const m = (g.__queues ??= new Map());
  let q = m.get(name);
  if (!q) {
    q = new Queue(name, {
      connection: redis(),
      defaultJobOptions: { removeOnComplete: true, removeOnFail: 200 },
    });
    m.set(name, q);
  }
  return q;
}
