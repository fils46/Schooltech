import {
  pgTable, uuid, integer, boolean, text, timestamp, pgEnum, time,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const modeSaisieAbsenceEnum = pgEnum("mode_saisie_absence", [
  "par_cours",
  "demi_journee",
  "les_deux",
]);

export const periodeCalculAbsenceEnum = pgEnum("periode_calcul_absence", [
  "trimestre",
  "annee",
]);

export const configAbsencesTable = pgTable("config_absences", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull().unique(),

  mode_saisie: modeSaisieAbsenceEnum("mode_saisie").notNull().default("par_cours"),

  seuil_alerte_1: integer("seuil_alerte_1").notNull().default(3),
  seuil_alerte_2: integer("seuil_alerte_2").notNull().default(6),
  seuil_alerte_3: integer("seuil_alerte_3").notNull().default(10),

  periode_calcul: periodeCalculAbsenceEnum("periode_calcul").notNull().default("trimestre"),

  heure_debut_matin: text("heure_debut_matin").notNull().default("07:30"),
  heure_fin_matin: text("heure_fin_matin").notNull().default("12:30"),
  heure_debut_aprem: text("heure_debut_aprem").notNull().default("13:30"),
  heure_fin_aprem: text("heure_fin_aprem").notNull().default("17:30"),

  notifier_parent_seuil_1: boolean("notifier_parent_seuil_1").notNull().default(true),
  notifier_parent_seuil_2: boolean("notifier_parent_seuil_2").notNull().default(true),
  notifier_parent_seuil_3: boolean("notifier_parent_seuil_3").notNull().default(true),
  notifier_censeur_seuil_1: boolean("notifier_censeur_seuil_1").notNull().default(false),
  notifier_censeur_seuil_2: boolean("notifier_censeur_seuil_2").notNull().default(true),
  notifier_censeur_seuil_3: boolean("notifier_censeur_seuil_3").notNull().default(true),
  notifier_directeur_seuil_3: boolean("notifier_directeur_seuil_3").notNull().default(true),

  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertConfigAbsencesSchema = createInsertSchema(configAbsencesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertConfigAbsences = z.infer<typeof insertConfigAbsencesSchema>;
export type ConfigAbsences = typeof configAbsencesTable.$inferSelect;
