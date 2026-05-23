import { pgTable, uuid, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const statutRendezVousEnum = pgEnum("statut_rendez_vous", [
  "en_attente",
  "confirme",
  "annule",
  "termine",
]);

export const rendezVousTable = pgTable("rendez_vous", {
  id:               uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").notNull(),
  parent_id:        uuid("parent_id").notNull(),
  professeur_id:    uuid("professeur_id"),
  directeur_id:     uuid("directeur_id"),
  eleve_id:         uuid("eleve_id").notNull(),
  motif:            text("motif").notNull(),
  date_rdv:         text("date_rdv").notNull(),
  heure_rdv:        text("heure_rdv").notNull(),
  duree_minutes:    integer("duree_minutes").notNull().default(30),
  statut:           statutRendezVousEnum("statut").notNull().default("en_attente"),
  lieu:             text("lieu"),
  notes_rdv:        text("notes_rdv"),
  created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
