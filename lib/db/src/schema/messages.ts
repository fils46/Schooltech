import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const messagesTable = pgTable("messages", {
  id:                    uuid("id").primaryKey().defaultRandom(),
  etablissement_id:      uuid("etablissement_id").notNull(),
  expediteur_id:         uuid("expediteur_id").notNull(),
  destinataire_id:       uuid("destinataire_id").notNull(),
  sujet:                 text("sujet").notNull(),
  contenu:               text("contenu").notNull(),
  lu:                    boolean("lu").notNull().default(false),
  date_lecture:          timestamp("date_lecture", { withTimezone: true }),
  piece_jointe_url:      text("piece_jointe_url"),
  piece_jointe_nom:      text("piece_jointe_nom"),
  parent_message_id:     uuid("parent_message_id"),
  archive_expediteur:    boolean("archive_expediteur").notNull().default(false),
  archive_destinataire:  boolean("archive_destinataire").notNull().default(false),
  created_at:            timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at:            timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
