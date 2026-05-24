import {
  pgTable, text, timestamp, uuid, boolean, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { etablissementsTable } from "./etablissements";

export const matieresTable = pgTable(
  "matieres",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id")
      .notNull()
      .references(() => etablissementsTable.id, { onDelete: "cascade" }),
    nom: text("nom").notNull(),
    code: text("code").notNull(),
    couleur: text("couleur"),
    actif: boolean("actif").notNull().default(true),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_matiere_etab_code").on(t.etablissement_id, t.code),
  ]
);

export const insertMatiereSchema = createInsertSchema(matieresTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertMatiere = z.infer<typeof insertMatiereSchema>;
export type Matiere = typeof matieresTable.$inferSelect;
