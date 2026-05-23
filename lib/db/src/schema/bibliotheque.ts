import {
  pgTable, text, timestamp, uuid, pgEnum, boolean, integer, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const typeRessourceEnum = pgEnum("type_ressource", [
  "manuel", "fiche_cours", "exercice", "video", "document_officiel", "autre",
]);

export const actionHistoriqueEnum = pgEnum("action_historique", [
  "consultation", "telechargement",
]);

/* ── Ressources bibliothèque ────────────────────────────────── */
export const ressourcesTable = pgTable("ressources", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  ajoute_par: uuid("ajoute_par").notNull(),
  matiere_id: uuid("matiere_id"),
  titre: text("titre").notNull(),
  auteur: text("auteur"),
  description: text("description"),
  type: typeRessourceEnum("type").notNull(),
  niveau: text("niveau").array().notNull(),
  fichier_url: text("fichier_url").notNull(),
  fichier_nom: text("fichier_nom").notNull(),
  fichier_taille: integer("fichier_taille"),
  fichier_type: text("fichier_type"),
  couverture_url: text("couverture_url"),
  mots_cles: text("mots_cles").array(),
  langue: text("langue").notNull().default("fr"),
  publie: boolean("publie").notNull().default(false),
  valide: boolean("valide").notNull().default(false),
  nb_consultations: integer("nb_consultations").notNull().default(0),
  nb_telechargements: integer("nb_telechargements").notNull().default(0),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Favoris ressources ─────────────────────────────────────── */
export const ressourceFavorisTable = pgTable(
  "ressource_favoris",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ressource_id: uuid("ressource_id").notNull(),
    utilisateur_id: uuid("utilisateur_id").notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_ressource_favori").on(t.ressource_id, t.utilisateur_id),
  ],
);

/* ── Historique consultations/téléchargements ───────────────── */
export const ressourceHistoriqueTable = pgTable("ressource_historique", {
  id: uuid("id").primaryKey().defaultRandom(),
  ressource_id: uuid("ressource_id").notNull(),
  utilisateur_id: uuid("utilisateur_id").notNull(),
  action: actionHistoriqueEnum("action").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRessourceSchema = createInsertSchema(ressourcesTable).omit({
  id: true, created_at: true, updated_at: true,
  nb_consultations: true, nb_telechargements: true,
});
export const insertRessourceFavoriSchema = createInsertSchema(ressourceFavorisTable).omit({
  id: true, created_at: true,
});
export const insertRessourceHistoriqueSchema = createInsertSchema(ressourceHistoriqueTable).omit({
  id: true, created_at: true,
});

export type Ressource = typeof ressourcesTable.$inferSelect;
export type RessourceFavori = typeof ressourceFavorisTable.$inferSelect;
export type RessourceHistorique = typeof ressourceHistoriqueTable.$inferSelect;
export type InsertRessource = z.infer<typeof insertRessourceSchema>;
export type InsertRessourceFavori = z.infer<typeof insertRessourceFavoriSchema>;
export type InsertRessourceHistorique = z.infer<typeof insertRessourceHistoriqueSchema>;
