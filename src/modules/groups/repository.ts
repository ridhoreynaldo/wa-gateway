import { and, asc, eq, ilike, sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { waGroupParticipants, waGroups } from "./schema";

export type GroupInput = {
  jid: string;
  subject: string;
  participants: { jid: string; phone: string | null; isAdmin: boolean }[];
};

/** Ganti seluruh snapshot grup sebuah sesi dalam 1 transaksi (bulk insert, bukan per baris). */
export async function replaceGroups(sessionId: string, groups: GroupInput[]) {
  await db().transaction(async (tx) => {
    await tx.delete(waGroups).where(eq(waGroups.sessionId, sessionId)); // cascade → participants
    for (let i = 0; i < groups.length; i += 200) {
      await tx.insert(waGroups).values(
        groups.slice(i, i + 200).map((g) => ({ sessionId, jid: g.jid, subject: g.subject, size: g.participants.length })),
      );
    }
    const parts = groups.flatMap((g) =>
      g.participants.map((p) => ({ sessionId, groupJid: g.jid, jid: p.jid, phone: p.phone, isAdmin: p.isAdmin })),
    );
    for (let i = 0; i < parts.length; i += 2000) {
      await tx.insert(waGroupParticipants).values(parts.slice(i, i + 2000)).onConflictDoNothing();
    }
  });
}

export const listGroups = (sessionId: string, q?: string) =>
  db()
    .select({ jid: waGroups.jid, subject: waGroups.subject, size: waGroups.size })
    .from(waGroups)
    .where(and(eq(waGroups.sessionId, sessionId), q ? ilike(waGroups.subject, `%${q.replace(/[%_]/g, "")}%`) : undefined))
    .orderBy(asc(waGroups.subject));

export const listParticipants = (sessionId: string, groupJid: string) =>
  db()
    .select({ jid: waGroupParticipants.jid, phone: waGroupParticipants.phone, isAdmin: waGroupParticipants.isAdmin })
    .from(waGroupParticipants)
    .where(and(eq(waGroupParticipants.sessionId, sessionId), eq(waGroupParticipants.groupJid, groupJid)))
    .orderBy(sql`${waGroupParticipants.isAdmin} desc`, asc(waGroupParticipants.phone));
