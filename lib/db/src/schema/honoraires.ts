import {
  pgTable, text, timestamp, uuid, pgEnum, boolean, numeric, date, integer, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/* ── Enums ──────────────────────────────────────────────────────── */

export const statutFeuilleEnum = pgEnum("statut_feuille", [
  "brouillon", "soumise", "validee", "payee", "rejetee",
]);

export const modePaiementHonorairesEnum = pgEnum("mode_paiement_honoraires", [
  "virement", "mobile_money", "especes", "cheque",
]);

export const categoriePrestation = pgEnum("categorie_prestation", [
  "sortie", "document", "club", "autre",
]);

export const statutFactureEnum = pgEnum("statut_facture_prestation", [
  "en_attente", "paye", "annule",
]);

export const modePaiementPrestationEnum = pgEnum("mode_paiement_prestation", [
  "especes", "mobile_money", "virement", "cheque",
]);

/* ── types_professeurs ───────────────────────────────────────────── */

export const typesProfesseursTable = pgTable("types_professeurs", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  libelle: text("libelle").notNull(),
  taux_horaire: numeric("taux_horaire", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  actif: boolean("actif").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── contrats_professeurs ────────────────────────────────────────── */

export const contratsProfesseursTable = pgTable(
  "contrats_professeurs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    professeur_id: uuid("professeur_id").notNull(),
    type_professeur_id: uuid("type_professeur_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    taux_horaire_personnalise: numeric("taux_horaire_personnalise", { precision: 10, scale: 2 }),
    nb_heures_contractuelles: numeric("nb_heures_contractuelles", { precision: 8, scale: 2 }),
    date_debut: date("date_debut").notNull(),
    date_fin: date("date_fin"),
    actif: boolean("actif").notNull().default(true),
    notes: text("notes"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_contrat_prof_annee").on(t.professeur_id, t.annee_scolaire_id),
  ],
);

/* ── feuilles_heures ─────────────────────────────────────────────── */

export const feuillesHeuresTable = pgTable(
  "feuilles_heures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    professeur_id: uuid("professeur_id").notNull(),
    contrat_id: uuid("contrat_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    mois: integer("mois").notNull(),
    annee: integer("annee").notNull(),
    nb_heures_effectuees: numeric("nb_heures_effectuees", { precision: 8, scale: 2 }).notNull().default("0"),
    nb_heures_validees: numeric("nb_heures_validees", { precision: 8, scale: 2 }),
    montant_brut: numeric("montant_brut", { precision: 10, scale: 2 }),
    montant_net: numeric("montant_net", { precision: 10, scale: 2 }),
    statut: statutFeuilleEnum("statut").notNull().default("brouillon"),
    date_soumission: date("date_soumission"),
    date_validation: date("date_validation"),
    date_paiement: date("date_paiement"),
    valide_par: uuid("valide_par"),
    mode_paiement: modePaiementHonorairesEnum("mode_paiement"),
    reference_paiement: text("reference_paiement"),
    notes_professeur: text("notes_professeur"),
    notes_admin: text("notes_admin"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_feuille_prof_mois_annee").on(t.professeur_id, t.mois, t.annee, t.annee_scolaire_id),
  ],
);

/* ── prestations_services ────────────────────────────────────────── */

export const prestationsServicesTable = pgTable("prestations_services", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  libelle: text("libelle").notNull(),
  categorie: categoriePrestation("categorie").notNull(),
  montant: numeric("montant", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  actif: boolean("actif").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── factures_prestations ────────────────────────────────────────── */

export const facturesPrestationsTable = pgTable("factures_prestations", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  prestation_id: uuid("prestation_id").notNull(),
  eleve_id: uuid("eleve_id").notNull(),
  annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
  montant: numeric("montant", { precision: 10, scale: 2 }).notNull(),
  statut: statutFactureEnum("statut").notNull().default("en_attente"),
  date_emission: date("date_emission").notNull(),
  date_paiement: date("date_paiement"),
  mode_paiement: modePaiementPrestationEnum("mode_paiement"),
  reference_paiement: text("reference_paiement"),
  note: text("note"),
  enregistre_par: uuid("enregistre_par").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Zod schemas ─────────────────────────────────────────────────── */

export const insertTypeProfesseurSchema = createInsertSchema(typesProfesseursTable).omit({
  id: true, created_at: true, updated_at: true,
});

export const insertContratProfesseurSchema = createInsertSchema(contratsProfesseursTable).omit({
  id: true, created_at: true, updated_at: true,
});

export const insertFeuilleHeuresSchema = createInsertSchema(feuillesHeuresTable).omit({
  id: true, created_at: true, updated_at: true,
});

export const insertPrestationServiceSchema = createInsertSchema(prestationsServicesTable).omit({
  id: true, created_at: true, updated_at: true,
});

export const insertFacturePrestationSchema = createInsertSchema(facturesPrestationsTable).omit({
  id: true, created_at: true, updated_at: true,
});

/* ── Types ───────────────────────────────────────────────────────── */

export type TypeProfesseur = typeof typesProfesseursTable.$inferSelect;
export type ContratProfesseur = typeof contratsProfesseursTable.$inferSelect;
export type FeuilleHeures = typeof feuillesHeuresTable.$inferSelect;
export type PrestationService = typeof prestationsServicesTable.$inferSelect;
export type FacturePrestation = typeof facturesPrestationsTable.$inferSelect;

export type InsertTypeProfesseur = z.infer<typeof insertTypeProfesseurSchema>;
export type InsertContratProfesseur = z.infer<typeof insertContratProfesseurSchema>;
export type InsertFeuilleHeures = z.infer<typeof insertFeuilleHeuresSchema>;
export type InsertPrestationService = z.infer<typeof insertPrestationServiceSchema>;
export type InsertFacturePrestation = z.infer<typeof insertFacturePrestationSchema>;
