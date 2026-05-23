import {
  pgTable, text, timestamp, uuid, pgEnum, boolean, integer, unique, date, time,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/* ── Enums ──────────────────────────────────────────────────────────────── */

export const categorieClubEnum = pgEnum("categorie_club", [
  "sport", "culture", "science", "art", "religion", "autre",
]);

export const statutMembreClubEnum = pgEnum("statut_membre_club", [
  "en_attente", "accepte", "refuse", "suspendu",
]);

export const roleMembreClubEnum = pgEnum("role_membre_club", [
  "membre", "delegue", "capitaine", "secretaire", "tresorier",
]);

export const typeActiviteClubEnum = pgEnum("type_activite_club", [
  "seance", "competition", "sortie", "evenement", "reunion",
]);

export const statutActiviteClubEnum = pgEnum("statut_activite_club", [
  "planifiee", "en_cours", "terminee", "annulee",
]);

/* ── Clubs ──────────────────────────────────────────────────────────────── */

export const clubsTable = pgTable("clubs", {
  id:                uuid("id").primaryKey().defaultRandom(),
  etablissement_id:  uuid("etablissement_id").notNull(),
  responsable_id:    uuid("responsable_id").notNull(),
  nom:               text("nom").notNull(),
  description:       text("description"),
  categorie:         categorieClubEnum("categorie").notNull(),
  logo_url:          text("logo_url"),
  couleur:           text("couleur"),
  capacite_max:      integer("capacite_max"),
  annee_scolaire_id: uuid("annee_scolaire_id").notNull(),
  actif:             boolean("actif").notNull().default(true),
  created_at:        timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:        timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertClubSchema = createInsertSchema(clubsTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertClub = z.infer<typeof insertClubSchema>;
export type Club = typeof clubsTable.$inferSelect;

/* ── Club Membres ───────────────────────────────────────────────────────── */

export const clubMembresTable = pgTable(
  "club_membres",
  {
    id:               uuid("id").primaryKey().defaultRandom(),
    club_id:          uuid("club_id").notNull(),
    eleve_id:         uuid("eleve_id").notNull(),
    statut:           statutMembreClubEnum("statut").notNull().default("en_attente"),
    date_inscription: date("date_inscription").notNull(),
    date_acceptation: date("date_acceptation"),
    role_membre:      roleMembreClubEnum("role_membre").notNull().default("membre"),
    distinctions:     text("distinctions"),
    created_at:       timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_club_membre").on(t.club_id, t.eleve_id),
  ],
);

export const insertClubMembreSchema = createInsertSchema(clubMembresTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertClubMembre = z.infer<typeof insertClubMembreSchema>;
export type ClubMembre = typeof clubMembresTable.$inferSelect;

/* ── Activités Club ─────────────────────────────────────────────────────── */

export const activitesClubTable = pgTable("activites_club", {
  id:                 uuid("id").primaryKey().defaultRandom(),
  club_id:            uuid("club_id").notNull(),
  etablissement_id:   uuid("etablissement_id").notNull(),
  titre:              text("titre").notNull(),
  description:        text("description"),
  type:               typeActiviteClubEnum("type").notNull(),
  date_activite:      date("date_activite").notNull(),
  heure_debut:        time("heure_debut").notNull(),
  heure_fin:          time("heure_fin"),
  lieu:               text("lieu"),
  statut:             statutActiviteClubEnum("statut").notNull().default("planifiee"),
  notes_compte_rendu: text("notes_compte_rendu"),
  created_at:         timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:         timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertActiviteClubSchema = createInsertSchema(activitesClubTable).omit({
  id: true, created_at: true, updated_at: true,
});
export type InsertActiviteClub = z.infer<typeof insertActiviteClubSchema>;
export type ActiviteClub = typeof activitesClubTable.$inferSelect;

/* ── Présences Club ─────────────────────────────────────────────────────── */

export const presencesClubTable = pgTable(
  "presences_club",
  {
    id:              uuid("id").primaryKey().defaultRandom(),
    activite_id:     uuid("activite_id").notNull(),
    eleve_id:        uuid("eleve_id").notNull(),
    present:         boolean("present").notNull().default(false),
    motif_absence:   text("motif_absence"),
    created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_presence_club").on(t.activite_id, t.eleve_id),
  ],
);

export const insertPresenceClubSchema = createInsertSchema(presencesClubTable).omit({
  id: true, created_at: true,
});
export type InsertPresenceClub = z.infer<typeof insertPresenceClubSchema>;
export type PresenceClub = typeof presencesClubTable.$inferSelect;

/* ── Distinctions Club ──────────────────────────────────────────────────── */

export const distinctionsClubTable = pgTable("distinctions_club", {
  id:              uuid("id").primaryKey().defaultRandom(),
  club_id:         uuid("club_id").notNull(),
  eleve_id:        uuid("eleve_id").notNull(),
  titre:           text("titre").notNull(),
  description:     text("description"),
  date_obtention:  date("date_obtention").notNull(),
  decerne_par:     uuid("decerne_par").notNull(),
  created_at:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDistinctionClubSchema = createInsertSchema(distinctionsClubTable).omit({
  id: true, created_at: true,
});
export type InsertDistinctionClub = z.infer<typeof insertDistinctionClubSchema>;
export type DistinctionClub = typeof distinctionsClubTable.$inferSelect;
