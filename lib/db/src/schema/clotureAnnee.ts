import {
  pgTable, text, timestamp, uuid, integer, boolean, numeric, pgEnum, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { etablissementsTable } from "./etablissements";
import { anneesScolairesTable } from "./anneesScolaires";
import { classesTable } from "./classes";
import { utilisateursTable } from "./utilisateurs";
import { conseilsClasseTable } from "./conseilsClasse";

/* ── Enums ─────────────────────────────────────────────────── */

export const decisionFinAnneeEnum = pgEnum("decision_fin_annee", [
  "admis",
  "redoublant",
  "exclu",
  "oriente_sortie",
  "admis_avec_reserve",
]);

export const statutPromotionEnum = pgEnum("statut_promotion", [
  "en_cours",
  "terminee",
  "annulee",
]);

/* ── criteres_admission ────────────────────────────────────── */

export const criteresAdmissionTable = pgTable("criteres_admission", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id")
    .notNull()
    .references(() => etablissementsTable.id, { onDelete: "cascade" }),
  annee_scolaire_id: uuid("annee_scolaire_id")
    .notNull()
    .references(() => anneesScolairesTable.id, { onDelete: "cascade" }),
  classe_id: uuid("classe_id").references(() => classesTable.id, { onDelete: "cascade" }),
  moyenne_admission: numeric("moyenne_admission", { precision: 5, scale: 2 })
    .notNull()
    .default("10.00"),
  nb_matieres_eliminatoires_max: integer("nb_matieres_eliminatoires_max")
    .notNull()
    .default(0),
  moyenne_eliminatoire: numeric("moyenne_eliminatoire", { precision: 5, scale: 2 })
    .default("5.00"),
  conseil_obligatoire: boolean("conseil_obligatoire").notNull().default(true),
  notes_criteres: text("notes_criteres"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCritereAdmissionSchema = createInsertSchema(criteresAdmissionTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertCritereAdmission = z.infer<typeof insertCritereAdmissionSchema>;
export type CritereAdmission = typeof criteresAdmissionTable.$inferSelect;

/* ── decisions_fin_annee ───────────────────────────────────── */

export const decisionsFinAnneeTable = pgTable(
  "decisions_fin_annee",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id")
      .notNull()
      .references(() => etablissementsTable.id, { onDelete: "cascade" }),
    eleve_id: uuid("eleve_id").notNull(),
    classe_id: uuid("classe_id")
      .notNull()
      .references(() => classesTable.id),
    annee_scolaire_id: uuid("annee_scolaire_id")
      .notNull()
      .references(() => anneesScolairesTable.id),
    moyenne_annuelle: numeric("moyenne_annuelle", { precision: 5, scale: 2 }),
    decision: decisionFinAnneeEnum("decision").notNull(),
    classe_destination_id: uuid("classe_destination_id").references(() => classesTable.id),
    filiere_destination_id: uuid("filiere_destination_id"),
    motif: text("motif"),
    decidee_par: uuid("decidee_par")
      .notNull()
      .references(() => utilisateursTable.id),
    date_decision: text("date_decision").notNull(),
    conseil_classe_id: uuid("conseil_classe_id").references(() => conseilsClasseTable.id),
    parent_notifie: boolean("parent_notifie").notNull().default(false),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_decision_eleve_annee").on(t.eleve_id, t.annee_scolaire_id)]
);

export const insertDecisionFinAnneeSchema = createInsertSchema(decisionsFinAnneeTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertDecisionFinAnnee = z.infer<typeof insertDecisionFinAnneeSchema>;
export type DecisionFinAnnee = typeof decisionsFinAnneeTable.$inferSelect;

/* ── promotions ────────────────────────────────────────────── */

export const promotionsTable = pgTable("promotions", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id")
    .notNull()
    .references(() => etablissementsTable.id, { onDelete: "cascade" }),
  annee_scolaire_source_id: uuid("annee_scolaire_source_id")
    .notNull()
    .references(() => anneesScolairesTable.id),
  annee_scolaire_destination_id: uuid("annee_scolaire_destination_id")
    .notNull()
    .references(() => anneesScolairesTable.id),
  classe_source_id: uuid("classe_source_id")
    .notNull()
    .references(() => classesTable.id),
  classe_destination_id: uuid("classe_destination_id")
    .notNull()
    .references(() => classesTable.id),
  nb_eleves_promus: integer("nb_eleves_promus").notNull().default(0),
  nb_eleves_redoublants: integer("nb_eleves_redoublants").notNull().default(0),
  nb_eleves_exclus: integer("nb_eleves_exclus").notNull().default(0),
  nb_eleves_sortie: integer("nb_eleves_sortie").notNull().default(0),
  effectuee_par: uuid("effectuee_par")
    .notNull()
    .references(() => utilisateursTable.id),
  date_promotion: timestamp("date_promotion", { withTimezone: true }).notNull().defaultNow(),
  statut: statutPromotionEnum("statut").notNull().default("en_cours"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPromotionSchema = createInsertSchema(promotionsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Promotion = typeof promotionsTable.$inferSelect;
