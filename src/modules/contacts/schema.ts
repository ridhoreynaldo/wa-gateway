import { index, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { waSessions } from "@/modules/wa-sessions/schema";

export const waContacts = pgTable(
  "wa_contacts",
  {
    sessionId: uuid("session_id").notNull().references(() => waSessions.id, { onDelete: "cascade" }),
    jid: text("jid").notNull(),
    name: text("name"),
    notify: text("notify"),
    phone: text("phone"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sessionId, t.jid] }),
    index("wa_contacts_phone_idx").on(t.sessionId, t.phone),
  ],
);
