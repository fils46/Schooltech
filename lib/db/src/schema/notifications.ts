import {
  pgTable, text, timestamp, uuid, pgEnum, boolean, json,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const notificationTypeEnum = pgEnum("notification_type", [
  "absence",
  "retard",
  "alerte_seuil",
  "justification_validee",
  "justification_rejetee",
  "bulletin_publie",
  "message",
  "annonce",
  "rdv",
  "incident_signale",
  "sanction_en_attente",
  "sanction_validee",
  "sanction_refusee",
  "incident_escalade",
  "note_ajoutee",
]);

export const notificationsTable = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    etablissement_id: uuid("etablissement_id").notNull(),
    destinataire_id: uuid("destinataire_id").notNull(),
    type: notificationTypeEnum("type").notNull(),
    titre: text("titre").notNull(),
    contenu: text("contenu").notNull(),
    lien: text("lien"),
    lu: boolean("lu").notNull().default(false),
    date_lecture: timestamp("date_lecture", { withTimezone: true }),
    metadata: json("metadata"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const insertNotificationSchema = createInsertSchema(notificationsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notificationsTable.$inferSelect;
