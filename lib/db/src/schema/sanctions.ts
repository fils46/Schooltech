import {
  pgTable, text, timestamp, uuid, pgEnum, date, boolean, integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { etablissementsTable } from "./etablissements";
import { elevesTable } from "./eleves";
import { utilisateursTable } from "./utilisateurs";
import { incidentsTable } from "./incidents";

export const typeSanctionEnum = pgEnum("type_sanction", [
  "avertissement_oral", "avertissement_ecrit", "retenue",
  "exclusion_temp", "exclusion_def", "convocation_parent",
]);

export const statutSanctionEnum = pgEnum("statut_sanction", [
  "en_attente", "validee", "executee", "annulee",
]);

export const sanctionsTable = pgTable("sanctions", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id")
    .notNull()
    .references(() => etablissementsTable.id, { onDelete: "cascade" }),
  incident_id: uuid("incident_id").references(() => incidentsTable.id),
  eleve_id: uuid("eleve_id")
    .notNull()
    .references(() => elevesTable.id, { onDelete: "cascade" }),
  prononce_par: uuid("prononce_par")
    .notNull()
    .references(() => utilisateursTable.id),
  type_sanction: typeSanctionEnum("type_sanction").notNull(),
  description: text("description"),
  date_sanction: date("date_sanction").notNull(),
  duree_heures: integer("duree_heures"),
  date_execution: date("date_execution"),
  notifier_parent: boolean("notifier_parent").notNull().default(true),
  statut: statutSanctionEnum("statut").notNull().default("en_attente"),
  validee_par: uuid("validee_par").references(() => utilisateursTable.id),
  date_validation: timestamp("date_validation", { withTimezone: true }),
  observations: text("observations"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertSanctionSchema = createInsertSchema(sanctionsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertSanction = z.infer<typeof insertSanctionSchema>;
export type Sanction = typeof sanctionsTable.$inferSelect;
