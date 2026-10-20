import { and, asc, eq, gt, ilike, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/shared/db";
import { waContacts } from "./schema";

export type ContactInput = { jid: string; name?: string | null; notify?: string | null; phone?: string | null };

/** Bulk upsert; COALESCE agar data lama tidak tertimpa null oleh event parsial. */
export async function upsertContacts(sessionId: string, rows: ContactInput[]) {
  const uniq = new Map(rows.map((r) => [r.jid, r]));
  const list = [...uniq.values()];
  for (let i = 0; i < list.length; i += 1000) {
    await db()
      .insert(waContacts)
      .values(list.slice(i, i + 1000).map((r) => ({ sessionId, jid: r.jid, name: r.name ?? null, notify: r.notify ?? null, phone: r.phone ?? null })))
      .onConflictDoUpdate({
        target: [waContacts.sessionId, waContacts.jid],
        set: {
          name: sql`coalesce(excluded.name, ${waContacts.name})`,
          notify: sql`coalesce(excluded.notify, ${waContacts.notify})`,
          phone: sql`coalesce(excluded.phone, ${waContacts.phone})`,
          updatedAt: sql`now()`,
        },
      });
  }
}

/** Keyset pagination (cursor = jid) → tetap cepat di halaman ke-1000, tanpa OFFSET. */
export async function listContacts(sessionId: string, opts: { q?: string; after?: string; limit?: number }) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const where: SQL[] = [eq(waContacts.sessionId, sessionId)];
  if (opts.after) where.push(gt(waContacts.jid, opts.after));
  if (opts.q) {
    const like = `%${opts.q.replace(/[%_]/g, "")}%`;
    where.push(or(ilike(waContacts.name, like), ilike(waContacts.notify, like), ilike(waContacts.phone, like))!);
  }
  const rows = await db()
    .select({ jid: waContacts.jid, name: waContacts.name, notify: waContacts.notify, phone: waContacts.phone })
    .from(waContacts)
    .where(and(...where))
    .orderBy(asc(waContacts.jid))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1]!.jid : null };
}

export const countContacts = async (sessionId: string) =>
  (await db().select({ n: sql<number>`count(*)::int` }).from(waContacts).where(eq(waContacts.sessionId, sessionId)))[0]!.n;

export const contactsWithPhone = (sessionId: string, limit = 20000) =>
  db()
    .select({ phone: waContacts.phone, name: sql<string | null>`coalesce(${waContacts.name}, ${waContacts.notify})` })
    .from(waContacts)
    .where(and(eq(waContacts.sessionId, sessionId), sql`${waContacts.phone} is not null`))
    .limit(limit);
