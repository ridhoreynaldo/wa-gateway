import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/shared/db";
import { redis } from "@/shared/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await Promise.all([db().execute(sql`select 1`), redis().ping()]);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
