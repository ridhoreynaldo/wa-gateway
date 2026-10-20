import { createHash, randomBytes } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { waSessions } from "@/modules/wa-sessions/schema";
import { apiKeys } from "./schema";

const hash = (k: string) => createHash("sha256").update(k).digest("hex");

/** Key hanya ditampilkan sekali; di DB tersimpan hash-nya saja. */
export async function createApiKey(ownerId: string, sessionId: string, name: string) {
  const key = "wagw_" + randomBytes(24).toString("base64url");
  await db().insert(apiKeys).values({ ownerId, sessionId, name, prefix: key.slice(0, 10), keyHash: hash(key) });
  return key;
}

/** Autentikasi API: 1 query join → sesi + status, tanpa lookup kedua. */
export async function authenticateKey(key: string) {
  const [row] = await db()
    .select({ id: apiKeys.id, sessionId: apiKeys.sessionId, status: waSessions.status })
    .from(apiKeys)
    .innerJoin(waSessions, eq(waSessions.id, apiKeys.sessionId))
    .where(eq(apiKeys.keyHash, hash(key)))
    .limit(1);
  if (row) void db().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id)).catch(() => undefined);
  return row ?? null;
}

export const listApiKeys = (owner?: string) =>
  db()
    .select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt, sessionName: waSessions.name })
    .from(apiKeys)
    .innerJoin(waSessions, eq(waSessions.id, apiKeys.sessionId))
    .where(owner ? eq(apiKeys.ownerId, owner) : undefined)
    .orderBy(desc(apiKeys.createdAt));

export const deleteApiKey = (id: string) => db().delete(apiKeys).where(eq(apiKeys.id, id));
