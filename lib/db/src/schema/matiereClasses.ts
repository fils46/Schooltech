import {
  pgTable, timestamp, uuid, boolean, numeric, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matieresTable } from "./matieres";
import { classesTable } from "./classes";
import { anneesScolairesTable } from "./anneesScolaires";

export const matiereClassesTable = pgTable(
  "matiere_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    matiere_id: uuid("matiere_id")
      .notNull()
      .references(() => matieresTable.id, { onDelete: "cascade" }),
    classe_id: uuid("classe_id")
      .notNull()
      .references(() => classesTable.id, { onDelete: "cascade" }),
    annee_scolaire_id: uuid("annee_scolaire_id")
      .notNull()
      .references(() => anneesScolairesTable.id, { onDelete: "cascade" }),
    coefficient: numeric("coefficient", { precision: 4, scale: 2 }).notNull().default("1"),
    nb_heures_semaine: numeric("nb_heures_semaine", { precision: 4, scale: 1 }),
    est_eliminatoire: boolean("est_eliminatoire").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_matiere_classe_annee").on(t.matiere_id, t.classe_id, t.annee_scolaire_id),
  ]
);

export const insertMatiereClasseSchema = createInsertSchema(matiereClassesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertMatiereClasse = z.infer<typeof insertMatiereClasseSchema>;
export type MatiereClasse = typeof matiereClassesTable.$inferSelect;
