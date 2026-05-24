import { pgTable, text, timestamp, uuid, boolean, date, json, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { etablissementsTable } from "./etablissements";

export const statutAnneeEnum = pgEnum("statut_annee_scolaire", [
  "a_venir",
  "en_cours",
  "cloturee",
]);

export const anneesScolairesTable = pgTable("annees_scolaires", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id")
    .notNull()
    .references(() => etablissementsTable.id, { onDelete: "cascade" }),
  libelle: text("libelle").notNull(),
  date_debut: date("date_debut").notNull(),
  date_fin: date("date_fin").notNull(),
  est_active: boolean("est_active").notNull().default(false),
  statut: statutAnneeEnum("statut").notNull().default("a_venir"),
  trimestres: json("trimestres").$type<Array<{
    numero: 1 | 2 | 3;
    date_debut: string;
    date_fin: string;
  }>>(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAnneeScolaireSchema = createInsertSchema(anneesScolairesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertAnneeScolaire = z.infer<typeof insertAnneeScolaireSchema>;
export type AnneeScolaire = typeof anneesScolairesTable.$inferSelect;
