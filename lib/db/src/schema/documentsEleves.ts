import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const documentsElevesTable = pgTable("documents_eleves", {
  id: uuid("id").primaryKey().defaultRandom(),
  eleve_id: uuid("eleve_id").notNull(),
  type_document: text("type_document"),
  nom_fichier: text("nom_fichier").notNull(),
  url_fichier: text("url_fichier").notNull(),
  date_upload: timestamp("date_upload", { withTimezone: true }).notNull().defaultNow(),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type DocumentEleve = typeof documentsElevesTable.$inferSelect;
