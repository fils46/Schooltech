import {
  pgTable, text, timestamp, uuid, unique, integer, numeric,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const bulletinDetailsTable = pgTable(
  "bulletin_details",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    bulletin_id: uuid("bulletin_id").notNull(),
    matiere: text("matiere").notNull(),
    coefficient: numeric("coefficient", { precision: 3, scale: 1 }).notNull(),
    moyenne_matiere: numeric("moyenne_matiere", { precision: 5, scale: 2 }),
    note_min_classe: numeric("note_min_classe", { precision: 5, scale: 2 }),
    note_max_classe: numeric("note_max_classe", { precision: 5, scale: 2 }),
    moyenne_classe: numeric("moyenne_classe", { precision: 5, scale: 2 }),
    appreciation_prof: text("appreciation_prof"),
    rang_matiere: integer("rang_matiere"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("uq_bulletin_detail_bulletin_matiere").on(
      t.bulletin_id,
      t.matiere
    ),
  ]
);

export const insertBulletinDetailSchema = createInsertSchema(bulletinDetailsTable).omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export type InsertBulletinDetail = z.infer<typeof insertBulletinDetailSchema>;
export type BulletinDetail = typeof bulletinDetailsTable.$inferSelect;
