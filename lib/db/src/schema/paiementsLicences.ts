import {
  pgTable, text, boolean, timestamp, uuid, numeric, date, pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const modePaiementEnum = pgEnum("mode_paiement", [
  "virement", "mobile_money", "especes", "cheque", "autre",
]);

export const statutPaiementEnum = pgEnum("statut_paiement", [
  "en_attente", "confirme", "echec",
]);

export const paiementsLicencesTable = pgTable("paiements_licences", {
  id:               uuid("id").primaryKey().defaultRandom(),
  licence_id:       uuid("licence_id").notNull(),
  etablissement_id: uuid("etablissement_id").notNull(),
  montant:          numeric("montant", { precision: 12, scale: 2 }).notNull(),
  date_paiement:    date("date_paiement").notNull(),
  mode_paiement:    modePaiementEnum("mode_paiement").notNull(),
  reference:        text("reference"),
  statut:           statutPaiementEnum("statut").notNull().default("en_attente"),
  note:             text("note"),
  enregistre_par:   uuid("enregistre_par").notNull(),
  created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPaiementLicenceSchema = createInsertSchema(paiementsLicencesTable).omit({
  id: true, created_at: true, updated_at: true,
});

export type PaiementLicence = typeof paiementsLicencesTable.$inferSelect;
export type InsertPaiementLicence = z.infer<typeof insertPaiementLicenceSchema>;
