import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/shared/db";
import { waSessions } from "@/modules/wa-sessions/schema";
import { blacklist, recipientListItems } from "@/modules/lists/schema";
import { campaignRecipients, campaigns } from "./schema";

export type NewCampaign = Pick<
  typeof campaigns.$inferInsert,
  | "ownerId" | "sessionId" | "name" | "template" | "minDelaySec" | "maxDelaySec" | "hourlyLimit" | "dailyLimit"
  | "batchSize" | "batchPauseMinSec" | "batchPauseMaxSec" | "windowStartHour" | "windowEndHour"
>;

/**
 * Buat campaign + salin penerima dari list dalam SATU statement INSERT…SELECT
 * (nomor blacklist otomatis dibuang). Tidak ada loop per penerima.
 */
export async function createCampaign(input: NewCampaign, listId: string) {
  return db().transaction(async (tx) => {
    const [c] = await tx.insert(campaigns).values(input).returning();
    await tx.execute(sql`
      insert into ${campaignRecipients} (campaign_id, phone, name, vars)
      select ${c!.id}, i.phone, i.name, i.vars
      from ${recipientListItems} i
      where i.list_id = ${listId}
        and not exists (select 1 from ${blacklist} b where b.owner_id = ${input.ownerId} and b.phone = i.phone)`);
    const [{ n }] = (await tx.execute(
      sql`select count(*)::int as n from ${campaignRecipients} where campaign_id = ${c!.id}`,
    )) as unknown as [{ n: number }];
    await tx.update(campaigns).set({ total: n }).where(eq(campaigns.id, c!.id));
    return { ...c!, total: n };
  });
}

export const listCampaigns = (owner?: string) =>
  db()
    .select({
      id: campaigns.id, name: campaigns.name, status: campaigns.status, total: campaigns.total,
      sent: campaigns.sentCount, failed: campaigns.failedCount, skipped: campaigns.skippedCount,
      createdAt: campaigns.createdAt, sessionName: waSessions.name,
    })
    .from(campaigns)
    .innerJoin(waSessions, eq(waSessions.id, campaigns.sessionId))
    .where(owner ? eq(campaigns.ownerId, owner) : undefined)
    .orderBy(desc(campaigns.createdAt))
    .limit(100);

export const getCampaign = async (id: string, owner?: string) => {
  const w: SQL[] = [eq(campaigns.id, id)];
  if (owner) w.push(eq(campaigns.ownerId, owner));
  const [row] = await db()
    .select({ c: campaigns, sessionName: waSessions.name, sessionStatus: waSessions.status })
    .from(campaigns)
    .innerJoin(waSessions, eq(waSessions.id, campaigns.sessionId))
    .where(and(...w))
    .limit(1);
  return row;
};

export const campaignRecipientsPage = (campaignId: string, status?: "pending" | "sent" | "failed" | "skipped", limit = 100) =>
  db()
    .select()
    .from(campaignRecipients)
    .where(and(eq(campaignRecipients.campaignId, campaignId), status ? eq(campaignRecipients.status, status) : undefined))
    .orderBy(campaignRecipients.id)
    .limit(limit);

/** Transisi status dengan guard (hanya dari status yang valid) → aman dari double-click. */
export async function transition(id: string, to: "running" | "paused" | "cancelled", from: (typeof campaigns.$inferSelect)["status"][], extra: Partial<typeof campaigns.$inferInsert> = {}) {
  const [row] = await db()
    .update(campaigns)
    .set({ status: to, ...extra })
    .where(and(eq(campaigns.id, id), inArray(campaigns.status, from)))
    .returning({ id: campaigns.id });
  return !!row;
}

export const deleteCampaign = (id: string) => db().delete(campaigns).where(eq(campaigns.id, id));
