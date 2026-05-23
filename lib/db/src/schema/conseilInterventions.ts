import { pgTable, timestamp, uuid, text, pgEnum } from "drizzle-orm/pg-core";

export const typeInterventionEnum = pgEnum("type_intervention", [
  "observation",
  "decision",
  "question",
  "reponse",
  "general",
]);

export const conseilInterventionsTable = pgTable("conseil_interventions", {
  id: uuid("id").primaryKey().defaultRandom(),
  conseil_id: uuid("conseil_id").notNull(),
  eleve_id: uuid("eleve_id"),
  auteur_id: uuid("auteur_id").notNull(),
  contenu: text("contenu").notNull(),
  type: typeInterventionEnum("type").notNull(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ConseilIntervention = typeof conseilInterventionsTable.$inferSelect;
