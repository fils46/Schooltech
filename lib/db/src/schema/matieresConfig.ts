import {
  pgTable, text, timestamp, uuid, unique, integer, boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matieresConfigTable = pgTable(
  "matieres_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    classe_id: uuid("classe_id").notNull(),
    nom_matiere: text("nom_matiere").notNull(),
    coefficient: numeric("coefficient", { precision: 3, scale: 1 }).notNull().default("1"),
    ordre_affichage: integer("ordre_affichage").notNull().default(0),
    professeur_id: uuid("professeur_id"),
    actif: boolean("actif").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_matiere_config_classe_nom_annee").on(
      t.classe_id,
      t.nom_matiere,
      t.annee_scolaire_id
    ),
  ]
);

export const insertMatiereConfigSchema = createInsertSchema(matieresConfigTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertMatiereConfig = z.infer<typeof insertMatiereConfigSchema>;
export type MatiereConfig = typeof matieresConfigTable.$inferSelect;
