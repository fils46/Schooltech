import {
  pgTable, text, timestamp, uuid, pgEnum, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const appelStatutEnum = pgEnum("appel_statut", ["en_cours", "termine"]);

export const appelsTable = pgTable(
  "appels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    professeur_id: uuid("professeur_id").notNull(),
    classe_id: uuid("classe_id").notNull(),
    matiere: text("matiere").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    date_appel: text("date_appel").notNull(),
    creneau_id: uuid("creneau_id"),
    statut: appelStatutEnum("statut").notNull().default("en_cours"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_appel_classe_matiere_date_creneau").on(
      t.classe_id,
      t.matiere,
      t.date_appel,
      t.creneau_id
    ),
  ]
);

export const insertAppelSchema = createInsertSchema(appelsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertAppel = z.infer<typeof insertAppelSchema>;
export type Appel = typeof appelsTable.$inferSelect;
