import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, matieresTable, matiereClassesTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

const ROLES_ADMIN = ["dev", "directeur", "censeur"];

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

function requireAdmin(role: string, res: import("express").Response): boolean {
  if (!ROLES_ADMIN.includes(role)) {
    res.status(403).json({ message: "Accès non autorisé." });
    return false;
  }
  return true;
}

/* ─── GET /api/matieres/classe/:classeId ─────────────────────────── */
router.get(
  "/matieres/classe/:classeId",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const classeId = normalizeId(req.params.classeId);
    const user = req.user!;
    const { annee_scolaire_id } = req.query as Record<string, string>;

    try {
      const conditions = [eq(matiereClassesTable.classe_id, classeId)];
      if (annee_scolaire_id) {
        conditions.push(eq(matiereClassesTable.annee_scolaire_id, annee_scolaire_id));
      }

      const rows = await db
        .select({
          id: matiereClassesTable.id,
          matiere_id: matiereClassesTable.matiere_id,
          classe_id: matiereClassesTable.classe_id,
          annee_scolaire_id: matiereClassesTable.annee_scolaire_id,
          coefficient: matiereClassesTable.coefficient,
          nb_heures_semaine: matiereClassesTable.nb_heures_semaine,
          est_eliminatoire: matiereClassesTable.est_eliminatoire,
          matiere_nom: matieresTable.nom,
          matiere_code: matieresTable.code,
          matiere_couleur: matieresTable.couleur,
          etablissement_id: matieresTable.etablissement_id,
        })
        .from(matiereClassesTable)
        .innerJoin(matieresTable, eq(matiereClassesTable.matiere_id, matieresTable.id))
        .where(and(...conditions))
        .orderBy(asc(matieresTable.nom));

      const filtered = user.role !== "dev"
        ? rows.filter(r => r.etablissement_id === user.etablissement_id)
        : rows;

      const total_coefficient = filtered.reduce((sum, r) => sum + Number(r.coefficient), 0);

      res.json({
        matieres: filtered.map(r => ({
          ...r,
          coefficient: Number(r.coefficient),
          nb_heures_semaine: r.nb_heures_semaine != null ? Number(r.nb_heures_semaine) : null,
        })),
        total_coefficient,
      });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── GET /api/matieres ──────────────────────────────────────────── */
router.get(
  "/matieres",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { actif } = req.query as Record<string, string>;

    try {
      const etabId = user.role === "dev"
        ? (req.query.etablissement_id as string | undefined)
        : user.etablissement_id;

      if (!etabId) {
        res.json({ matieres: [], total: 0 });
        return;
      }

      const conditions = [eq(matieresTable.etablissement_id, etabId)];
      if (actif === "true") conditions.push(eq(matieresTable.actif, true));
      if (actif === "false") conditions.push(eq(matieresTable.actif, false));

      const matieres = await db
        .select()
        .from(matieresTable)
        .where(and(...conditions))
        .orderBy(asc(matieresTable.nom));

      res.json({ matieres, total: matieres.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── POST /api/matieres ─────────────────────────────────────────── */
router.post(
  "/matieres",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!requireAdmin(user.role, res)) return;

    const { nom, code, couleur, etablissement_id } = req.body as Record<string, unknown>;

    if (typeof nom !== "string" || !nom.trim() || typeof code !== "string" || !code.trim()) {
      res.status(400).json({ message: "nom et code sont requis." });
      return;
    }

    const etabId = user.role === "dev"
      ? (typeof etablissement_id === "string" ? etablissement_id : null)
      : user.etablissement_id;

    if (!etabId) { res.status(400).json({ message: "Établissement requis." }); return; }

    try {
      const [matiere] = await db
        .insert(matieresTable)
        .values({
          etablissement_id: etabId,
          nom: nom.trim(),
          code: code.trim().toUpperCase(),
          couleur: typeof couleur === "string" ? couleur : null,
          actif: true,
        })
        .returning();

      res.status(201).json(matiere);
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === "23505") {
        res.status(409).json({ message: "Une matière avec ce code existe déjà." });
        return;
      }
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── POST /api/matieres/assigner/masse ─────────────────────────── */
router.post(
  "/matieres/assigner/masse",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!requireAdmin(user.role, res)) return;

    const { classe_id, annee_scolaire_id, matieres } = req.body as {
      classe_id: string;
      annee_scolaire_id: string;
      matieres: Array<{
        matiere_id: string;
        coefficient?: number;
        nb_heures_semaine?: number | null;
        est_eliminatoire?: boolean;
      }>;
    };

    if (!classe_id || !annee_scolaire_id || !Array.isArray(matieres)) {
      res.status(400).json({ message: "classe_id, annee_scolaire_id et matieres sont requis." });
      return;
    }

    const errors: string[] = [];
    let total = 0;

    for (const m of matieres) {
      try {
        await db
          .insert(matiereClassesTable)
          .values({
            matiere_id: m.matiere_id,
            classe_id,
            annee_scolaire_id,
            coefficient: String(m.coefficient ?? 1),
            nb_heures_semaine: m.nb_heures_semaine != null ? String(m.nb_heures_semaine) : null,
            est_eliminatoire: m.est_eliminatoire ?? false,
          })
          .onConflictDoUpdate({
            target: [
              matiereClassesTable.matiere_id,
              matiereClassesTable.classe_id,
              matiereClassesTable.annee_scolaire_id,
            ],
            set: {
              coefficient: String(m.coefficient ?? 1),
              nb_heures_semaine: m.nb_heures_semaine != null ? String(m.nb_heures_semaine) : null,
              est_eliminatoire: m.est_eliminatoire ?? false,
              updated_at: new Date(),
            },
          });
        total++;
      } catch {
        errors.push(m.matiere_id);
      }
    }

    res.json({ success: errors.length === 0, total, errors });
  }
);

/* ─── POST /api/matieres/assigner ───────────────────────────────── */
router.post(
  "/matieres/assigner",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!requireAdmin(user.role, res)) return;

    const { matiere_id, classe_id, annee_scolaire_id, coefficient, nb_heures_semaine, est_eliminatoire } =
      req.body as Record<string, unknown>;

    if (!matiere_id || !classe_id || !annee_scolaire_id) {
      res.status(400).json({ message: "matiere_id, classe_id et annee_scolaire_id sont requis." });
      return;
    }

    try {
      const [liaison] = await db
        .insert(matiereClassesTable)
        .values({
          matiere_id: matiere_id as string,
          classe_id: classe_id as string,
          annee_scolaire_id: annee_scolaire_id as string,
          coefficient: String(coefficient ?? 1),
          nb_heures_semaine: nb_heures_semaine != null ? String(nb_heures_semaine) : null,
          est_eliminatoire: (est_eliminatoire as boolean) ?? false,
        })
        .returning();

      res.status(201).json({ ...liaison, coefficient: Number(liaison.coefficient) });
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === "23505") {
        res.status(409).json({ message: "Cette matière est déjà assignée à cette classe pour cette année." });
        return;
      }
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── POST /api/matieres/dupliquer/annee ────────────────────────── */
router.post(
  "/matieres/dupliquer/annee",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!requireAdmin(user.role, res)) return;

    const { source_annee_id, cible_annee_id } = req.body as Record<string, string>;
    if (!source_annee_id || !cible_annee_id) {
      res.status(400).json({ message: "source_annee_id et cible_annee_id sont requis." });
      return;
    }

    try {
      const liaisons = await db
        .select()
        .from(matiereClassesTable)
        .where(eq(matiereClassesTable.annee_scolaire_id, source_annee_id));

      const errors: string[] = [];
      let total = 0;

      for (const l of liaisons) {
        try {
          await db
            .insert(matiereClassesTable)
            .values({
              matiere_id: l.matiere_id,
              classe_id: l.classe_id,
              annee_scolaire_id: cible_annee_id,
              coefficient: l.coefficient,
              nb_heures_semaine: l.nb_heures_semaine,
              est_eliminatoire: l.est_eliminatoire,
            })
            .onConflictDoNothing();
          total++;
        } catch {
          errors.push(l.id);
        }
      }

      res.json({ success: errors.length === 0, total, errors });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── POST /api/matieres/dupliquer ──────────────────────────────── */
router.post(
  "/matieres/dupliquer",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!requireAdmin(user.role, res)) return;

    const { source_classe_id, cible_classe_id, annee_scolaire_id } = req.body as Record<string, string>;
    if (!source_classe_id || !cible_classe_id || !annee_scolaire_id) {
      res.status(400).json({ message: "source_classe_id, cible_classe_id et annee_scolaire_id sont requis." });
      return;
    }

    try {
      const liaisons = await db
        .select()
        .from(matiereClassesTable)
        .where(and(
          eq(matiereClassesTable.classe_id, source_classe_id),
          eq(matiereClassesTable.annee_scolaire_id, annee_scolaire_id),
        ));

      const errors: string[] = [];
      let total = 0;

      for (const l of liaisons) {
        try {
          await db
            .insert(matiereClassesTable)
            .values({
              matiere_id: l.matiere_id,
              classe_id: cible_classe_id,
              annee_scolaire_id,
              coefficient: l.coefficient,
              nb_heures_semaine: l.nb_heures_semaine,
              est_eliminatoire: l.est_eliminatoire,
            })
            .onConflictDoNothing();
          total++;
        } catch {
          errors.push(l.id);
        }
      }

      res.json({ success: errors.length === 0, total, errors });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── PUT /api/matieres/assigner/:id ────────────────────────────── */
router.put(
  "/matieres/assigner/:id",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!requireAdmin(user.role, res)) return;

    const liaId = normalizeId(req.params.id);
    const { coefficient, nb_heures_semaine, est_eliminatoire } = req.body as {
      coefficient?: number;
      nb_heures_semaine?: number | null;
      est_eliminatoire?: boolean;
    };

    try {
      const setData: Partial<typeof matiereClassesTable.$inferInsert> & { updated_at: Date } = {
        updated_at: new Date(),
      };
      if (coefficient != null) setData.coefficient = String(coefficient);
      if (nb_heures_semaine !== undefined) setData.nb_heures_semaine = nb_heures_semaine != null ? String(nb_heures_semaine) : null;
      if (est_eliminatoire != null) setData.est_eliminatoire = est_eliminatoire;

      const [updated] = await db
        .update(matiereClassesTable)
        .set(setData)
        .where(eq(matiereClassesTable.id, liaId))
        .returning();

      if (!updated) { res.status(404).json({ message: "Liaison introuvable." }); return; }
      res.json({ ...updated, coefficient: Number(updated.coefficient) });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── DELETE /api/matieres/assigner/:id ─────────────────────────── */
router.delete(
  "/matieres/assigner/:id",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!requireAdmin(user.role, res)) return;

    const liaId = normalizeId(req.params.id);

    try {
      const deleted = await db
        .delete(matiereClassesTable)
        .where(eq(matiereClassesTable.id, liaId))
        .returning();

      if (!deleted[0]) { res.status(404).json({ message: "Liaison introuvable." }); return; }
      res.json({ success: true, message: "Matière retirée de la classe." });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── PUT /api/matieres/:id ─────────────────────────────────────── */
router.put(
  "/matieres/:id",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!requireAdmin(user.role, res)) return;

    const matiereId = normalizeId(req.params.id);
    const { nom, code, couleur } = req.body as {
      nom?: string;
      code?: string;
      couleur?: string | null;
    };

    try {
      const rows = await db.select().from(matieresTable).where(eq(matieresTable.id, matiereId)).limit(1);
      const mat = rows[0];
      if (!mat) { res.status(404).json({ message: "Matière introuvable." }); return; }
      if (user.role !== "dev" && mat.etablissement_id !== user.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const setData: Partial<typeof matieresTable.$inferInsert> & { updated_at: Date } = {
        updated_at: new Date(),
      };
      if (typeof nom === "string" && nom.trim()) setData.nom = nom.trim();
      if (typeof code === "string" && code.trim()) setData.code = code.trim().toUpperCase();
      if (couleur !== undefined) setData.couleur = typeof couleur === "string" ? couleur : null;

      const [updated] = await db
        .update(matieresTable)
        .set(setData)
        .where(eq(matieresTable.id, matiereId))
        .returning();

      res.json(updated);
    } catch (err: unknown) {
      const pg = err as { code?: string };
      if (pg.code === "23505") {
        res.status(409).json({ message: "Une matière avec ce code existe déjà." });
        return;
      }
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── PUT /api/matieres/:id/desactiver ──────────────────────────── */
router.put(
  "/matieres/:id/desactiver",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!requireAdmin(user.role, res)) return;

    const matiereId = normalizeId(req.params.id);

    try {
      const rows = await db.select().from(matieresTable).where(eq(matieresTable.id, matiereId)).limit(1);
      const mat = rows[0];
      if (!mat) { res.status(404).json({ message: "Matière introuvable." }); return; }
      if (user.role !== "dev" && mat.etablissement_id !== user.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const [updated] = await db
        .update(matieresTable)
        .set({ actif: false, updated_at: new Date() })
        .where(eq(matieresTable.id, matiereId))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

export default router;
