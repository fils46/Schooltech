import {
  pgTable, text, boolean, timestamp, uuid, numeric, date, pgEnum, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const typeLicenceEnum = pgEnum("type_licence", [
  "mensuel", "trimestriel", "annuel", "essai",
]);

export const licencesTable = pgTable("licences", {
  id:                   uuid("id").primaryKey().defaultRandom(),
  etablissement_id:     uuid("etablissement_id").notNull(),
  type:                 typeLicenceEnum("type").notNull(),
  date_debut:           date("date_debut").notNull(),
  date_expiration:      date("date_expiration").notNull(),
  actif:                boolean("actif").notNull().default(true),
  montant:              numeric("montant", { precision: 12, scale: 2 }).notNull(),
  renouvellement_auto:  boolean("renouvellement_auto").notNull().default(false),
  notes_admin:          text("notes_admin"),
  created_at:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:           timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("uq_licence_etablissement").on(t.etablissement_id),
]);

export const insertLicenceSchema = createInsertSchema(licencesTable).omit({
  id: true, created_at: true, updated_at: true,
});

export type Licence = typeof licencesTable.$inferSelect;
export type InsertLicence = z.infer<typeof insertLicenceSchema>;
