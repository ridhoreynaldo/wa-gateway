import { redirect } from "next/navigation";
import { forbidden } from "@/shared/errors";
import { can, type Permission } from "./rbac";
import { getCurrentUser, type AuthUser } from "./session";

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Untuk server component & server action. Lempar error bila tidak berhak. */
export async function requirePermission(p: Permission): Promise<AuthUser> {
  const user = await requireUser();
  if (!can(user.role, p)) throw forbidden();
  return user;
}

/** Filter kepemilikan: superadmin → semua data (undefined), admin → miliknya saja. */
export const ownerScope = (user: AuthUser): string | undefined => (can(user.role, "scope:all") ? undefined : user.id);
