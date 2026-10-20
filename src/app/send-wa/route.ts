import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizePhone } from "@/shared/phone";
import { authenticateKey } from "@/modules/api-keys/service";
import { enqueueDirect } from "@/modules/messaging/direct";

export const dynamic = "force-dynamic";

/**
 * Kompatibilitas dengan wa-gateway lama: POST /send-wa {target, message}.
 * Beda dengan versi lama: WAJIB header `Authorization: Bearer <api key>` (versi lama tanpa auth).
 * Sesi diambil dari API key, bukan "sesi pertama yang tersambung".
 */
const body = z.object({ target: z.string().min(6).max(30), message: z.string().min(1).max(4000) });

export async function POST(req: Request) {
  const key = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!key) return NextResponse.json({ status: "error", message: "Header Authorization: Bearer <api key> wajib" }, { status: 401 });
  const auth = await authenticateKey(key);
  if (!auth) return NextResponse.json({ status: "error", message: "API key tidak valid" }, { status: 401 });

  const raw = req.headers.get("content-type")?.includes("application/json") ? await req.json().catch(() => null) : Object.fromEntries(await req.formData().catch(() => new FormData()));
  const parsed = body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ status: "error", message: "target dan message wajib diisi" }, { status: 400 });
  if (parsed.data.target.includes("@g.us")) return NextResponse.json({ status: "error", message: "Kirim ke grup belum didukung" }, { status: 422 });
  const phone = normalizePhone(parsed.data.target);
  if (!phone) return NextResponse.json({ status: "error", message: "Nomor tidak valid" }, { status: 422 });
  if (auth.status !== "connected") return NextResponse.json({ status: "error", message: "Sesi WA tidak tersambung" }, { status: 503 });

  const id = await enqueueDirect(auth.sessionId, phone, parsed.data.message);
  return NextResponse.json({ status: "success", id, sessionId: auth.sessionId }, { status: 202 });
}
