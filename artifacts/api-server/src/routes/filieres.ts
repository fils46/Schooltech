import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, filieresTable, classesTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

/* ─── Liste des filières ─────────────────────────────────── */
router.get(
  "/filieres/liste",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    try {
      const etabId = user.role === "dev"
        ? (req.query.etablissement_id as string | undefined)
        : user.etablissement_id;

      if (!etabId) { res.json({ filieres: [], total: 0 }); return; }

      const filieres = await db
        .select()
        .from(filieresTable)
        .where(eq(filieresTable.etablissement_id, etabId))
        .orderBy(filieresTable.code);

      res.json({ filieres, total: filieres.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Créer une filière ──────────────────────────────────── */
router.post(
  "/filieres/creer",
  authMiddleware,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { nom, code, description, type_etablissement, etablissement_id } =
      req.body as Record<string, unknown>;

    if (typeof nom !== "string" || !nom.trim() || typeof code !== "string" || !code.trim()) {
      res.status(400).json({ message: "nom et code sont obligatoires." });
      return;
    }

    const etabId = user.role === "dev"
      ? (typeof etablissement_id === "string" ? etablissement_id : null)
      : user.etablissement_id;

    if (!etabId) { res.status(400).json({ message: "Établissement requis." }); return; }

    try {
      const [filiere] = await db
        .insert(filieresTable)
        .values({
          etablissement_id: etabId,
          nom: nom.trim(),
          code: (code as string).trim().toUpperCase(),
          description: typeof description === "string" ? description : null,
          type_etablissement: (type_etablissement as "lycee" | "college" | "mixte" | null) ?? null,
          actif: true,
        })
        .returning();

      res.status(201).json(filiere);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Modifier une filière ───────────────────────────────── */
router.put(
  "/filieres/:id/modifier",
  authMiddleware,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { nom, code, description, type_etablissement } = req.body as Record<string, unknown>;

    try {
      const rows = await db.select().from(filieresTable).where(eq(filieresTable.id, rawId)).limit(1);
      const filiere = rows[0];
      if (!filiere) { res.status(404).json({ message: "Filière introuvable." }); return; }

      if (user.role !== "dev" && user.etablissement_id !== filiere.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const [updated] = await db
        .update(filieresTable)
        .set({
          nom: typeof nom === "string" ? nom.trim() : filiere.nom,
          code: typeof code === "string" ? (code as string).trim().toUpperCase() : filiere.code,
          description: typeof description === "string" ? description : filiere.description,
          type_etablissement: (type_etablissement as "lycee" | "college" | "mixte" | null) ?? filiere.type_etablissement,
          updated_at: new Date(),
        })
        .where(eq(filieresTable.id, rawId))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Désactiver une filière ─────────────────────────────── */
router.put(
  "/filieres/:id/desactiver",
  authMiddleware,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db.select().from(filieresTable).where(eq(filieresTable.id, rawId)).limit(1);
      const filiere = rows[0];
      if (!filiere) { res.status(404).json({ message: "Filière introuvable." }); return; }

      if (user.role !== "dev" && user.etablissement_id !== filiere.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const classesActives = await db
        .select({ id: classesTable.id })
        .from(classesTable)
        .where(
          and(
            eq(classesTable.filiere_id, rawId),
            eq(classesTable.actif, true)
          )
        )
        .limit(1);

      if (classesActives.length > 0) {
        res.status(400).json({
          message: "Des classes actives utilisent cette filière. Désactivez-les d'abord.",
        });
        return;
      }

      const [updated] = await db
        .update(filieresTable)
        .set({ actif: false, updated_at: new Date() })
        .where(eq(filieresTable.id, rawId))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

export default router;
