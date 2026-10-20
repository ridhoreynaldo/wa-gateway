import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** URL lewat PgBouncer (transaction mode) — dipakai web & worker. */
  DATABASE_URL: z.string().min(1),
  /** URL langsung ke Postgres — dipakai migrasi saja. */
  DATABASE_URL_DIRECT: z.string().optional(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  REDIS_URL: z.string().min(1),
  TZ_APP: z.string().default("Asia/Jakarta"),
  LOG_LEVEL: z.string().default("info"),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  SEED_SUPERADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPERADMIN_PASSWORD: z.string().min(8).optional(),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Divalidasi lazily supaya `next build` tidak butuh env runtime. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error("Env tidak valid: " + JSON.stringify(parsed.error.flatten().fieldErrors));
    }
    cached = parsed.data;
  }
  return cached;
}
