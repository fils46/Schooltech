import {
  pgTable, text, timestamp, uuid, unique, integer, boolean,
  numeric, pgEnum,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { trimestreEnum } from "./notes";

export const mentionEnum = pgEnum("mention", [
  "tres_bien",
  "bien",
  "assez_bien",
  "passable",
  "insuffisant",
]);

export const decisionConseilEnum = pgEnum("decision_conseil", [
  "passage",
  "redoublement",
  "exclusion",
  "orientation",
]);

export const bulletinsTable = pgTable(
  "bulletins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    eleve_id: uuid("eleve_id").notNull(),
    classe_id: uuid("classe_id").notNull(),
    annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
    trimestre: trimestreEnum("trimestre").notNull(),
    moyenne_generale: numeric("moyenne_generale", { precision: 5, scale: 2 }),
    rang: integer("rang"),
    effectif_classe: integer("effectif_classe"),
    mention: mentionEnum("mention"),
    appreciation_conseil: text("appreciation_conseil"),
    decision_conseil: decisionConseilEnum("decision_conseil"),
    publie: boolean("publie").notNull().default(false),
    date_publication: text("date_publication"),
    valide_par: uuid("valide_par"),
    date_validation: text("date_validation"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_bulletin_eleve_classe_annee_trimestre").on(
      t.eleve_id,
      t.classe_id,
      t.annee_scolaire_id,
      t.trimestre
    ),
  ]
);

export const insertBulletinSchema = createInsertSchema(bulletinsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertBulletin = z.infer<typeof insertBulletinSchema>;
export type Bulletin = typeof bulletinsTable.$inferSelect;
