import { pgTable, text, boolean, timestamp, uuid } from "drizzle-orm/pg-core";
import { utilisateursTable } from "./utilisateurs";

export const resetTokensTable = pgTable("reset_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  utilisateur_id: uuid("utilisateur_id")
    .notNull()
    .references(() => utilisateursTable.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  expire_at: timestamp("expire_at", { withTimezone: true }).notNull(),
  used: boolean("used").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ResetToken = typeof resetTokensTable.$inferSelect;
