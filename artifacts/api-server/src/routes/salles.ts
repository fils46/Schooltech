import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, sallesTable, emploisDuTempsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

/* ─── Lister les salles ──────────────────────────────────── */
router.get("/salles/liste", authMiddleware, async (req, res): Promise<void> => {
  const user = req.user!;
  const etabId = user.role === "dev"
    ? (req.query.etablissement_id as string | undefined)
    : user.etablissement_id;

  if (!etabId) { res.json({ salles: [], total: 0 }); return; }

  try {
    const salles = await db
      .select()
      .from(sallesTable)
      .where(eq(sallesTable.etablissement_id, etabId))
      .orderBy(sallesTable.nom);

    res.json({ salles, total: salles.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ─── Créer une salle ────────────────────────────────────── */
router.post(
  "/salles/creer",
  authMiddleware,
  requireRole("dev", "directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { nom, capacite, type, etablissement_id } = req.body as Record<string, unknown>;

    if (typeof nom !== "string" || !nom.trim()) {
      res.status(400).json({ message: "Le nom de la salle est obligatoire." });
      return;
    }

    const TYPES_VALIDES = ["classe", "laboratoire", "salle_info", "gymnase", "autre"] as const;
    const typeSalle = (typeof type === "string" && TYPES_VALIDES.includes(type as typeof TYPES_VALIDES[number]))
      ? (type as typeof TYPES_VALIDES[number])
      : "classe";

    const etabId = user.role === "dev"
      ? (typeof etablissement_id === "string" ? etablissement_id : null)
      : user.etablissement_id;
    if (!etabId) { res.status(400).json({ message: "Établissement requis." }); return; }

    try {
      const [salle] = await db
        .insert(sallesTable)
        .values({
          etablissement_id: etabId,
          nom: nom.trim(),
          capacite: capacite != null ? Number(capacite) : null,
          type: typeSalle,
          actif: true,
        })
        .returning();

      res.status(201).json(salle);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Modifier une salle ─────────────────────────────────── */
router.put(
  "/salles/:id/modifier",
  authMiddleware,
  requireRole("dev", "directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { nom, capacite, type } = req.body as Record<string, unknown>;

    try {
      const rows = await db
        .select()
        .from(sallesTable)
        .where(eq(sallesTable.id, rawId))
        .limit(1);
      const salle = rows[0];
      if (!salle) { res.status(404).json({ message: "Salle introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== salle.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const TYPES_VALIDES = ["classe", "laboratoire", "salle_info", "gymnase", "autre"] as const;
      const typeSalle = (typeof type === "string" && TYPES_VALIDES.includes(type as typeof TYPES_VALIDES[number]))
        ? (type as typeof TYPES_VALIDES[number])
        : salle.type;

      const [updated] = await db
        .update(sallesTable)
        .set({
          nom: typeof nom === "string" ? nom.trim() : salle.nom,
          capacite: capacite != null ? Number(capacite) : salle.capacite,
          type: typeSalle,
          updated_at: new Date(),
        })
        .where(eq(sallesTable.id, rawId))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Désactiver une salle ───────────────────────────────── */
router.put(
  "/salles/:id/desactiver",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db
        .select()
        .from(sallesTable)
        .where(eq(sallesTable.id, rawId))
        .limit(1);
      const salle = rows[0];
      if (!salle) { res.status(404).json({ message: "Salle introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== salle.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const [coursActif] = await db
        .select({ id: emploisDuTempsTable.id })
        .from(emploisDuTempsTable)
        .where(eq(emploisDuTempsTable.salle_id, rawId))
        .limit(1);

      if (coursActif) {
        res.status(400).json({ message: "Des cours utilisent encore cette salle. Modifiez-les d'abord." });
        return;
      }

      const [updated] = await db
        .update(sallesTable)
        .set({ actif: false, updated_at: new Date() })
        .where(eq(sallesTable.id, rawId))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

export default router;
