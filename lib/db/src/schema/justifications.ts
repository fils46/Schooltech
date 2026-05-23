import {
  pgTable, text, timestamp, uuid, pgEnum, date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const justificationStatutEnum = pgEnum("justification_statut", [
  "en_attente",
  "validee",
  "rejetee",
]);

export const justificationsTable = pgTable(
  "justifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    absence_id: uuid("absence_id").notNull(),
    soumis_par: uuid("soumis_par").notNull(),
    motif: text("motif").notNull(),
    document_url: text("document_url"),
    statut: justificationStatutEnum("statut").notNull().default("en_attente"),
    traite_par: uuid("traite_par"),
    date_traitement: date("date_traitement"),
    commentaire_traitement: text("commentaire_traitement"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  }
);

export const insertJustificationSchema = createInsertSchema(justificationsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertJustification = z.infer<typeof insertJustificationSchema>;
export type Justification = typeof justificationsTable.$inferSelect;
