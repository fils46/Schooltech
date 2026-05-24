import {
  pgTable, text, timestamp, uuid, pgEnum, boolean, unique,
  integer, numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const absenceTypeEnum = pgEnum("absence_type", ["absence", "retard"]);

export const absenceStatutEnum = pgEnum("absence_statut", [
  "non_justifiee",
  "en_attente",
  "justifiee",
  "rejetee",
]);

export const absencesTable = pgTable(
  "absences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    eleve_id: uuid("eleve_id").notNull(),
    classe_id: uuid("classe_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    appel_detail_id: uuid("appel_detail_id"),
    matiere: text("matiere").notNull(),
    professeur_id: uuid("professeur_id").notNull(),
    date_absence: text("date_absence").notNull(),
    creneau_id: uuid("creneau_id"),
    type: absenceTypeEnum("type").notNull().default("absence"),
    statut: absenceStatutEnum("statut").notNull().default("non_justifiee"),
    notif_parent_envoyee: boolean("notif_parent_envoyee").notNull().default(false),
    periode_journee: text("periode_journee"),
    nb_heures: numeric("nb_heures", { precision: 4, scale: 2 }),
    alerte_declenchee: integer("alerte_declenchee").notNull().default(0),
    source_saisie: text("source_saisie").notNull().default("appel_cours"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_absence_appel_detail").on(t.appel_detail_id),
  ]
);

export const insertAbsenceSchema = createInsertSchema(absencesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertAbsence = z.infer<typeof insertAbsenceSchema>;
export type Absence = typeof absencesTable.$inferSelect;
