import { asc, eq } from "drizzle-orm";
import { db } from "@/shared/db";
import { users } from "./schema";

export const listUsers = () =>
  db()
    .select({ id: users.id, email: users.email, name: users.name, role: users.role, isActive: users.isActive, lastLoginAt: users.lastLoginAt })
    .from(users)
    .orderBy(asc(users.createdAt));

export const setActive = (id: string, isActive: boolean) => db().update(users).set({ isActive }).where(eq(users.id, id));
export const setPassword = (id: string, passwordHash: string) => db().update(users).set({ passwordHash }).where(eq(users.id, id));
