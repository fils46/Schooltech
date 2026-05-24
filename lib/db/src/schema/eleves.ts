import { pgTable, text, timestamp, uuid, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const elevesTable = pgTable("eleves", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  utilisateur_id: uuid("utilisateur_id"),
  matricule: text("matricule").unique(),
  matricule_statut: text("matricule_statut").notNull().default("en_attente"),
  matricule_provisoire: text("matricule_provisoire"),
  nom: text("nom").notNull(),
  prenoms: text("prenoms").notNull(),
  date_naissance: text("date_naissance").notNull(),
  lieu_naissance: text("lieu_naissance"),
  sexe: text("sexe").notNull(),
  photo_url: text("photo_url"),
  adresse: text("adresse"),
  situation_familiale: text("situation_familiale"),
  annee_inscription: integer("annee_inscription").notNull(),
  statut: text("statut").notNull().default("actif"),
  historique_statut: jsonb("historique_statut")
    .$type<Array<{ statut: string; motif?: string; date: string }>>()
    .default([]),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEleveSchema = createInsertSchema(elevesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
  historique_statut: true,
});

export type InsertEleve = z.infer<typeof insertEleveSchema>;
export type Eleve = typeof elevesTable.$inferSelect;
