import { boolean, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { waSessions } from "@/modules/wa-sessions/schema";

export const waGroups = pgTable(
  "wa_groups",
  {
    sessionId: uuid("session_id").notNull().references(() => waSessions.id, { onDelete: "cascade" }),
    jid: text("jid").notNull(),
    subject: text("subject").notNull(),
    size: integer("size").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.jid] })],
);

export const waGroupParticipants = pgTable(
  "wa_group_participants",
  {
    sessionId: uuid("session_id").notNull(),
    groupJid: text("group_jid").notNull(),
    jid: text("jid").notNull(),
    phone: text("phone"),
    isAdmin: boolean("is_admin").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.groupJid, t.jid] }),
    foreignKey({ columns: [t.sessionId, t.groupJid], foreignColumns: [waGroups.sessionId, waGroups.jid] }).onDelete("cascade"),
    index("wa_gp_group_idx").on(t.sessionId, t.groupJid),
  ],
);
