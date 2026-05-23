import { Router } from "express";
import { eq, and, desc, count, inArray } from "drizzle-orm";
import { db, notificationsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { emitNotification } from "../socket/socketManager";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

/* ── GET /api/notifications/count ──────────────────────── */
router.get("/notifications/count", authMiddleware, verifierLicence, async (req, res) => {
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
router.put("/notifications/tout-lire", authMiddleware, verifierLicence, async (req, res) => {
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
router.get("/notifications/mes-notifications", authMiddleware, verifierLicence, async (req, res) => {
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
router.put("/notifications/:id/lire", authMiddleware, verifierLicence, async (req, res) => {
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
router.delete("/notifications/:id", authMiddleware, verifierLicence, async (req, res) => {
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

/* ── POST /api/notifications/envoyer ────────────────────────── */
router.post("/notifications/envoyer", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev","directeur","censeur"].includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  const { destinataires_ids, titre, contenu, type, lien_action } = req.body as {
    destinataires_ids: string[];
    titre: string;
    contenu: string;
    type: string;
    lien_action?: string;
  };

  if (!destinataires_ids?.length || !titre?.trim() || !contenu?.trim() || !type?.trim()) {
    res.status(400).json({ message: "Champs obligatoires manquants." }); return;
  }

  const validTypes = ["absence","retard","alerte_seuil","justification_validee","justification_rejetee","bulletin_publie","message","annonce","rdv"];
  const notifType = validTypes.includes(type) ? type : "annonce";

  const inserted = await db.insert(notificationsTable).values(
    destinataires_ids.map(id => ({
      etablissement_id: user.etablissement_id ?? "",
      destinataire_id: id,
      type: notifType as "absence" | "retard" | "alerte_seuil" | "justification_validee" | "justification_rejetee" | "bulletin_publie" | "message" | "annonce" | "rdv",
      titre: titre.trim(),
      contenu: contenu.trim(),
      lien: lien_action ?? null,
    }))
  ).returning();

  for (const n of inserted) {
    await emitNotification(n.destinataire_id, {
      id: n.id,
      type: n.type,
      titre: n.titre,
      contenu: n.contenu,
      lien: n.lien,
      created_at: n.created_at,
    });
  }

  res.json({ message: `${inserted.length} notification(s) envoyée(s).` });
});

export default router;
