import { Router } from "express";
import { db } from "@workspace/db";
import { classesTable } from "@workspace/db";
import { eq, and, type SQL } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

/* ─── Validation manuelle ────────────────────────────────── */
function validateClasseInput(body: unknown): {
  nom: string;
  niveau: string;
  section: string;
  annee_scolaire: number;
  capacite_max?: number | null;
  etablissement_id?: string;
} | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  if (typeof b.nom !== "string" || b.nom.trim() === "") return null;
  if (typeof b.niveau !== "string" || b.niveau.trim() === "") return null;
  if (typeof b.section !== "string" || b.section.trim() === "") return null;
  const annee = Number(b.annee_scolaire);
  if (!Number.isInteger(annee) || annee < 2000 || annee > 2100) return null;
  return {
    nom:            b.nom.trim(),
    niveau:         b.niveau.trim(),
    section:        b.section.trim(),
    annee_scolaire: annee,
    capacite_max:   (b.capacite_max != null && b.capacite_max !== "") ? Number(b.capacite_max) : null,
    etablissement_id: typeof b.etablissement_id === "string" ? b.etablissement_id : undefined,
  };
}

/* ─── Liste des classes ──────────────────────────────────── */
router.get(
  "/classes/liste",
  authMiddleware,
  async (req, res) => {
    const user = req.user!;
    const { annee_scolaire, niveau } = req.query as Record<string, string>;

    try {
      const conditions: SQL<unknown>[] = [];

      if (user.role !== "dev") {
        if (!user.etablissement_id) { res.status(403).json({ message: "Accès refusé." }); return; }
        conditions.push(eq(classesTable.etablissement_id, user.etablissement_id));
      }
      if (annee_scolaire) {
        const yr = parseInt(annee_scolaire);
        if (!isNaN(yr)) conditions.push(eq(classesTable.annee_scolaire, yr));
      }
      if (niveau) {
        conditions.push(eq(classesTable.niveau, niveau));
      }

      const classes = conditions.length > 0
        ? await db.select().from(classesTable)
            .where(and(...conditions))
            .orderBy(classesTable.niveau, classesTable.section)
        : await db.select().from(classesTable)
            .orderBy(classesTable.niveau, classesTable.section);

      res.json({ classes, total: classes.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Créer une classe ───────────────────────────────────── */
router.post(
  "/classes/creer",
  authMiddleware,
  requireRole("dev", "directeur", "censeur"),
  async (req, res) => {
    const user = req.user!;
    const data = validateClasseInput(req.body);
    if (!data) { res.status(400).json({ message: "Données invalides." }); return; }

    const etabId = user.role === "dev"
      ? (data.etablissement_id ?? null)
      : user.etablissement_id;

    if (!etabId) { res.status(400).json({ message: "Établissement requis." }); return; }

    try {
      const existing = await db.select({ id: classesTable.id })
        .from(classesTable)
        .where(and(
          eq(classesTable.etablissement_id, etabId),
          eq(classesTable.nom, data.nom),
          eq(classesTable.annee_scolaire, data.annee_scolaire),
        ))
        .limit(1);

      if (existing.length > 0) {
        res.status(400).json({ message: `La classe "${data.nom}" existe déjà pour cette année scolaire.` }); return;
      }

      const [classe] = await db.insert(classesTable).values({
        etablissement_id: etabId,
        nom:            data.nom,
        niveau:         data.niveau,
        section:        data.section,
        annee_scolaire: data.annee_scolaire,
        capacite_max:   data.capacite_max ?? null,
      }).returning();

      res.status(201).json(classe);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Modifier une classe ────────────────────────────────── */
router.put(
  "/classes/:id",
  authMiddleware,
  requireRole("dev", "directeur", "censeur"),
  async (req, res) => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const data = validateClasseInput(req.body);
    if (!data) { res.status(400).json({ message: "Données invalides." }); return; }

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }

      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const updates = await db.update(classesTable)
        .set({
          nom:            data.nom,
          niveau:         data.niveau,
          section:        data.section,
          annee_scolaire: data.annee_scolaire,
          capacite_max:   data.capacite_max ?? null,
          updated_at:     new Date(),
        })
        .where(eq(classesTable.id, rawId))
        .returning();

      res.json(updates[0]);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Supprimer une classe ───────────────────────────────── */
router.delete(
  "/classes/:id",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res) => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }

      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      await db.delete(classesTable).where(eq(classesTable.id, rawId));
      res.json({ message: "Classe supprimée." });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

export default router;
