import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const classesTable = pgTable("classes", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  nom: text("nom").notNull(),
  niveau: text("niveau").notNull(),
  section: text("section").notNull(),
  annee_scolaire: integer("annee_scolaire").notNull(),
  capacite_max: integer("capacite_max"),
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
