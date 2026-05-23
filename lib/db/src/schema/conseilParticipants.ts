import { pgTable, timestamp, uuid, boolean, pgEnum, unique, text } from "drizzle-orm/pg-core";

export const roleConseilEnum = pgEnum("role_conseil", [
  "president",
  "professeur",
  "delegue_eleves",
  "delegue_parents",
  "censeur",
  "directeur",
]);

export const conseilParticipantsTable = pgTable(
  "conseil_participants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conseil_id: uuid("conseil_id").notNull(),
    utilisateur_id: uuid("utilisateur_id").notNull(),
    role_conseil: roleConseilEnum("role_conseil").notNull(),
    convoque: boolean("convoque").notNull().default(false),
    convocation_envoyee: boolean("convocation_envoyee").notNull().default(false),
    present: boolean("present").notNull().default(false),
    heure_arrivee: text("heure_arrivee"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_conseil_participant").on(t.conseil_id, t.utilisateur_id),
  ]
);

export type ConseilParticipant = typeof conseilParticipantsTable.$inferSelect;
