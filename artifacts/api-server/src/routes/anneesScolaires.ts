import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, anneesScolairesTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

/* ─── Lister les années scolaires ───────────────────────────────── */
router.get(
  "/annees-scolaires/liste",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    try {
      const etabId = user.role === "dev"
        ? (req.query.etablissement_id as string | undefined)
        : user.etablissement_id;

      if (!etabId) {
        res.json({ annees: [], total: 0 });
        return;
      }

      const annees = await db
        .select()
        .from(anneesScolairesTable)
        .where(eq(anneesScolairesTable.etablissement_id, etabId))
        .orderBy(desc(anneesScolairesTable.date_debut));

      res.json({ annees, total: annees.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Année scolaire active ──────────────────────────────────────── */
router.get(
  "/annees-scolaires/active",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    try {
      const etabId = user.role === "dev"
        ? (req.query.etablissement_id as string | undefined)
        : user.etablissement_id;

      if (!etabId) { res.status(404).json({ message: "Aucune année active." }); return; }

      const rows = await db
        .select()
        .from(anneesScolairesTable)
        .where(
          and(
            eq(anneesScolairesTable.etablissement_id, etabId),
            eq(anneesScolairesTable.est_active, true)
          )
        )
        .limit(1);

      if (!rows[0]) { res.status(404).json({ message: "Aucune année active." }); return; }
      res.json(rows[0]);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Créer une année scolaire ───────────────────────────────────── */
router.post(
  "/annees-scolaires/creer",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { libelle, date_debut, date_fin, est_active, etablissement_id } =
      req.body as Record<string, unknown>;

    if (
      typeof libelle !== "string" || !libelle.trim() ||
      typeof date_debut !== "string" || !date_debut ||
      typeof date_fin !== "string" || !date_fin
    ) {
      res.status(400).json({ message: "Données invalides." });
      return;
    }

    if (!/^\d{4}-\d{4}$/.test(libelle.trim())) {
      res.status(400).json({ message: 'Le libellé doit être au format "YYYY-YYYY".' });
      return;
    }

    if (date_debut >= date_fin) {
      res.status(400).json({ message: "date_debut doit être avant date_fin." });
      return;
    }

    const etabId = user.role === "dev"
      ? (typeof etablissement_id === "string" ? etablissement_id : null)
      : user.etablissement_id;

    if (!etabId) { res.status(400).json({ message: "Établissement requis." }); return; }

    try {
      const shouldActivate = est_active === true;

      if (shouldActivate) {
        await db
          .update(anneesScolairesTable)
          .set({ est_active: false, updated_at: new Date() })
          .where(
            and(
              eq(anneesScolairesTable.etablissement_id, etabId),
              eq(anneesScolairesTable.est_active, true)
            )
          );
      }

      const [annee] = await db
        .insert(anneesScolairesTable)
        .values({
          etablissement_id: etabId,
          libelle: libelle.trim(),
          date_debut: date_debut as string,
          date_fin: date_fin as string,
          est_active: shouldActivate,
        })
        .returning();

      res.status(201).json(annee);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Activer une année scolaire ─────────────────────────────────── */
router.put(
  "/annees-scolaires/:id/activer",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db
        .select()
        .from(anneesScolairesTable)
        .where(eq(anneesScolairesTable.id, rawId))
        .limit(1);

      const annee = rows[0];
      if (!annee) { res.status(404).json({ message: "Année scolaire introuvable." }); return; }

      if (user.role !== "dev" && user.etablissement_id !== annee.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." });
        return;
      }

      await db
        .update(anneesScolairesTable)
        .set({ est_active: false, updated_at: new Date() })
        .where(
          and(
            eq(anneesScolairesTable.etablissement_id, annee.etablissement_id),
            eq(anneesScolairesTable.est_active, true)
          )
        );

      const [updated] = await db
        .update(anneesScolairesTable)
        .set({ est_active: true, updated_at: new Date() })
        .where(eq(anneesScolairesTable.id, rawId))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

export default router;
