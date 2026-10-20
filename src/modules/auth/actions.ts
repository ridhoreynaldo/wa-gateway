"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/shared/db";
import { redis } from "@/shared/redis";
import { users } from "@/modules/users/schema";
import { audit } from "@/modules/audit/service";
import { verifyPassword } from "./password";
import { createSession, destroySession, getCurrentUser } from "./session";

const input = z.object({ email: z.string().email(), password: z.string().min(1) });

// hash palsu untuk menyamakan waktu respon saat email tidak ada
const DUMMY = "scrypt$00000000000000000000000000000000$" + "0".repeat(128);

export type LoginState = { error?: string };

export async function loginAction(_: LoginState, form: FormData): Promise<LoginState> {
  const parsed = input.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: "Email atau password tidak valid" };

  const h = await headers();
  const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // brute-force guard: 10 percobaan / 15 menit per IP+email
  const rlKey = `rl:login:${ip}:${parsed.data.email.toLowerCase()}`;
  const tries = await redis().incr(rlKey);
  if (tries === 1) await redis().expire(rlKey, 900);
  if (tries > 10) return { error: "Terlalu banyak percobaan. Coba lagi 15 menit lagi." };

  const [user] = await db().select().from(users).where(eq(users.email, parsed.data.email.toLowerCase())).limit(1);
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? DUMMY);
  if (!user || !ok || !user.isActive) return { error: "Email atau password salah" };

  await redis().del(rlKey);
  await createSession(user.id, { ip, userAgent: h.get("user-agent") ?? undefined });
  await db().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await audit(user.id, "auth.login");
  redirect("/");
}

export async function logoutAction() {
  const user = await getCurrentUser();
  await destroySession();
  if (user) await audit(user.id, "auth.logout");
  redirect("/login");
}
