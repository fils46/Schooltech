import {
  pgTable, text, timestamp, uuid, unique, pgEnum, json, boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { trimestreEnum } from "./notes";

export const statutConseilEnum = pgEnum("statut_conseil", [
  "planifie",
  "en_cours",
  "termine",
]);

export const conseilsClasseTable = pgTable(
  "conseils_classe",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    classe_id: uuid("classe_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    trimestre: trimestreEnum("trimestre").notNull(),
    date_conseil: text("date_conseil").notNull(),
    heure_debut: text("heure_debut"),
    heure_fin: text("heure_fin"),
    ordre_du_jour: text("ordre_du_jour"),
    president_id: uuid("president_id").notNull(),
    participants: json("participants"),
    observations_generales: text("observations_generales"),
    statut: statutConseilEnum("statut").notNull().default("planifie"),
    convocations_envoyees: boolean("convocations_envoyees").notNull().default(false),
    pv_genere: boolean("pv_genere").notNull().default(false),
    pv_url: text("pv_url"),
    pv_signe_par: uuid("pv_signe_par"),
    pv_date_signature: text("pv_date_signature"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_conseil_classe_annee_trimestre").on(
      t.classe_id,
      t.annee_scolaire_id,
      t.trimestre
    ),
  ]
);

export const insertConseilClasseSchema = createInsertSchema(conseilsClasseTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertConseilClasse = z.infer<typeof insertConseilClasseSchema>;
export type ConseilClasse = typeof conseilsClasseTable.$inferSelect;
