import { Router } from "express";
import { eq, count } from "drizzle-orm";
import { db, etablissementsTable, utilisateursTable } from "@workspace/db";
import { CreerEtablissementBody, UpdateEtablissementBody } from "@workspace/api-zod";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

// GET /etablissements
router.get(
  "/etablissements",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;

    if (user.role === "directeur") {
      // Un directeur ne voit que son établissement
      if (!user.etablissement_id) {
        res.json([]);
        return;
      }

      const [etab] = await db
        .select()
        .from(etablissementsTable)
        .where(eq(etablissementsTable.id, user.etablissement_id));

      if (!etab) {
        res.json([]);
        return;
      }

      const [countResult] = await db
        .select({ count: count() })
        .from(utilisateursTable)
        .where(eq(utilisateursTable.etablissement_id, etab.id));

      res.json([{ ...etab, nbUtilisateurs: Number(countResult?.count ?? 0) }]);
      return;
    }

    // dev: tous les établissements avec compte
    const etablissements = await db.select().from(etablissementsTable);

    const withCounts = await Promise.all(
      etablissements.map(async (etab) => {
        const [countResult] = await db
          .select({ count: count() })
          .from(utilisateursTable)
          .where(eq(utilisateursTable.etablissement_id, etab.id));
        return { ...etab, nbUtilisateurs: Number(countResult?.count ?? 0) };
      })
    );

    res.json(withCounts);
  }
);

// POST /etablissements
router.post(
  "/etablissements",
  authMiddleware,
  requireRole("dev"),
  async (req, res): Promise<void> => {
    const parsed = CreerEtablissementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Données invalides : " + parsed.error.message });
      return;
    }

    const [etab] = await db
      .insert(etablissementsTable)
      .values({
        nom: parsed.data.nom,
        type: parsed.data.type ?? null,
        ville: parsed.data.ville ?? null,
        telephone: parsed.data.telephone ?? null,
        email: parsed.data.email ?? null,
        date_expiration_licence: parsed.data.date_expiration_licence ?? null,
      })
      .returning();

    res.status(201).json({ ...etab, nbUtilisateurs: 0 });
  }
);

// GET /etablissements/:id
router.get(
  "/etablissements/:id",
  authMiddleware,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;

    // Isolation : un non-dev ne peut voir que son propre établissement
    if (user.role !== "dev" && user.etablissement_id !== rawId) {
      res.status(403).json({ message: "Accès refusé." });
      return;
    }

    const [etab] = await db
      .select()
      .from(etablissementsTable)
      .where(eq(etablissementsTable.id, rawId));

    if (!etab) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.etablissement_id, etab.id));

    res.json({ ...etab, nbUtilisateurs: Number(countResult?.count ?? 0) });
  }
);

// PUT /etablissements/:id
router.put(
  "/etablissements/:id",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;

    if (user.role === "directeur" && user.etablissement_id !== rawId) {
      res.status(403).json({ message: "Vous ne pouvez modifier que votre établissement." });
      return;
    }

    const parsed = UpdateEtablissementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Données invalides." });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.nom !== undefined) updateData.nom = parsed.data.nom;
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
    if (parsed.data.ville !== undefined) updateData.ville = parsed.data.ville;
    if (parsed.data.telephone !== undefined) updateData.telephone = parsed.data.telephone;
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
    if (parsed.data.licence_active !== undefined) updateData.licence_active = parsed.data.licence_active;
    if (parsed.data.date_expiration_licence !== undefined)
      updateData.date_expiration_licence = parsed.data.date_expiration_licence;

    const [etab] = await db
      .update(etablissementsTable)
      .set(updateData)
      .where(eq(etablissementsTable.id, rawId))
      .returning();

    if (!etab) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.etablissement_id, etab.id));

    res.json({ ...etab, nbUtilisateurs: Number(countResult?.count ?? 0) });
  }
);

// PUT /etablissements/:id/desactiver
router.put(
  "/etablissements/:id/desactiver",
  authMiddleware,
  requireRole("dev"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [etab] = await db
      .update(etablissementsTable)
      .set({ licence_active: false })
      .where(eq(etablissementsTable.id, rawId))
      .returning();

    if (!etab) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    // Suspension en cascade de tous les comptes de l'établissement
    await db
      .update(utilisateursTable)
      .set({ actif: false })
      .where(eq(utilisateursTable.etablissement_id, rawId));

    res.json({
      message: "Établissement désactivé et tous ses comptes suspendus.",
    });
  }
);

export default router;
