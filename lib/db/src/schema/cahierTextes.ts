import {
  pgTable, text, timestamp, uuid, boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cahierTextesTable = pgTable("cahier_textes", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  professeur_id: uuid("professeur_id").notNull(),
  classe_id: uuid("classe_id").notNull(),
  annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
  matiere: text("matiere").notNull(),
  date_seance: text("date_seance").notNull(),
  creneau_id: uuid("creneau_id"),
  titre_lecon: text("titre_lecon").notNull(),
  contenu_lecon: text("contenu_lecon"),
  travaux_donnes: text("travaux_donnes"),
  devoir_a_rendre: boolean("devoir_a_rendre").notNull().default(false),
  date_remise_devoir: text("date_remise_devoir"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCahierTexteSchema = createInsertSchema(cahierTextesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertCahierTexte = z.infer<typeof insertCahierTexteSchema>;
export type CahierTexte = typeof cahierTextesTable.$inferSelect;
