import {
  pgTable, text, timestamp, uuid, boolean, pgEnum, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jourSemaineEnum = pgEnum("jour_semaine", [
  "lundi",
  "mardi",
  "mercredi",
  "jeudi",
  "vendredi",
  "samedi",
]);

export const emploisDuTempsTable = pgTable(
  "emplois_du_temps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    classe_id: uuid("classe_id").notNull(),
    professeur_id: uuid("professeur_id").notNull(),
    salle_id: uuid("salle_id"),
    matiere: text("matiere").notNull(),
    jour: jourSemaineEnum("jour").notNull(),
    creneau_id: uuid("creneau_id").notNull(),
    couleur: text("couleur"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_prof_jour_creneau_annee").on(
      t.professeur_id, t.jour, t.creneau_id, t.annee_scolaire_id
    ),
    unique("uq_classe_jour_creneau_annee").on(
      t.classe_id, t.jour, t.creneau_id, t.annee_scolaire_id
    ),
  ]
);

export const insertEmploiDuTempsSchema = createInsertSchema(emploisDuTempsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertEmploiDuTemps = z.infer<typeof insertEmploiDuTempsSchema>;
export type EmploiDuTemps = typeof emploisDuTempsTable.$inferSelect;
