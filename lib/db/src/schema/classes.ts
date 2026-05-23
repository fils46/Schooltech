import { pgTable, text, timestamp, uuid, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const classesTable = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  annee_scolaire_id: uuid("annee_scolaire_id"),
  filiere_id: uuid("filiere_id"),
  titulaire_id: uuid("titulaire_id"),
  nom: text("nom").notNull(),
  niveau: text("niveau").notNull(),
  section: text("section").notNull().default(""),
  annee_scolaire: integer("annee_scolaire").notNull().default(2026),
  capacite_max: integer("capacite_max").default(60),
  actif: boolean("actif").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClasseSchema = createInsertSchema(classesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertClasse = z.infer<typeof insertClasseSchema>;
export type Classe = typeof classesTable.$inferSelect;
