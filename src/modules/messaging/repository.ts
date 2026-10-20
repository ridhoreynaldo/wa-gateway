import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { messages } from "./schema";

type Status = (typeof messages.$inferSelect)["status"];

export const logOutgoing = async (v: { sessionId: string; phone: string; body: string; waMessageId?: string; campaignId?: string; status?: Status; error?: string }) =>
  (await db().insert(messages).values({ direction: "out", status: "sent", ...v }).returning({ id: messages.id }))[0]!;

export const logIncoming = (v: { sessionId: string; phone: string; body: string; waMessageId?: string }) =>
  db().insert(messages).values({ direction: "in", status: "delivered", ...v });

/** Update status ack (delivered/read) — hanya naik, tidak turun. */
export async function bumpStatus(waMessageId: string, status: Extract<Status, "delivered" | "read">) {
  const allowed: Status[] = status === "read" ? ["sent", "delivered"] : ["sent"];
  await db()
    .update(messages)
    .set({ status })
    .where(and(eq(messages.waMessageId, waMessageId), eq(messages.direction, "out"), inArray(messages.status, allowed)));
}

export const recentMessages = (sessionId: string, limit = 50) =>
  db().select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(desc(messages.createdAt)).limit(limit);

export const todayStats = (sessionIds: string[], since: Date) =>
  sessionIds.length
    ? db()
        .select({
          direction: messages.direction,
          status: messages.status,
          n: sql<number>`count(*)::int`,
        })
        .from(messages)
        .where(and(inArray(messages.sessionId, sessionIds), sql`${messages.createdAt} >= ${since}`))
        .groupBy(messages.direction, messages.status)
    : Promise.resolve([]);
