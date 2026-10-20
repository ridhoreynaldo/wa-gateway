import { index, integer, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/modules/users/schema";

export const waStatusEnum = pgEnum("wa_status", ["disconnected", "connecting", "qr", "connected", "logged_out"]);

export const waSessions = pgTable(
  "wa_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    status: waStatusEnum("status").notNull().default("disconnected"),
    /** Hari pertama broadcast dihitung untuk warm-up. */
    warmupStartedAt: timestamp("warmup_started_at", { withTimezone: true }),
    lastConnectedAt: timestamp("last_connected_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("wa_sessions_owner_idx").on(t.ownerId)],
);

/** Auth state Baileys disimpan di Postgres (bukan file) supaya aman di container. */
export const waAuth = pgTable(
  "wa_auth",
  {
    sessionId: uuid("session_id").notNull().references(() => waSessions.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: integer("updated_at").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.key] })],
);
