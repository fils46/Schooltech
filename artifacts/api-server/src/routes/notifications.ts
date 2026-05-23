import { Router } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

/* ── GET /api/notifications/count ──────────────────────── */
router.get("/api/notifications/count", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const [{ total }] = await db
    .select({ total: count() })
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.destinataire_id, user.id),
      eq(notificationsTable.lu, false),
    ));
  res.json({ count: total });
});

/* ── PUT /api/notifications/tout-lire ───────────────────── */
router.put("/api/notifications/tout-lire", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  await db
    .update(notificationsTable)
    .set({ lu: true, date_lecture: new Date(), updated_at: new Date() })
    .where(and(
      eq(notificationsTable.destinataire_id, user.id),
      eq(notificationsTable.lu, false),
    ));
  res.json({ message: "Toutes les notifications marquées comme lues." });
});

/* ── GET /api/notifications/mes-notifications ──────────── */
router.get("/api/notifications/mes-notifications", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const { type } = req.query as Record<string, string>;
  const lu = req.query["lu"] as string | undefined;
  const page = Math.max(1, parseInt((req.query["page"] as string) || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query["limit"] as string) || "20", 10)));

  const conditions: ReturnType<typeof eq>[] = [
    eq(notificationsTable.destinataire_id, user.id),
  ];
  if (type) conditions.push(eq(notificationsTable.type, type as "absence" | "retard" | "alerte_seuil" | "justification_validee" | "justification_rejetee" | "bulletin_publie" | "message"));
  if (lu !== undefined) conditions.push(eq(notificationsTable.lu, lu === "true"));

  const [{ total }] = await db.select({ total: count() }).from(notificationsTable).where(and(...conditions));
  const notifications = await db.select().from(notificationsTable)
    .where(and(...conditions))
    .orderBy(desc(notificationsTable.created_at))
    .limit(limit).offset((page - 1) * limit);

  res.json({ notifications, total });
});

/* ── PUT /api/notifications/:id/lire ───────────────────── */
router.put("/api/notifications/:id/lire", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [updated] = await db
    .update(notificationsTable)
    .set({ lu: true, date_lecture: new Date(), updated_at: new Date() })
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.destinataire_id, user.id),
    ))
    .returning();

  if (!updated) { res.status(404).json({ message: "Notification introuvable." }); return; }
  res.json({ message: "Notification marquée comme lue." });
});

/* ── DELETE /api/notifications/:id ─────────────────────── */
router.delete("/api/notifications/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [deleted] = await db
    .delete(notificationsTable)
    .where(and(
      eq(notificationsTable.id, id),
      eq(notificationsTable.destinataire_id, user.id),
    ))
    .returning();

  if (!deleted) { res.status(404).json({ message: "Notification introuvable." }); return; }
  res.json({ message: "Notification supprimée." });
});

export default router;
