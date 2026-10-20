import { bigint, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "@/modules/users/schema";
import { waSessions } from "@/modules/wa-sessions/schema";

export const campaignStatusEnum = pgEnum("campaign_status", ["draft", "running", "paused", "completed", "cancelled"]);
export const recipientStatusEnum = pgEnum("recipient_status", ["pending", "sent", "failed", "skipped"]);

export const campaigns = pgTable(
  "campaigns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    sessionId: uuid("session_id").notNull().references(() => waSessions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    template: text("template").notNull(),
    status: campaignStatusEnum("status").notNull().default("draft"),
    pauseReason: text("pause_reason"),

    // Pengaturan throttling (default = profil "normal & aman")
    minDelaySec: integer("min_delay_sec").notNull().default(25),
    maxDelaySec: integer("max_delay_sec").notNull().default(60),
    hourlyLimit: integer("hourly_limit").notNull().default(40),
    dailyLimit: integer("daily_limit").notNull().default(200),
    batchSize: integer("batch_size").notNull().default(20),
    batchPauseMinSec: integer("batch_pause_min_sec").notNull().default(180),
    batchPauseMaxSec: integer("batch_pause_max_sec").notNull().default(420),
    windowStartHour: integer("window_start_hour").notNull().default(8),
    windowEndHour: integer("window_end_hour").notNull().default(20),

    // Counter denormalisasi → halaman daftar tidak perlu COUNT(*) per campaign
    total: integer("total").notNull().default(0),
    sentCount: integer("sent_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    skippedCount: integer("skipped_count").notNull().default(0),
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    batchProgress: integer("batch_progress").notNull().default(0),

    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("campaigns_owner_idx").on(t.ownerId, t.createdAt),
    index("campaigns_session_idx").on(t.sessionId),
    index("campaigns_status_idx").on(t.status),
  ],
);

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    campaignId: uuid("campaign_id").notNull().references(() => campaigns.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name"),
    vars: jsonb("vars").$type<Record<string, string>>().notNull().default({}),
    status: recipientStatusEnum("status").notNull().default("pending"),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
  },
  (t) => [
    unique("campaign_recipients_uq").on(t.campaignId, t.phone),
    // Dipakai untuk "ambil pending berikutnya" → index scan murni
    index("campaign_recipients_next_idx").on(t.campaignId, t.status, t.id),
  ],
);
