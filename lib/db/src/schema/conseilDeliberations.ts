import {
  pgTable, timestamp, uuid, text, boolean, integer, numeric, pgEnum, unique,
} from "drizzle-orm/pg-core";

export const decisionDeliberationEnum = pgEnum("decision_deliberation", [
  "passage",
  "redoublement",
  "exclusion",
  "orientation",
  "felicitations",
  "encouragements",
  "avertissement",
  "blame",
]);

export const conseilDeliberationsTable = pgTable(
  "conseil_deliberations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conseil_id: uuid("conseil_id").notNull(),
    eleve_id: uuid("eleve_id").notNull(),
    moyenne_generale: numeric("moyenne_generale", { precision: 5, scale: 2 }),
    rang: integer("rang"),
    nb_absences: integer("nb_absences").notNull().default(0),
    nb_absences_justifiees: integer("nb_absences_justifiees").notNull().default(0),
    appreciation_generale: text("appreciation_generale"),
    decision: decisionDeliberationEnum("decision"),
    mention_honneur: boolean("mention_honneur").notNull().default(false),
    observations: text("observations"),
    saisi_par: uuid("saisi_par"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_conseil_deliberation_eleve").on(t.conseil_id, t.eleve_id),
  ]
);

export type ConseilDeliberation = typeof conseilDeliberationsTable.$inferSelect;
