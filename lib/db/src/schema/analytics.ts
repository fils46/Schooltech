import {
  pgTable, text, timestamp, uuid, pgEnum, integer, jsonb, date,
} from "drizzle-orm/pg-core";

/* ── Enums ──────────────────────────────────────────────────────── */

export const typeRapportEnum = pgEnum("type_rapport", [
  "resultats", "absences", "effectifs", "activite_plateforme", "finances", "personnalise",
]);

export const formatRapportEnum = pgEnum("format_rapport", [
  "pdf", "excel",
]);

export const statutRapportEnum = pgEnum("statut_rapport", [
  "en_cours", "termine", "erreur",
]);

/* ── Rapports générés ──────────────────────────────────────────── */

export const rapportsGeneresTable = pgTable("rapports_generes", {
  id:               uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  genere_par:       uuid("genere_par").notNull(),
  titre:            text("titre").notNull(),
  type:             typeRapportEnum("type").notNull(),
  parametres:       jsonb("parametres"),
  fichier_url:      text("fichier_url"),
  fichier_nom:      text("fichier_nom"),
  format:           formatRapportEnum("format").notNull(),
  statut:           statutRapportEnum("statut").notNull().default("en_cours"),
  created_at:       timestamp("created_at").notNull().defaultNow(),
  updated_at:       timestamp("updated_at").notNull().defaultNow(),
});

/* ── Snapshots analytiques ─────────────────────────────────────── */

export const snapshotsAnalyticsTable = pgTable("snapshots_analytics", {
  id:               uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  annee_scolaire_id:uuid("annee_scolaire_id").notNull(),
  trimestre:        integer("trimestre"),
  date_snapshot:    date("date_snapshot").notNull(),
  donnees:          jsonb("donnees").notNull(),
  created_at:       timestamp("created_at").notNull().defaultNow(),
});
