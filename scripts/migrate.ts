import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { hashPassword } from "@/modules/auth/password";
import { users } from "@/modules/users/schema";

// Migrasi + seed superadmin. Pakai koneksi LANGSUNG ke Postgres (bukan PgBouncer).
const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL_DIRECT / DATABASE_URL belum diset");

const client = postgres(url, { max: 1 });
const db = drizzle(client);

await migrate(db, { migrationsFolder: process.env.MIGRATIONS_DIR ?? "./drizzle" });
console.log("✔ migrasi selesai");

const email = process.env.SEED_SUPERADMIN_EMAIL?.toLowerCase();
const password = process.env.SEED_SUPERADMIN_PASSWORD;
if (email && password) {
  const [exists] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (!exists) {
    await db.insert(users).values({ email, name: "Super Admin", passwordHash: await hashPassword(password), role: "superadmin" });
    console.log(`✔ superadmin dibuat: ${email}`);
  }
}
await client.end();
