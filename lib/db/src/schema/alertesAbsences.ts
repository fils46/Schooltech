import {
  pgTable, uuid, integer, text, timestamp, pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const traitementStatutAlerteEnum = pgEnum("traitement_statut_alerte", [
  "nouvelle",
  "en_cours",
  "traitee",
  "ignoree",
]);

export const alertesAbsencesTable = pgTable("alertes_absences", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  eleve_id: uuid("eleve_id").notNull(),
  annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
  trimestre: integer("trimestre"),
  niveau_alerte: integer("niveau_alerte").notNull(),
  nb_absences_nj_atteint: integer("nb_absences_nj_atteint").notNull(),
  date_declenchement: timestamp("date_declenchement", { withTimezone: true }).notNull().defaultNow(),
  traitement_statut: traitementStatutAlerteEnum("traitement_statut").notNull().default("nouvelle"),
  traitement_notes: text("traitement_notes"),
  traite_par: uuid("traite_par"),
  date_traitement: text("date_traitement"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAlerteAbsenceSchema = createInsertSchema(alertesAbsencesTable).omit({
  id: true,
  created_at: true,
});

export type InsertAlerteAbsence = z.infer<typeof insertAlerteAbsenceSchema>;
export type AlerteAbsence = typeof alertesAbsencesTable.$inferSelect;
