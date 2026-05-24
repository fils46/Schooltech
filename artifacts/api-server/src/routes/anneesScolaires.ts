import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, anneesScolairesTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

/* ─── GET /annees-scolaires/trimestres/actifs ─────────────── */
router.get(
  "/annees-scolaires/trimestres/actifs",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    try {
      const etabId = user.role === "dev"
        ? (req.query.etablissement_id as string | undefined)
        : user.etablissement_id;

      if (!etabId) {
        res.json({ annee_scolaire_id: null, trimestre_numero: null, trimestre: null });
        return;
      }

      const rows = await db
        .select()
        .from(anneesScolairesTable)
        .where(and(
          eq(anneesScolairesTable.etablissement_id, etabId),
          eq(anneesScolairesTable.est_active, true),
        ))
        .limit(1);

      const annee = rows[0];
      if (!annee || !annee.trimestres || annee.trimestres.length === 0) {
        res.json({ annee_scolaire_id: annee?.id ?? null, trimestre_numero: null, trimestre: null });
        return;
      }

      const today = new Date().toISOString().slice(0, 10);
      const actif = annee.trimestres.find(
        (t) => t.date_debut <= today && today <= t.date_fin
      ) ?? null;

      res.json({
        annee_scolaire_id: annee.id,
        trimestre_numero: actif?.numero ?? null,
        trimestre: actif,
      });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── GET /annees-scolaires/liste ──────────────────────────── */
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

/* ─── GET /annees-scolaires/active ─────────────────────────── */
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
        .where(and(
          eq(anneesScolairesTable.etablissement_id, etabId),
          eq(anneesScolairesTable.est_active, true),
        ))
        .limit(1);

      if (!rows[0]) { res.status(404).json({ message: "Aucune année active." }); return; }
      res.json(rows[0]);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── POST /annees-scolaires/creer ─────────────────────────── */
router.post(
  "/annees-scolaires/creer",
  authMiddleware,
  requireRole("directeur"),
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
          .set({ est_active: false, statut: "a_venir", updated_at: new Date() })
          .where(and(
            eq(anneesScolairesTable.etablissement_id, etabId),
            eq(anneesScolairesTable.est_active, true),
          ));
      }

      const [annee] = await db
        .insert(anneesScolairesTable)
        .values({
          etablissement_id: etabId,
          libelle: libelle.trim(),
          date_debut: date_debut as string,
          date_fin: date_fin as string,
          est_active: shouldActivate,
          statut: shouldActivate ? "en_cours" : "a_venir",
        })
        .returning();

      res.status(201).json(annee);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── PUT /annees-scolaires/:id/activer ─────────────────────── */
router.put(
  "/annees-scolaires/:id/activer",
  authMiddleware,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = normalizeId(req.params.id);

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
        .set({ est_active: false, statut: "a_venir", updated_at: new Date() })
        .where(and(
          eq(anneesScolairesTable.etablissement_id, annee.etablissement_id),
          eq(anneesScolairesTable.est_active, true),
        ));

      const [updated] = await db
        .update(anneesScolairesTable)
        .set({ est_active: true, statut: "en_cours", updated_at: new Date() })
        .where(eq(anneesScolairesTable.id, rawId))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── PUT /annees-scolaires/:id/cloturer ────────────────────── */
router.put(
  "/annees-scolaires/:id/cloturer",
  authMiddleware,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = normalizeId(req.params.id);

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

      if (annee.statut === "cloturee") {
        res.status(400).json({ message: "Cette année est déjà clôturée." });
        return;
      }

      const [updated] = await db
        .update(anneesScolairesTable)
        .set({ est_active: false, statut: "cloturee", updated_at: new Date() })
        .where(eq(anneesScolairesTable.id, rawId))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── PUT /annees-scolaires/:id/trimestres ──────────────────── */
router.put(
  "/annees-scolaires/:id/trimestres",
  authMiddleware,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = normalizeId(req.params.id);
    const { trimestres } = req.body as { trimestres: Array<{ numero: 1 | 2 | 3; date_debut: string; date_fin: string }> };

    if (!Array.isArray(trimestres) || trimestres.length === 0) {
      res.status(400).json({ message: "Le tableau trimestres est requis." });
      return;
    }

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

      const [updated] = await db
        .update(anneesScolairesTable)
        .set({ trimestres, updated_at: new Date() })
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
