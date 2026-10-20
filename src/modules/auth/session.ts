import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/shared/db";
import { env } from "@/shared/env";
import { authSessions } from "./schema";
import { users } from "@/modules/users/schema";
import type { Role } from "./rbac";

const COOKIE = "wagw_session";
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export type AuthUser = { id: string; email: string; name: string; role: Role };

export async function createSession(userId: string, meta: { ip?: string; userAgent?: string }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env().SESSION_TTL_DAYS * 86_400_000);
  await db().insert(authSessions).values({ id: sha256(token), userId, expiresAt, ip: meta.ip, userAgent: meta.userAgent });
  // housekeeping murah: buang sesi kedaluwarsa milik user ini
  await db().delete(authSessions).where(and(eq(authSessions.userId, userId), lt(authSessions.expiresAt, new Date())));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env().COOKIE_SECURE === "true",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db().delete(authSessions).where(eq(authSessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** 1 query (join) per request; di-cache per render supaya layout+page tidak query ulang. */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await db()
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(and(eq(authSessions.id, sha256(token)), gt(authSessions.expiresAt, new Date()), eq(users.isActive, true)))
    .limit(1);
  return row ?? null;
});
