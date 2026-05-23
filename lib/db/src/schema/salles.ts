import { pgTable, text, timestamp, uuid, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const typeSalleEnum = pgEnum("type_salle", [
  "classe",
  "laboratoire",
  "salle_info",
  "gymnase",
  "autre",
]);

export const sallesTable = pgTable("salles", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  nom: text("nom").notNull(),
  capacite: integer("capacite"),
  type: typeSalleEnum("type").notNull().default("classe"),
  actif: boolean("actif").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSalleSchema = createInsertSchema(sallesTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertSalle = z.infer<typeof insertSalleSchema>;
export type Salle = typeof sallesTable.$inferSelect;
