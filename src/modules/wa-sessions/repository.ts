import { and, desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/shared/db";
import { waSessions } from "./schema";
import { users } from "@/modules/users/schema";

const scope = (id: string | undefined, owner?: string): SQL | undefined => {
  const parts = [id ? eq(waSessions.id, id) : undefined, owner ? eq(waSessions.ownerId, owner) : undefined].filter(Boolean) as SQL[];
  return parts.length ? and(...parts) : undefined;
};

/** 1 query, owner di-join (hindari N+1 saat menampilkan nama pemilik). */
export const listSessions = (owner?: string) =>
  db()
    .select({
      id: waSessions.id,
      name: waSessions.name,
      phone: waSessions.phone,
      status: waSessions.status,
      lastConnectedAt: waSessions.lastConnectedAt,
      warmupStartedAt: waSessions.warmupStartedAt,
      ownerName: users.name,
    })
    .from(waSessions)
    .innerJoin(users, eq(users.id, waSessions.ownerId))
    .where(scope(undefined, owner))
    .orderBy(desc(waSessions.createdAt));

export const getSession = async (id: string, owner?: string) =>
  (await db().select().from(waSessions).where(scope(id, owner)).limit(1))[0];

export const insertSession = async (ownerId: string, name: string) =>
  (await db().insert(waSessions).values({ ownerId, name }).returning())[0]!;

export const deleteSession = (id: string) => db().delete(waSessions).where(eq(waSessions.id, id));
