import {
  pgTable, text, timestamp, uuid, pgEnum, boolean, integer, numeric, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const typeExamenEnum = pgEnum("type_examen", ["BEPC", "BAC", "blanc", "entrainement"]);

export const niveauExamenEnum = pgEnum("niveau_examen", ["3eme", "Tle"]);

export const statutEpreuveEnum = pgEnum("statut_epreuve", [
  "planifiee",
  "en_cours",
  "terminee",
  "corrigee",
]);

export const statutRevisionEnum = pgEnum("statut_revision", [
  "planifie",
  "fait",
  "saute",
]);

/* ── Bibliothèque de sujets BEPC/BAC ───────────────────────── */
export const sujetsExamensTable = pgTable("sujets_examens", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  ajoute_par: uuid("ajoute_par").notNull(),
  matiere: text("matiere").notNull(),
  titre: text("titre").notNull(),
  type_examen: typeExamenEnum("type_examen").notNull(),
  serie: text("serie"),
  annee: integer("annee"),
  niveau: niveauExamenEnum("niveau").notNull(),
  fichier_url: text("fichier_url").notNull(),
  fichier_nom: text("fichier_nom").notNull(),
  corrige_url: text("corrige_url"),
  corrige_nom: text("corrige_nom"),
  nb_telechargements: integer("nb_telechargements").notNull().default(0),
  publie: boolean("publie").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Épreuves blanches ──────────────────────────────────────── */
export const epreuvesBlanChesTable = pgTable("epreuves_blanches", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  professeur_id: uuid("professeur_id").notNull(),
  classe_id: uuid("classe_id").notNull(),
  matiere: text("matiere").notNull(),
  sujet_id: uuid("sujet_id"),
  titre: text("titre").notNull(),
  type_examen: typeExamenEnum("type_examen").notNull().default("blanc"),
  date_epreuve: text("date_epreuve").notNull(),
  duree_minutes: integer("duree_minutes").notNull(),
  bareme_total: numeric("bareme_total", { precision: 5, scale: 2 }).notNull().default("20"),
  statut: statutEpreuveEnum("statut").notNull().default("planifiee"),
  instructions: text("instructions"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Résultats épreuves blanches ────────────────────────────── */
export const resultatsEpreuvesTable = pgTable(
  "resultats_epreuves",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    epreuve_id: uuid("epreuve_id").notNull(),
    eleve_id: uuid("eleve_id").notNull(),
    note: numeric("note", { precision: 5, scale: 2 }),
    appreciation: text("appreciation"),
    present: boolean("present").notNull().default(true),
    date_correction: text("date_correction"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_resultat_epreuve_eleve").on(t.epreuve_id, t.eleve_id),
  ],
);

/* ── Planning de révision élève ─────────────────────────────── */
export const planningRevisionsTable = pgTable("planning_revisions", {
  id: uuid("id").primaryKey().defaultRandom(),
  eleve_id: uuid("eleve_id").notNull(),
  etablissement_id: uuid("etablissement_id").notNull(),
  matiere: text("matiere").notNull(),
  titre_session: text("titre_session").notNull(),
  date_session: text("date_session").notNull(),
  heure_debut: text("heure_debut").notNull(),
  heure_fin: text("heure_fin").notNull(),
  statut: statutRevisionEnum("statut").notNull().default("planifie"),
  notes_eleve: text("notes_eleve"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSujetExamenSchema = createInsertSchema(sujetsExamensTable).omit({
  id: true, created_at: true, updated_at: true,
});
export const insertEpreuveBlanCheSchema = createInsertSchema(epreuvesBlanChesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export const insertResultatEpreuveSchema = createInsertSchema(resultatsEpreuvesTable).omit({
  id: true, created_at: true, updated_at: true,
});
export const insertPlanningRevisionSchema = createInsertSchema(planningRevisionsTable).omit({
  id: true, created_at: true, updated_at: true,
});

export type SujetExamen = typeof sujetsExamensTable.$inferSelect;
export type EpreuveBlanChe = typeof epreuvesBlanChesTable.$inferSelect;
export type ResultatEpreuve = typeof resultatsEpreuvesTable.$inferSelect;
export type PlanningRevision = typeof planningRevisionsTable.$inferSelect;
export type InsertSujetExamen = z.infer<typeof insertSujetExamenSchema>;
export type InsertEpreuveBlanChe = z.infer<typeof insertEpreuveBlanCheSchema>;
export type InsertResultatEpreuve = z.infer<typeof insertResultatEpreuveSchema>;
export type InsertPlanningRevision = z.infer<typeof insertPlanningRevisionSchema>;
