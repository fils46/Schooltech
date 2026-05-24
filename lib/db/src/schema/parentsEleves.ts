import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const parentsElevesTable = pgTable("parents_eleves", {
  id: uuid("id").primaryKey().defaultRandom(),
  eleve_id: uuid("eleve_id").notNull(),
  utilisateur_id: uuid("utilisateur_id").notNull(),
  etablissement_id: uuid("etablissement_id"),
  lien: text("lien").notNull(),
  est_principal: boolean("est_principal").notNull().default(false),
  peut_consulter_notes: boolean("peut_consulter_notes").notNull().default(true),
  peut_consulter_absences: boolean("peut_consulter_absences").notNull().default(true),
  peut_envoyer_messages: boolean("peut_envoyer_messages").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type ParentEleve = typeof parentsElevesTable.$inferSelect;
