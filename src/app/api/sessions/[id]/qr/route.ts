import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { getCurrentUser } from "@/modules/auth/session";
import { can } from "@/modules/auth/rbac";
import { getSession } from "@/modules/wa-sessions/repository";
import { keys, redis } from "@/shared/redis";

export const dynamic = "force-dynamic";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const s = await getSession(id, can(user.role, "scope:all") ? undefined : user.id);
  if (!s) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const raw = s.status === "qr" ? await redis().get(keys.qr(id)) : null;
  const qr = raw ? await QRCode.toDataURL(raw, { margin: 1, width: 280 }) : null;
  return NextResponse.json({ status: s.status, phone: s.phone, qr });
}
