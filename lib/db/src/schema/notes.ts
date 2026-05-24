import {
  pgTable, text, timestamp, uuid, pgEnum, numeric, boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const typeEvaluationEnum = pgEnum("type_evaluation", [
  "devoir",
  "interrogation",
  "composition",
  "examen_blanc",
  "tp",
  "expose",
  "autre",
]);

export const trimestreEnum = pgEnum("trimestre", ["1", "2", "3"]);

export const notesTable = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  professeur_id: uuid("professeur_id").notNull(),
  eleve_id: uuid("eleve_id").notNull(),
  classe_id: uuid("classe_id").notNull(),
  annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
  matiere: text("matiere").notNull(),
  type_evaluation: typeEvaluationEnum("type_evaluation").notNull(),
  trimestre: trimestreEnum("trimestre").notNull(),
  intitule: text("intitule").notNull(),
  note: numeric("note", { precision: 5, scale: 2 }).notNull(),
  note_sur: numeric("note_sur", { precision: 5, scale: 2 }).notNull().default("20"),
  coefficient: numeric("coefficient", { precision: 3, scale: 1 }).notNull().default("1"),
  periode: text("periode"),
  date_evaluation: text("date_evaluation").notNull(),
  observations: text("observations"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertNoteSchema = createInsertSchema(notesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertNote = z.infer<typeof insertNoteSchema>;
export type Note = typeof notesTable.$inferSelect;

export const typesEvaluationsConfigTable = pgTable("types_evaluations_config", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  type_evaluation: text("type_evaluation").notNull(),
  libelle: text("libelle").notNull(),
  coefficient_defaut: numeric("coefficient_defaut", { precision: 4, scale: 2 }).notNull().default("1.00"),
  actif: boolean("actif").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type TypesEvaluationsConfig = typeof typesEvaluationsConfigTable.$inferSelect;
