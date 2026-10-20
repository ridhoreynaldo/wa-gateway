import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/shared/env";
import * as schema from "./schema";

type Db = PostgresJsDatabase<typeof schema>;

const g = globalThis as unknown as { __db?: Db };

function create(): Db {
  const e = env();
  // PgBouncer transaction mode: prepared statement WAJIB dimatikan.
  const client = postgres(e.DATABASE_URL, {
    max: e.DB_POOL_MAX,
    prepare: false,
    idle_timeout: 30,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

/** Singleton (aman terhadap hot-reload Next.js). */
export function db(): Db {
  return (g.__db ??= create());
}

export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
