import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@/shared/phone";
import { redis } from "@/shared/redis";
import { authenticateKey } from "@/modules/api-keys/service";
import { enqueueDirect } from "@/modules/messaging/direct";

export const dynamic = "force-dynamic";

const body = z.object({ to: z.string().min(6).max(20), text: z.string().min(1).max(4000) });

/** POST /api/v1/messages   Authorization: Bearer wagw_xxx   {"to":"0812...","text":"Halo"} */
export async function POST(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!key) return NextResponse.json({ error: "missing_api_key" }, { status: 401 });
  const auth = await authenticateKey(key);
  if (!auth) return NextResponse.json({ error: "invalid_api_key" }, { status: 401 });

  // 60 request / menit per key
  const rk = `rl:api:${auth.id}`;
  const n = await redis().incr(rk);
  if (n === 1) await redis().expire(rk, 60);
  if (n > 60) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", details: parsed.error.flatten().fieldErrors }, { status: 422 });
  const phone = normalizePhone(parsed.data.to);
  if (!phone) return NextResponse.json({ error: "invalid_phone" }, { status: 422 });
  if (auth.status !== "connected") return NextResponse.json({ error: "session_not_connected" }, { status: 409 });

  const id = await enqueueDirect(auth.sessionId, phone, parsed.data.text);
  return NextResponse.json({ id, status: "queued" }, { status: 202 });
}
