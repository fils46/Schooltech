import { pgTable, text, timestamp, uuid, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { etablissementsTable } from "./etablissements";

export const typeEtablissementFiliereEnum = pgEnum("type_etablissement_filiere", [
  "lycee",
  "college",
  "mixte",
]);

export const filieresTable = pgTable("filieres", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id")
    .notNull()
    .references(() => etablissementsTable.id, { onDelete: "cascade" }),
  nom: text("nom").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  type_etablissement: typeEtablissementFiliereEnum("type_etablissement"),
  actif: boolean("actif").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFiliereSchema = createInsertSchema(filieresTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertFiliere = z.infer<typeof insertFiliereSchema>;
export type Filiere = typeof filieresTable.$inferSelect;
