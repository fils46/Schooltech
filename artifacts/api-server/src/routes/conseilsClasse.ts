import { Router } from "express";
import { eq, and } from "drizzle-orm";
import {
  db, conseilsClasseTable, classesTable, utilisateursTable,
  bulletinsTable, matieresConfigTable, bulletinDetailsTable,
  anneesScolairesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

const ROLES_ADMIN = ["dev", "directeur", "censeur"];

async function enrichirConseil(c: typeof conseilsClasseTable.$inferSelect) {
  const [classe] = await db
    .select({ nom: classesTable.nom })
    .from(classesTable)
    .where(eq(classesTable.id, c.classe_id))
    .limit(1);
  const [president] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, c.president_id))
    .limit(1);
  return {
    ...c,
    classe_nom: classe?.nom ?? null,
    president_nom: president ? `${president.prenoms} ${president.nom}` : null,
  };
}

/* ─── POST /api/conseils/planifier ──────────────────────────── */
router.post(
  "/api/conseils/planifier",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const { classe_id, annee_scolaire_id, trimestre, date_conseil, president_id, participants } =
      req.body as Record<string, unknown>;

    if (!classe_id || !annee_scolaire_id || !trimestre || !date_conseil || !president_id) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const etabId = user.etablissement_id ?? "";

    // Vérifier si un conseil existe déjà
    const [existing] = await db
      .select()
      .from(conseilsClasseTable)
      .where(
        and(
          eq(conseilsClasseTable.classe_id, String(classe_id)),
          eq(conseilsClasseTable.annee_scolaire_id, String(annee_scolaire_id)),
          eq(conseilsClasseTable.trimestre, String(trimestre) as "1" | "2" | "3"),
          eq(conseilsClasseTable.etablissement_id, etabId)
        )
      )
      .limit(1);

    if (existing) {
      res.status(409).json({ message: "Un conseil de classe existe déjà pour cette classe et ce trimestre." });
      return;
    }

    const [conseil] = await db
      .insert(conseilsClasseTable)
      .values({
        etablissement_id: etabId,
        classe_id: String(classe_id),
        annee_scolaire_id: String(annee_scolaire_id),
        trimestre: String(trimestre) as "1" | "2" | "3",
        date_conseil: String(date_conseil),
        president_id: String(president_id),
        participants: participants ?? null,
        statut: "planifie",
      })
      .returning();

    const enriched = await enrichirConseil(conseil);
    res.json({ conseil: enriched });
  }
);

/* ─── GET /api/conseils/liste ────────────────────────────────── */
router.get(
  "/api/conseils/liste",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const { classe_id, trimestre, statut, annee_scolaire_id } = req.query as Record<string, string>;

    const conditions = [];
    if (user.role !== "dev") {
      conditions.push(eq(conseilsClasseTable.etablissement_id, user.etablissement_id ?? ""));
    }
    if (classe_id) conditions.push(eq(conseilsClasseTable.classe_id, classe_id));
    if (trimestre) conditions.push(eq(conseilsClasseTable.trimestre, trimestre as "1" | "2" | "3"));
    if (statut) conditions.push(eq(conseilsClasseTable.statut, statut as "planifie" | "en_cours" | "termine"));
    if (annee_scolaire_id) conditions.push(eq(conseilsClasseTable.annee_scolaire_id, annee_scolaire_id));

    const rows = await db
      .select()
      .from(conseilsClasseTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const enriched = await Promise.all(rows.map(enrichirConseil));
    res.json({ conseils: enriched });
  }
);

/* ─── GET /api/conseils/:id ──────────────────────────────────── */
router.get(
  "/api/conseils/:id",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const [conseil] = await db
      .select()
      .from(conseilsClasseTable)
      .where(eq(conseilsClasseTable.id, id))
      .limit(1);

    if (!conseil) {
      res.status(404).json({ message: "Conseil introuvable." });
      return;
    }

    const enriched = await enrichirConseil(conseil);
    res.json({ conseil: enriched });
  }
);

/* ─── PUT /api/conseils/:id/demarrer ────────────────────────── */
router.put(
  "/api/conseils/:id/demarrer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const id = normalizeId(req.params.id);
    const [existing] = await db
      .select()
      .from(conseilsClasseTable)
      .where(eq(conseilsClasseTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Conseil introuvable." });
      return;
    }
    if (existing.statut !== "planifie") {
      res.status(400).json({ message: "Le conseil doit être en statut 'planifié' pour être démarré." });
      return;
    }

    const [updated] = await db
      .update(conseilsClasseTable)
      .set({ statut: "en_cours", updated_at: new Date() })
      .where(eq(conseilsClasseTable.id, id))
      .returning();

    const enriched = await enrichirConseil(updated);
    res.json({ conseil: enriched });
  }
);

/* ─── PUT /api/conseils/:id/terminer ────────────────────────── */
router.put(
  "/api/conseils/:id/terminer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const id = normalizeId(req.params.id);
    const { observations_generales } = req.body as { observations_generales?: string };

    const [existing] = await db
      .select()
      .from(conseilsClasseTable)
      .where(eq(conseilsClasseTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Conseil introuvable." });
      return;
    }
    if (existing.statut === "termine") {
      res.status(400).json({ message: "Le conseil est déjà terminé." });
      return;
    }

    const [updated] = await db
      .update(conseilsClasseTable)
      .set({
        statut: "termine",
        observations_generales: observations_generales ?? existing.observations_generales,
        updated_at: new Date(),
      })
      .where(eq(conseilsClasseTable.id, id))
      .returning();

    // Déclencher le recalcul des rangs pour cette classe
    const bulletins = await db
      .select()
      .from(bulletinsTable)
      .where(
        and(
          eq(bulletinsTable.classe_id, existing.classe_id),
          eq(bulletinsTable.annee_scolaire_id, existing.annee_scolaire_id),
          eq(bulletinsTable.trimestre, existing.trimestre)
        )
      );

    if (bulletins.length > 0) {
      const sorted = [...bulletins]
        .filter(b => b.moyenne_generale !== null)
        .sort((a, b) => Number(b.moyenne_generale) - Number(a.moyenne_generale));

      let rang = 1;
      let prev: number | null = null;
      let prevRang = 1;

      for (let i = 0; i < sorted.length; i++) {
        const moy = Number(sorted[i].moyenne_generale);
        if (prev !== null && moy < prev) {
          rang = i + 1;
        }
        if (prev === null || moy !== prev) {
          prevRang = rang;
        }
        await db
          .update(bulletinsTable)
          .set({ rang: prevRang, effectif_classe: bulletins.length, updated_at: new Date() })
          .where(eq(bulletinsTable.id, sorted[i].id));
        prev = moy;
      }
    }

    const enriched = await enrichirConseil(updated);
    res.json({ conseil: enriched });
  }
);

export default router;
