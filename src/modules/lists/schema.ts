import { index, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "@/modules/users/schema";

export const recipientLists = pgTable(
  "recipient_lists",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("recipient_lists_owner_idx").on(t.ownerId)],
);

export const recipientListItems = pgTable(
  "recipient_list_items",
  {
    listId: uuid("list_id").notNull().references(() => recipientLists.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    name: text("name"),
    vars: jsonb("vars").$type<Record<string, string>>().notNull().default({}),
  },
  (t) => [primaryKey({ columns: [t.listId, t.phone] })],
);

/** Nomor yang minta berhenti (balas STOP) — tidak akan pernah dikirimi broadcast lagi. */
export const blacklist = pgTable(
  "blacklist",
  {
    ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ownerId, t.phone] })],
);
