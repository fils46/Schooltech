import {
  pgTable, text, timestamp, uuid, pgEnum, date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { etablissementsTable } from "./etablissements";
import { elevesTable } from "./eleves";
import { utilisateursTable } from "./utilisateurs";

export const typeIncidentEnum = pgEnum("type_incident", [
  "retard", "insolence", "bagarre", "fraude", "vandalisme", "absenteisme", "autre",
]);

export const statutIncidentEnum = pgEnum("statut_incident", [
  "en_attente", "traite", "escalade",
]);

export const incidentsTable = pgTable("incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id")
    .notNull()
    .references(() => etablissementsTable.id, { onDelete: "cascade" }),
  eleve_id: uuid("eleve_id")
    .notNull()
    .references(() => elevesTable.id, { onDelete: "cascade" }),
  signale_par: uuid("signale_par")
    .notNull()
    .references(() => utilisateursTable.id),
  type_incident: typeIncidentEnum("type_incident").notNull(),
  description: text("description").notNull(),
  lieu: text("lieu"),
  date_incident: date("date_incident").notNull(),
  heure_incident: text("heure_incident"),
  statut: statutIncidentEnum("statut").notNull().default("en_attente"),
  escalade_vers: uuid("escalade_vers").references(() => utilisateursTable.id),
  motif_escalade: text("motif_escalade"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
