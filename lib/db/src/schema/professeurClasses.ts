import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const professeurClassesTable = pgTable(
  "professeur_classes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    professeur_id: uuid("professeur_id").notNull(),
    classe_id: uuid("classe_id").notNull(),
    matiere: text("matiere").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_prof_classe_matiere_annee").on(
      t.professeur_id,
      t.classe_id,
      t.matiere,
      t.annee_scolaire_id
    ),
  ]
);

export const insertProfesseurClasseSchema = createInsertSchema(professeurClassesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertProfesseurClasse = z.infer<typeof insertProfesseurClasseSchema>;
export type ProfesseurClasse = typeof professeurClassesTable.$inferSelect;
