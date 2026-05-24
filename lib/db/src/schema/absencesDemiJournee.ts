import {
  pgTable, uuid, text, boolean, timestamp, pgEnum, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const periodeJourneeEnum = pgEnum("periode_journee_enum", [
  "matin",
  "apres_midi",
  "journee_entiere",
]);

export const absenceDemiJourneeStatutEnum = pgEnum("absence_demi_journee_statut", [
  "non_justifiee",
  "en_attente_justification",
  "justifiee",
  "irreelle",
]);

export const absencesDemiJourneeTable = pgTable(
  "absences_demi_journee",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    eleve_id: uuid("eleve_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    classe_id: uuid("classe_id").notNull(),
    date_absence: text("date_absence").notNull(),
    periode: periodeJourneeEnum("periode").notNull(),
    motif_absence: text("motif_absence"),
    statut: absenceDemiJourneeStatutEnum("statut").notNull().default("non_justifiee"),
    justification_id: uuid("justification_id"),
    saisi_par: uuid("saisi_par").notNull(),
    parent_notifie: boolean("parent_notifie").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_absence_demi_journee").on(t.eleve_id, t.date_absence, t.periode),
  ]
);

export const insertAbsenceDemiJourneeSchema = createInsertSchema(absencesDemiJourneeTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertAbsenceDemiJournee = z.infer<typeof insertAbsenceDemiJourneeSchema>;
export type AbsenceDemiJournee = typeof absencesDemiJourneeTable.$inferSelect;
