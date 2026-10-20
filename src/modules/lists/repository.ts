import { and, asc, desc, eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/shared/db";
import { waSessions } from "@/modules/wa-sessions/schema";
import { blacklist, recipientListItems, recipientLists } from "./schema";

export type ItemInput = { phone: string; name?: string | null; vars?: Record<string, string> };

/** Daftar + jumlah item dalam 1 query (LEFT JOIN + GROUP BY), bukan COUNT per list. */
export const listLists = (owner?: string) =>
  db()
    .select({
      id: recipientLists.id,
      name: recipientLists.name,
      createdAt: recipientLists.createdAt,
      itemCount: sql<number>`count(${recipientListItems.phone})::int`,
    })
    .from(recipientLists)
    .leftJoin(recipientListItems, eq(recipientListItems.listId, recipientLists.id))
    .where(owner ? eq(recipientLists.ownerId, owner) : undefined)
    .groupBy(recipientLists.id)
    .orderBy(desc(recipientLists.createdAt));

export const getList = async (id: string, owner?: string) => {
  const w: SQL[] = [eq(recipientLists.id, id)];
  if (owner) w.push(eq(recipientLists.ownerId, owner));
  return (await db().select().from(recipientLists).where(and(...w)).limit(1))[0];
};

export const insertList = async (ownerId: string, name: string) =>
  (await db().insert(recipientLists).values({ ownerId, name }).returning())[0]!;

export const deleteList = (id: string) => db().delete(recipientLists).where(eq(recipientLists.id, id));

export const listItems = (listId: string, limit = 500) =>
  db().select().from(recipientListItems).where(eq(recipientListItems.listId, listId)).orderBy(asc(recipientListItems.phone)).limit(limit);

export async function addItems(listId: string, items: ItemInput[]) {
  const uniq = new Map(items.map((i) => [i.phone, i]));
  const rows = [...uniq.values()];
  for (let i = 0; i < rows.length; i += 2000) {
    await db()
      .insert(recipientListItems)
      .values(rows.slice(i, i + 2000).map((r) => ({ listId, phone: r.phone, name: r.name ?? null, vars: r.vars ?? {} })))
      .onConflictDoUpdate({
        target: [recipientListItems.listId, recipientListItems.phone],
        set: { name: sql`coalesce(excluded.name, ${recipientListItems.name})` },
      });
  }
  return rows.length;
}

export const removeItem = (listId: string, phone: string) =>
  db().delete(recipientListItems).where(and(eq(recipientListItems.listId, listId), eq(recipientListItems.phone, phone)));

/** Dipanggil worker saat ada balasan "STOP": owner dicari lewat sesi dalam 1 statement. */
export async function optOut(sessionId: string, phone: string) {
  await db().execute(sql`
    insert into ${blacklist} (owner_id, phone, reason)
    select ${waSessions.ownerId}, ${phone}, 'stop' from ${waSessions} where ${waSessions.id} = ${sessionId}
    on conflict do nothing`);
}

export const listBlacklist = (owner?: string) =>
  db().select().from(blacklist).where(owner ? eq(blacklist.ownerId, owner) : undefined).orderBy(desc(blacklist.createdAt)).limit(500);

export const removeBlacklist = (ownerId: string, phone: string) =>
  db().delete(blacklist).where(and(eq(blacklist.ownerId, ownerId), eq(blacklist.phone, phone)));
