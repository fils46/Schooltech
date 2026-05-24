import { pgTable, text, boolean, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { etablissementsTable } from "./etablissements";

export const utilisateursTable = pgTable("utilisateurs", {
  id: uuid("id").primaryKey().defaultRandom(),
  etablissement_id: uuid("etablissement_id").references(() => etablissementsTable.id, {
    onDelete: "cascade",
  }),
  nom: text("nom").notNull(),
  prenoms: text("prenoms"),
  email: text("email").notNull().unique(),
  telephone: text("telephone"),
  password: text("password").notNull(),
  role: text("role").notNull(),
  actif: boolean("actif").notNull().default(true),
  premier_login: boolean("premier_login").notNull().default(true),
  photo_url: text("photo_url"),
  preferences_notifs: jsonb("preferences_notifs").default({}),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUtilisateurSchema = createInsertSchema(utilisateursTable).omit({
  id: true,
  created_at: true,
});

export type InsertUtilisateur = z.infer<typeof insertUtilisateurSchema>;
export type Utilisateur = typeof utilisateursTable.$inferSelect;
