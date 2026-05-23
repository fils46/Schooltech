import {
  pgTable, text, timestamp, uuid, pgEnum, boolean, numeric, date, jsonb, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { modePaiementEnum } from "./paiementsLicences";

export { modePaiementEnum };

/* ── Enums ──────────────────────────────────────────────────────── */

export const niveauScolariteEnum = pgEnum("niveau_scolarite", [
  "6eme", "5eme", "4eme", "3eme", "2nde", "1ere", "terminale",
]);

export const statutScolariteEnum = pgEnum("statut_scolarite", [
  "en_regle", "partiel", "impaye",
]);

export const typePaiementScolariteEnum = pgEnum("type_paiement_scolarite", [
  "inscription", "tranche1", "tranche2", "tranche3", "autre",
]);

export const typeRelanceScolariteEnum = pgEnum("type_relance_scolarite", [
  "notification", "email", "les_deux",
]);

/* ── frais_config ────────────────────────────────────────────────── */

export const fraisConfigTable = pgTable(
  "frais_config",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    niveau: niveauScolariteEnum("niveau").notNull(),
    filiere_id: uuid("filiere_id"),
    frais_inscription: numeric("frais_inscription", { precision: 10, scale: 2 }).notNull().default("0"),
    frais_scolarite_annuel: numeric("frais_scolarite_annuel", { precision: 10, scale: 2 }).notNull(),
    frais_tranche1: numeric("frais_tranche1", { precision: 10, scale: 2 }).notNull(),
    frais_tranche2: numeric("frais_tranche2", { precision: 10, scale: 2 }).notNull(),
    frais_tranche3: numeric("frais_tranche3", { precision: 10, scale: 2 }).notNull(),
    date_limite_tranche1: date("date_limite_tranche1"),
    date_limite_tranche2: date("date_limite_tranche2"),
    date_limite_tranche3: date("date_limite_tranche3"),
    autres_frais: jsonb("autres_frais"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_frais_config").on(t.etablissement_id, t.annee_scolaire_id, t.niveau),
  ],
);

/* ── scolarite_eleve ─────────────────────────────────────────────── */

export const scolariteEleveTable = pgTable(
  "scolarite_eleve",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    eleve_id: uuid("eleve_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    frais_config_id: uuid("frais_config_id").notNull(),
    montant_total_du: numeric("montant_total_du", { precision: 10, scale: 2 }).notNull(),
    montant_total_paye: numeric("montant_total_paye", { precision: 10, scale: 2 }).notNull().default("0"),
    montant_restant: numeric("montant_restant", { precision: 10, scale: 2 }).notNull(),
    inscription_payee: boolean("inscription_payee").notNull().default(false),
    tranche1_payee: boolean("tranche1_payee").notNull().default(false),
    tranche2_payee: boolean("tranche2_payee").notNull().default(false),
    tranche3_payee: boolean("tranche3_payee").notNull().default(false),
    statut: statutScolariteEnum("statut").notNull().default("impaye"),
    observations: text("observations"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_scolarite_eleve").on(t.eleve_id, t.annee_scolaire_id),
  ],
);

/* ── paiements_scolarite ─────────────────────────────────────────── */

export const paiementsScolariteTable = pgTable("paiements_scolarite", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  eleve_id: uuid("eleve_id").notNull(),
  scolarite_id: uuid("scolarite_id").notNull(),
  enregistre_par: uuid("enregistre_par").notNull(),
  numero_recu: text("numero_recu").notNull().unique(),
  montant: numeric("montant", { precision: 10, scale: 2 }).notNull(),
  mode_paiement: modePaiementEnum("mode_paiement").notNull(),
  reference_paiement: text("reference_paiement"),
  type_paiement: typePaiementScolariteEnum("type_paiement").notNull(),
  date_paiement: date("date_paiement").notNull(),
  observations: text("observations"),
  annule: boolean("annule").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── relances_scolarite ──────────────────────────────────────────── */

export const relancesScolariteTable = pgTable("relances_scolarite", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  eleve_id: uuid("eleve_id").notNull(),
  scolarite_id: uuid("scolarite_id").notNull(),
  type_relance: typeRelanceScolariteEnum("type_relance").notNull(),
  motif: text("motif"),
  envoye_par: uuid("envoye_par").notNull(),
  date_relance: timestamp("date_relance", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Zod schemas ─────────────────────────────────────────────────── */

export const insertFraisConfigSchema = createInsertSchema(fraisConfigTable).omit({
  id: true, created_at: true, updated_at: true,
});
export const insertScolariteEleveSchema = createInsertSchema(scolariteEleveTable).omit({
  id: true, created_at: true, updated_at: true,
});
export const insertPaiementScolariteSchema = createInsertSchema(paiementsScolariteTable).omit({
  id: true, created_at: true, updated_at: true,
});
export const insertRelanceScolariteSchema = createInsertSchema(relancesScolariteTable).omit({
  id: true, created_at: true,
});

/* ── Types ───────────────────────────────────────────────────────── */

export type FraisConfig = typeof fraisConfigTable.$inferSelect;
export type ScolariteEleve = typeof scolariteEleveTable.$inferSelect;
export type PaiementScolarite = typeof paiementsScolariteTable.$inferSelect;
export type RelanceScolarite = typeof relancesScolariteTable.$inferSelect;
export type InsertFraisConfig = z.infer<typeof insertFraisConfigSchema>;
export type InsertScolariteEleve = z.infer<typeof insertScolariteEleveSchema>;
export type InsertPaiementScolarite = z.infer<typeof insertPaiementScolariteSchema>;
export type InsertRelanceScolarite = z.infer<typeof insertRelanceScolariteSchema>;
