import {
  pgTable, text, timestamp, uuid, pgEnum, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const presenceStatutEnum = pgEnum("presence_statut", [
  "present",
  "absent",
  "retard",
  "excused",
]);

export const appelDetailsTable = pgTable(
  "appel_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appel_id: uuid("appel_id").notNull(),
    eleve_id: uuid("eleve_id").notNull(),
    statut: presenceStatutEnum("statut").notNull().default("present"),
    motif: text("motif"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_appel_detail_appel_eleve").on(t.appel_id, t.eleve_id),
  ]
);

export const insertAppelDetailSchema = createInsertSchema(appelDetailsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertAppelDetail = z.infer<typeof insertAppelDetailSchema>;
export type AppelDetail = typeof appelDetailsTable.$inferSelect;
