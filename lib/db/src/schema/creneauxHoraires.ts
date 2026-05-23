import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const creneauxHorairesTable = pgTable("creneaux_horaires", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  heure_debut: text("heure_debut").notNull(),
  heure_fin: text("heure_fin").notNull(),
  libelle: text("libelle").notNull(),
  ordre: integer("ordre").notNull().default(0),
  actif: boolean("actif").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCreneauHoraireSchema = createInsertSchema(creneauxHorairesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertCreneauHoraire = z.infer<typeof insertCreneauHoraireSchema>;
export type CreneauHoraire = typeof creneauxHorairesTable.$inferSelect;
