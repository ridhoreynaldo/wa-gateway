"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { action } from "@/shared/action";
import { db } from "@/shared/db";
import { notFound } from "@/shared/errors";
import { ownerScope, requirePermission } from "@/modules/auth/guards";
import { audit } from "@/modules/audit/service";
import { getSession } from "@/modules/wa-sessions/repository";
import { apiKeys } from "./schema";
import { createApiKey, deleteApiKey } from "./service";

export const createApiKeyAction = action(async (form: FormData) => {
  const me = await requirePermission("apikey:manage");
  const name = z.string().trim().min(2).max(60).parse(form.get("name"));
  const s = await getSession(z.string().uuid().parse(form.get("sessionId")), ownerScope(me));
  if (!s) throw notFound();
  const key = await createApiKey(s.ownerId, s.id, name);
  await audit(me.id, "apikey.create", s.id, { name });
  // key ditampilkan sekali lewat cookie httpOnly berumur 30 dtk (tidak masuk URL/log nginx)
  (await cookies()).set("wagw_newkey", key, { httpOnly: true, maxAge: 30, path: "/api-keys", sameSite: "strict" });
  redirect("/api-keys");
});

export const deleteApiKeyAction = action(async (form: FormData) => {
  const me = await requirePermission("apikey:manage");
  const id = z.string().uuid().parse(form.get("id"));
  const scope = ownerScope(me);
  const [k] = await db().select({ id: apiKeys.id }).from(apiKeys).where(and(eq(apiKeys.id, id), scope ? eq(apiKeys.ownerId, scope) : undefined)).limit(1);
  if (!k) throw notFound();
  await deleteApiKey(id);
  await audit(me.id, "apikey.delete", id);
  revalidatePath("/api-keys");
});
