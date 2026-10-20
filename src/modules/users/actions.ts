"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { action } from "@/shared/action";
import { db } from "@/shared/db";
import { AppError } from "@/shared/errors";
import { requirePermission } from "@/modules/auth/guards";
import { hashPassword } from "@/modules/auth/password";
import { audit } from "@/modules/audit/service";
import { authSessions } from "@/modules/auth/schema";
import { users } from "./schema";
import { setActive, setPassword } from "./repository";

const createInput = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().email().transform((s) => s.toLowerCase()),
  password: z.string().min(8).max(128),
  role: z.enum(["admin", "superadmin"]),
});

export const createUserAction = action(async (form: FormData) => {
  const me = await requirePermission("user:manage");
  const data = createInput.parse(Object.fromEntries(form));
  const exists = await db().select({ id: users.id }).from(users).where(eq(users.email, data.email)).limit(1);
  if (exists.length) throw new AppError("Email sudah terdaftar");
  const [u] = await db().insert(users).values({ ...data, passwordHash: await hashPassword(data.password) }).returning({ id: users.id });
  await audit(me.id, "user.create", u?.id, { email: data.email, role: data.role });
  revalidatePath("/users");
});

export const toggleUserAction = action(async (form: FormData) => {
  const me = await requirePermission("user:manage");
  const id = z.string().uuid().parse(form.get("id"));
  if (id === me.id) throw new AppError("Tidak bisa menonaktifkan akun sendiri");
  const active = form.get("active") === "true";
  await setActive(id, active);
  if (!active) await db().delete(authSessions).where(eq(authSessions.userId, id)); // paksa logout
  await audit(me.id, active ? "user.enable" : "user.disable", id);
  revalidatePath("/users");
});

export const resetPasswordAction = action(async (form: FormData) => {
  const me = await requirePermission("user:manage");
  const id = z.string().uuid().parse(form.get("id"));
  const password = z.string().min(8).max(128).parse(form.get("password"));
  await setPassword(id, await hashPassword(password));
  await db().delete(authSessions).where(eq(authSessions.userId, id));
  await audit(me.id, "user.reset_password", id);
  revalidatePath("/users");
});
