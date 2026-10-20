import { bigint, index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { waSessions } from "@/modules/wa-sessions/schema";

export const directionEnum = pgEnum("msg_direction", ["out", "in"]);
export const msgStatusEnum = pgEnum("msg_status", ["queued", "sent", "delivered", "read", "failed"]);

/**
 * Log pesan. Tabel ini tumbuh paling cepat → pk bigint identity (insert berurutan),
 * index dibuat minimal. Untuk volume besar: partisi per bulan (lihat docs/ARCHITECTURE.md).
 */
export const messages = pgTable(
  "messages",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    sessionId: uuid("session_id").notNull().references(() => waSessions.id, { onDelete: "cascade" }),
    direction: directionEnum("direction").notNull(),
    phone: text("phone").notNull(),
    waMessageId: text("wa_message_id"),
    body: text("body").notNull(),
    status: msgStatusEnum("status").notNull().default("queued"),
    campaignId: uuid("campaign_id"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("messages_session_created_idx").on(t.sessionId, t.createdAt),
    index("messages_wa_id_idx").on(t.waMessageId),
  ],
);
