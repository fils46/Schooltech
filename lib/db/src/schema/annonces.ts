import {
  pgTable, text, uuid, boolean, integer,
  timestamp, pgEnum, unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const annonceTypeEnum = pgEnum("annonce_type", [
  "information",
  "urgence",
  "evenement",
  "rappel",
]);

export const annoncesTable = pgTable("annonces", {
  id:                uuid("id").primaryKey().defaultRandom(),
  etablissement_id:  uuid("etablissement_id").notNull(),
  auteur_id:         uuid("auteur_id").notNull(),
  titre:             text("titre").notNull(),
  contenu:           text("contenu").notNull(),
  type:              annonceTypeEnum("type").notNull().default("information"),
  destinataires:     text("destinataires").array().notNull().default(["tous"]),
  date_publication:  timestamp("date_publication",  { withTimezone: true }),
  date_expiration:   timestamp("date_expiration",   { withTimezone: true }),
  publie:            boolean("publie").notNull().default(false),
  epingle:           boolean("epingle").notNull().default(false),
  piece_jointe_url:  text("piece_jointe_url"),
  piece_jointe_nom:  text("piece_jointe_nom"),
  nb_vues:           integer("nb_vues").notNull().default(0),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const annonceLecturesTable = pgTable(
  "annonce_lectures",
  {
    id:             uuid("id").primaryKey().defaultRandom(),
    annonce_id:     uuid("annonce_id").notNull(),
    utilisateur_id: uuid("utilisateur_id").notNull(),
    lu_le:          timestamp("lu_le", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqueAnnonceLecture: unique("annonce_lectures_annonce_user_unique")
      .on(t.annonce_id, t.utilisateur_id),
  })
);

export const insertAnnonceSchema = createInsertSchema(annoncesTable).omit({
  id: true, nb_vues: true, created_at: true, updated_at: true,
});

export type InsertAnnonce = z.infer<typeof insertAnnonceSchema>;
export type Annonce = typeof annoncesTable.$inferSelect;
export type AnnonceLecture = typeof annonceLecturesTable.$inferSelect;
