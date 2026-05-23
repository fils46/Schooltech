import { Router } from "express";
import { eq, and, ne } from "drizzle-orm";
import { db, creneauxHorairesTable, emploisDuTempsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

/* ─── Helpers ─────────────────────────────────────────────── */
function heureEnMinutes(h: string): number {
  const [hh, mm] = h.split(":").map(Number);
  return (hh ?? 0) * 60 + (mm ?? 0);
}

function creneauxSeChevauchent(
  debut1: string, fin1: string,
  debut2: string, fin2: string
): boolean {
  const d1 = heureEnMinutes(debut1);
  const f1 = heureEnMinutes(fin1);
  const d2 = heureEnMinutes(debut2);
  const f2 = heureEnMinutes(fin2);
  return d1 < f2 && d2 < f1;
}

/* ─── Lister les créneaux ────────────────────────────────── */
router.get("/creneaux/liste", authMiddleware, async (req, res): Promise<void> => {
  const user = req.user!;
  const etabId = user.role === "dev"
    ? (req.query.etablissement_id as string | undefined)
    : user.etablissement_id;

  if (!etabId) { res.json({ creneaux: [], total: 0 }); return; }

  try {
    const creneaux = await db
      .select()
      .from(creneauxHorairesTable)
      .where(eq(creneauxHorairesTable.etablissement_id, etabId))
      .orderBy(creneauxHorairesTable.ordre);

    res.json({ creneaux, total: creneaux.length });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ─── Créer un créneau ───────────────────────────────────── */
router.post(
  "/creneaux/creer",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { heure_debut, heure_fin, libelle, ordre, etablissement_id } =
      req.body as Record<string, unknown>;

    if (
      typeof heure_debut !== "string" || !heure_debut ||
      typeof heure_fin !== "string" || !heure_fin ||
      typeof libelle !== "string" || !libelle.trim()
    ) {
      res.status(400).json({ message: "heure_debut, heure_fin et libelle sont requis." });
      return;
    }

    if (heureEnMinutes(heure_debut) >= heureEnMinutes(heure_fin)) {
      res.status(400).json({ message: "heure_debut doit être avant heure_fin." });
      return;
    }

    const etabId = user.role === "dev"
      ? (typeof etablissement_id === "string" ? etablissement_id : null)
      : user.etablissement_id;
    if (!etabId) { res.status(400).json({ message: "Établissement requis." }); return; }

    try {
      const existants = await db
        .select()
        .from(creneauxHorairesTable)
        .where(and(
          eq(creneauxHorairesTable.etablissement_id, etabId),
          eq(creneauxHorairesTable.actif, true)
        ));

      const chevauchement = existants.find(c =>
        creneauxSeChevauchent(heure_debut, heure_fin, c.heure_debut, c.heure_fin)
      );

      if (chevauchement) {
        res.status(400).json({
          message: `Chevauchement avec le créneau "${chevauchement.libelle}" (${chevauchement.heure_debut}-${chevauchement.heure_fin}).`,
        });
        return;
      }

      const maxOrdre = existants.length > 0
        ? Math.max(...existants.map(c => c.ordre)) + 1
        : 0;

      const [creneau] = await db
        .insert(creneauxHorairesTable)
        .values({
          etablissement_id: etabId,
          heure_debut,
          heure_fin,
          libelle: libelle.trim(),
          ordre: typeof ordre === "number" ? ordre : maxOrdre,
          actif: true,
        })
        .returning();

      res.status(201).json(creneau);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Modifier un créneau ────────────────────────────────── */
router.put(
  "/creneaux/:id/modifier",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { heure_debut, heure_fin, libelle, ordre } = req.body as Record<string, unknown>;

    try {
      const rows = await db
        .select()
        .from(creneauxHorairesTable)
        .where(eq(creneauxHorairesTable.id, rawId))
        .limit(1);
      const creneau = rows[0];
      if (!creneau) { res.status(404).json({ message: "Créneau introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== creneau.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const newDebut = typeof heure_debut === "string" ? heure_debut : creneau.heure_debut;
      const newFin   = typeof heure_fin   === "string" ? heure_fin   : creneau.heure_fin;

      if (heureEnMinutes(newDebut) >= heureEnMinutes(newFin)) {
        res.status(400).json({ message: "heure_debut doit être avant heure_fin." }); return;
      }

      // Vérifier chevauchement avec les autres créneaux
      const autres = await db
        .select()
        .from(creneauxHorairesTable)
        .where(and(
          eq(creneauxHorairesTable.etablissement_id, creneau.etablissement_id),
          eq(creneauxHorairesTable.actif, true),
          ne(creneauxHorairesTable.id, rawId)
        ));

      const chevauchement = autres.find(c =>
        creneauxSeChevauchent(newDebut, newFin, c.heure_debut, c.heure_fin)
      );
      if (chevauchement) {
        res.status(400).json({
          message: `Chevauchement avec le créneau "${chevauchement.libelle}".`,
        });
        return;
      }

      const [updated] = await db
        .update(creneauxHorairesTable)
        .set({
          heure_debut: newDebut,
          heure_fin: newFin,
          libelle: typeof libelle === "string" ? libelle.trim() : creneau.libelle,
          ordre: typeof ordre === "number" ? ordre : creneau.ordre,
          updated_at: new Date(),
        })
        .where(eq(creneauxHorairesTable.id, rawId))
        .returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Supprimer un créneau ───────────────────────────────── */
router.delete(
  "/creneaux/:id/supprimer",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db
        .select()
        .from(creneauxHorairesTable)
        .where(eq(creneauxHorairesTable.id, rawId))
        .limit(1);
      const creneau = rows[0];
      if (!creneau) { res.status(404).json({ message: "Créneau introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== creneau.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const [coursUtilisant] = await db
        .select({ id: emploisDuTempsTable.id })
        .from(emploisDuTempsTable)
        .where(eq(emploisDuTempsTable.creneau_id, rawId))
        .limit(1);

      if (coursUtilisant) {
        res.status(400).json({ message: "Ce créneau est utilisé par des cours. Supprimez d'abord les cours concernés." });
        return;
      }

      await db.delete(creneauxHorairesTable).where(eq(creneauxHorairesTable.id, rawId));
      res.json({ message: "Créneau supprimé." });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

export default router;
