import {
  pgTable, text, timestamp, uuid, jsonb,
} from "drizzle-orm/pg-core";

export const logsActiviteSaasTable = pgTable("logs_activite_saas", {
  id:               uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id"),
  action:           text("action").notNull(),
  details:          jsonb("details"),
  effectue_par:     uuid("effectue_par").notNull(),
  ip_address:       text("ip_address"),
  created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LogActiviteSaas = typeof logsActiviteSaasTable.$inferSelect;
