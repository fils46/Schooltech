import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, configAbsencesTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

const CONFIG_DEFAUT = {
  mode_saisie: "par_cours" as const,
  seuil_alerte_1: 3,
  seuil_alerte_2: 6,
  seuil_alerte_3: 10,
  periode_calcul: "trimestre" as const,
  heure_debut_matin: "07:30",
  heure_fin_matin: "12:30",
  heure_debut_aprem: "13:30",
  heure_fin_aprem: "17:30",
  notifier_parent_seuil_1: true,
  notifier_parent_seuil_2: true,
  notifier_parent_seuil_3: true,
  notifier_censeur_seuil_1: false,
  notifier_censeur_seuil_2: true,
  notifier_censeur_seuil_3: true,
  notifier_directeur_seuil_3: true,
};

/* ── GET /api/absences/config ──────────────────────────── */
router.get("/absences/config", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur"].includes(user.role)) {
    res.status(403).json({ success: false, message: "Accès refusé." });
    return;
  }

  const etablissementId = user.etablissement_id ?? "";
  const [config] = await db.select().from(configAbsencesTable)
    .where(eq(configAbsencesTable.etablissement_id, etablissementId)).limit(1);

  res.json({ success: true, config: config ?? { ...CONFIG_DEFAUT, etablissement_id: etablissementId } });
});

/* ── PUT /api/absences/config ──────────────────────────── */
router.put("/absences/config", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur"].includes(user.role)) {
    res.status(403).json({ success: false, message: "Accès réservé au directeur." });
    return;
  }

  const etablissementId = user.etablissement_id ?? "";
  const body = req.body as Partial<typeof CONFIG_DEFAUT>;

  const existing = await db.select({ id: configAbsencesTable.id })
    .from(configAbsencesTable)
    .where(eq(configAbsencesTable.etablissement_id, etablissementId)).limit(1);

  if (existing.length > 0) {
    const [updated] = await db.update(configAbsencesTable)
      .set({ ...body, updated_at: new Date() })
      .where(eq(configAbsencesTable.etablissement_id, etablissementId))
      .returning();
    res.json({ success: true, message: "Configuration mise à jour.", config: updated });
  } else {
    const [created] = await db.insert(configAbsencesTable).values({
      etablissement_id: etablissementId,
      ...CONFIG_DEFAUT,
      ...body,
    }).returning();
    res.status(201).json({ success: true, message: "Configuration créée.", config: created });
  }
});

export default router;
