import { pgTable, text, boolean, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const etablissementsTable = pgTable("etablissements", {
  id: uuid("id").primaryKey().defaultRandom(),
  nom: text("nom").notNull(),
  type: text("type"),
  ville: text("ville"),
  telephone: text("telephone"),
  email: text("email"),
  logo_url: text("logo_url"),
  adresse: text("adresse"),
  nombre_eleves_max: integer("nombre_eleves_max").default(500),
  licence_active: boolean("licence_active").notNull().default(true),
  date_expiration_licence: text("date_expiration_licence"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEtablissementSchema = createInsertSchema(etablissementsTable).omit({
  id: true,
  created_at: true,
});

export type InsertEtablissement = z.infer<typeof insertEtablissementSchema>;
export type Etablissement = typeof etablissementsTable.$inferSelect;
