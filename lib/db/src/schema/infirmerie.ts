import {
  pgTable, text, timestamp, uuid, pgEnum, boolean, integer, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/* ── Enums ──────────────────────────────────────────────────────── */

export const groupeSanguinEnum = pgEnum("groupe_sanguin", [
  "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-",
]);

export const statutConsultationEnum = pgEnum("statut_consultation", [
  "en_cours", "termine", "renvoye_domicile", "hospitalise",
]);

export const categorieStockEnum = pgEnum("categorie_stock", [
  "medicament", "materiel", "consommable",
]);

export const typeMouvementEnum = pgEnum("type_mouvement", [
  "entree", "sortie",
]);

/* ── Dossiers médicaux ──────────────────────────────────────────── */
export const dossiersMedicauxTable = pgTable(
  "dossiers_medicaux",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eleve_id: uuid("eleve_id").notNull(),
    etablissement_id: uuid("etablissement_id").notNull(),
    groupe_sanguin: groupeSanguinEnum("groupe_sanguin"),
    allergies: text("allergies").array(),
    antecedents: text("antecedents"),
    medicaments_autorises: text("medicaments_autorises"),
    medicaments_interdits: text("medicaments_interdits"),
    medecin_nom: text("medecin_nom"),
    medecin_contact: text("medecin_contact"),
    assurance_nom: text("assurance_nom"),
    assurance_numero: text("assurance_numero"),
    contact_urgence_nom: text("contact_urgence_nom"),
    contact_urgence_tel: text("contact_urgence_tel"),
    contact_urgence_lien: text("contact_urgence_lien"),
    observations_generales: text("observations_generales"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_dossier_medical_eleve").on(t.eleve_id),
  ],
);

/* ── Consultations infirmerie ───────────────────────────────────── */
export const consultationsInfirmerieTable = pgTable("consultations_infirmerie", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  eleve_id: uuid("eleve_id").notNull(),
  infirmier_id: uuid("infirmier_id").notNull(),
  motif: text("motif").notNull(),
  symptomes: text("symptomes"),
  traitement_administre: text("traitement_administre"),
  medicaments_donnes: text("medicaments_donnes"),
  heure_entree: timestamp("heure_entree", { withTimezone: true }).notNull(),
  heure_sortie: timestamp("heure_sortie", { withTimezone: true }),
  statut: statutConsultationEnum("statut").notNull().default("en_cours"),
  parent_notifie: boolean("parent_notifie").notNull().default(false),
  observations: text("observations"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Stocks infirmerie ──────────────────────────────────────────── */
export const stocksInfirmerieTable = pgTable("stocks_infirmerie", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  nom: text("nom").notNull(),
  categorie: categorieStockEnum("categorie").notNull(),
  quantite: integer("quantite").notNull().default(0),
  unite: text("unite").notNull(),
  seuil_alerte: integer("seuil_alerte").notNull().default(5),
  date_expiration: timestamp("date_expiration", { withTimezone: true }),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Mouvements stocks ──────────────────────────────────────────── */
export const mouvementsStocksTable = pgTable("mouvements_stocks", {
  id: uuid("id").primaryKey().defaultRandom(),
  stock_id: uuid("stock_id").notNull(),
  consultation_id: uuid("consultation_id"),
  type: typeMouvementEnum("type").notNull(),
  quantite: integer("quantite").notNull(),
  motif: text("motif"),
  effectue_par: uuid("effectue_par").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ── Zod schemas ────────────────────────────────────────────────── */
export const insertDossierMedicalSchema = createInsertSchema(dossiersMedicauxTable).omit({
  id: true, created_at: true, updated_at: true,
});
export const insertConsultationInfirmerieSchema = createInsertSchema(consultationsInfirmerieTable).omit({
  id: true, created_at: true, updated_at: true,
});
export const insertStockInfirmerieSchema = createInsertSchema(stocksInfirmerieTable).omit({
  id: true, created_at: true, updated_at: true,
});
export const insertMouvementStockSchema = createInsertSchema(mouvementsStocksTable).omit({
  id: true, created_at: true,
});

/* ── Types ──────────────────────────────────────────────────────── */
export type DossierMedical = typeof dossiersMedicauxTable.$inferSelect;
export type ConsultationInfirmerie = typeof consultationsInfirmerieTable.$inferSelect;
export type StockInfirmerie = typeof stocksInfirmerieTable.$inferSelect;
export type MouvementStock = typeof mouvementsStocksTable.$inferSelect;
export type InsertDossierMedical = z.infer<typeof insertDossierMedicalSchema>;
export type InsertConsultationInfirmerie = z.infer<typeof insertConsultationInfirmerieSchema>;
export type InsertStockInfirmerie = z.infer<typeof insertStockInfirmerieSchema>;
export type InsertMouvementStock = z.infer<typeof insertMouvementStockSchema>;
