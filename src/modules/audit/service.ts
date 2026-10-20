import { headers } from "next/headers";
import { db } from "@/shared/db";
import { auditLogs } from "./schema";

/** Catat aksi sensitif. Jangan sampai kegagalan audit menggagalkan aksi utama. */
export async function audit(userId: string | null, action: string, target?: string, meta?: Record<string, unknown>) {
  try {
    const h = await headers();
    const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    await db().insert(auditLogs).values({ userId, action, target, meta, ip });
  } catch {
    /* ignore */
  }
}
