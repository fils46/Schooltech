import { Router } from "express";
import { eq, count, and, sql } from "drizzle-orm";
import { db, etablissementsTable, utilisateursTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

// GET /stats/global
router.get(
  "/stats/global",
  authMiddleware,
  requireRole("dev"),
  async (_req, res): Promise<void> => {
    const [totalEtablissementsResult] = await db
      .select({ count: count() })
      .from(etablissementsTable);

    const [totalUtilisateursResult] = await db
      .select({ count: count() })
      .from(utilisateursTable);

    const [etablissementsActifsResult] = await db
      .select({ count: count() })
      .from(etablissementsTable)
      .where(eq(etablissementsTable.licence_active, true));

    const [licencesExpireeResult] = await db
      .select({ count: count() })
      .from(etablissementsTable)
      .where(eq(etablissementsTable.licence_active, false));

    // Répartition par rôle
    const repartitionRaw = await db
      .select({
        role: utilisateursTable.role,
        count: count(),
      })
      .from(utilisateursTable)
      .groupBy(utilisateursTable.role);

    res.json({
      totalEtablissements: Number(totalEtablissementsResult?.count ?? 0),
      totalUtilisateurs: Number(totalUtilisateursResult?.count ?? 0),
      etablissementsActifs: Number(etablissementsActifsResult?.count ?? 0),
      licencesExpirees: Number(licencesExpireeResult?.count ?? 0),
      repartitionRoles: repartitionRaw.map((r) => ({
        role: r.role,
        count: Number(r.count),
      })),
    });
  }
);

// GET /stats/etablissement/:id
router.get(
  "/stats/etablissement/:id",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;

    // Isolation
    if (user.role === "directeur" && user.etablissement_id !== rawId) {
      res.status(403).json({ message: "Accès refusé." });
      return;
    }

    const [totalResult] = await db
      .select({ count: count() })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.etablissement_id, rawId));

    const [actifsResult] = await db
      .select({ count: count() })
      .from(utilisateursTable)
      .where(
        and(
          eq(utilisateursTable.etablissement_id, rawId),
          eq(utilisateursTable.actif, true)
        )
      );

    const repartitionRaw = await db
      .select({
        role: utilisateursTable.role,
        count: count(),
      })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.etablissement_id, rawId))
      .groupBy(utilisateursTable.role);

    res.json({
      etablissement_id: rawId,
      totalUtilisateurs: Number(totalResult?.count ?? 0),
      totalActifs: Number(actifsResult?.count ?? 0),
      repartitionRoles: repartitionRaw.map((r) => ({
        role: r.role,
        count: Number(r.count),
      })),
    });
  }
);

export default router;
