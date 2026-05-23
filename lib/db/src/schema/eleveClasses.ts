import { pgTable, timestamp, uuid, date, pgEnum, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const statutEleveClasseEnum = pgEnum("statut_eleve_classe", [
  "actif",
  "transfere",
  "abandonne",
]);

export const eleveClassesTable = pgTable(
  "eleve_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eleve_id: uuid("eleve_id").notNull(),
    classe_id: uuid("classe_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    date_affectation: date("date_affectation").notNull(),
    statut: statutEleveClasseEnum("statut").notNull().default("actif"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_eleve_annee").on(t.eleve_id, t.annee_scolaire_id)]
);

export const insertEleveClasseSchema = createInsertSchema(eleveClassesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertEleveClasse = z.infer<typeof insertEleveClasseSchema>;
export type EleveClasse = typeof eleveClassesTable.$inferSelect;
