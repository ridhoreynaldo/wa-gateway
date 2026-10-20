import { and, eq, inArray, sql } from "drizzle-orm";
import { BufferJSON, initAuthCreds, proto, type AuthenticationCreds, type AuthenticationState, type SignalDataTypeMap } from "@whiskeysockets/baileys";
import { db } from "@/shared/db";
import { waAuth } from "../schema";

const CREDS = "creds";
const ser = (v: unknown) => JSON.stringify(v, BufferJSON.replacer);
const de = <T>(s: string): T => JSON.parse(s, BufferJSON.reviver) as T;

/** Pengganti useMultiFileAuthState: simpan creds + signal keys di tabel wa_auth. */
export async function usePgAuthState(sessionId: string): Promise<{ state: AuthenticationState; saveCreds: () => Promise<void> }> {
  const [row] = await db()
    .select({ value: waAuth.value })
    .from(waAuth)
    .where(and(eq(waAuth.sessionId, sessionId), eq(waAuth.key, CREDS)))
    .limit(1);
  const creds: AuthenticationCreds = row ? de(row.value) : initAuthCreds();

  const upsert = (rows: { key: string; value: string }[]) =>
    db()
      .insert(waAuth)
      .values(rows.map((r) => ({ sessionId, ...r, updatedAt: Math.floor(Date.now() / 1000) })))
      .onConflictDoUpdate({
        target: [waAuth.sessionId, waAuth.key],
        set: { value: sql`excluded.value`, updatedAt: sql`excluded.updated_at` },
      });

  return {
    state: {
      creds,
      keys: {
        // 1 query IN (...) untuk semua id → tanpa N+1
        get: async <T extends keyof SignalDataTypeMap>(type: T, ids: string[]) => {
          const out: { [id: string]: SignalDataTypeMap[T] } = {};
          if (!ids.length) return out;
          const rows = await db()
            .select({ key: waAuth.key, value: waAuth.value })
            .from(waAuth)
            .where(and(eq(waAuth.sessionId, sessionId), inArray(waAuth.key, ids.map((id) => `${type}-${id}`))));
          for (const r of rows) {
            let v = de<SignalDataTypeMap[T]>(r.value);
            if (type === "app-state-sync-key" && v) v = proto.Message.AppStateSyncKeyData.fromObject(v as object) as unknown as SignalDataTypeMap[T];
            out[r.key.slice(type.length + 1)] = v;
          }
          return out;
        },
        set: async (data) => {
          const up: { key: string; value: string }[] = [];
          const del: string[] = [];
          for (const [type, entries] of Object.entries(data)) {
            for (const [id, val] of Object.entries(entries ?? {})) {
              const key = `${type}-${id}`;
              if (val) up.push({ key, value: ser(val) });
              else del.push(key);
            }
          }
          if (up.length) await upsert(up);
          if (del.length) await db().delete(waAuth).where(and(eq(waAuth.sessionId, sessionId), inArray(waAuth.key, del)));
        },
      },
    },
    saveCreds: async () => {
      await upsert([{ key: CREDS, value: ser(creds) }]);
    },
  };
}
