import { Router, type Request } from "express";
import { eq, and } from "drizzle-orm";
import {
  db,
  sallesTable,
  emploisDuTempsTable,
  creneauxHorairesTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

const TYPES_VALIDES = [
  "classe", "laboratoire", "salle_info", "gymnase",
  "bibliotheque", "salle_reunion", "amphitheatre", "autre",
] as const;
type TypeSalle = typeof TYPES_VALIDES[number];

function toTypeSalle(v: unknown, fallback: TypeSalle = "classe"): TypeSalle {
  return (typeof v === "string" && TYPES_VALIDES.includes(v as TypeSalle))
    ? v as TypeSalle
    : fallback;
}

/* ─── GET /api/salles/liste ──────────────────────────────── */
router.get("/api/salles/liste", authMiddleware, async (req, res) => {
  const r = req as Request;
  const user = r.user!;
  const etabId = user.role === "dev"
    ? (r.query.etablissement_id as string | undefined)
    : user.etablissement_id;

  if (!etabId) { res.json({ salles: [], total: 0 }); return; }

  const typeFilter = r.query.type as string | undefined;
  const actifFilter = r.query.actif as string | undefined;

  try {
    const conditions = [eq(sallesTable.etablissement_id, etabId)];
    if (typeFilter && TYPES_VALIDES.includes(typeFilter as TypeSalle)) {
      conditions.push(eq(sallesTable.type, typeFilter as TypeSalle));
    }
    if (actifFilter !== undefined) {
      conditions.push(eq(sallesTable.actif, actifFilter !== "false"));
    }
    const salles = await db
      .select()
      .from(sallesTable)
      .where(and(...conditions))
      .orderBy(sallesTable.nom);
    res.json({ salles, total: salles.length });
  } catch (err) {
    r.log.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ─── GET /api/salles/disponibles ────────────────────────── */
router.get("/api/salles/disponibles", authMiddleware, async (req, res) => {
  const r = req as Request;
  const user = r.user!;
  const { jour, creneau_id, annee_scolaire_id, capacite_min } = r.query as Record<string, string>;

  if (!jour || !creneau_id || !annee_scolaire_id) {
    res.status(400).json({ message: "jour, creneau_id, annee_scolaire_id requis." }); return;
  }

  const etabId = user.role === "dev"
    ? (r.query.etablissement_id as string | undefined)
    : user.etablissement_id;

  if (!etabId) { res.json({ salles: [], total: 0 }); return; }

  try {
    const occupees = await db
      .select({ salle_id: emploisDuTempsTable.salle_id })
      .from(emploisDuTempsTable)
      .where(
        and(
          eq(emploisDuTempsTable.etablissement_id, etabId),
          eq(emploisDuTempsTable.annee_scolaire_id, annee_scolaire_id),
          eq(emploisDuTempsTable.jour, jour as "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi"),
          eq(emploisDuTempsTable.creneau_id, creneau_id),
        )
      );

    const occupeesIds = occupees.map(o => o.salle_id).filter((id): id is string => id !== null);

    const allSalles = await db
      .select()
      .from(sallesTable)
      .where(and(eq(sallesTable.etablissement_id, etabId), eq(sallesTable.actif, true)))
      .orderBy(sallesTable.nom);

    const capMin = capacite_min ? parseInt(capacite_min) : null;

    const disponibles = allSalles.filter(s =>
      !occupeesIds.includes(s.id) &&
      (capMin === null || (s.capacite !== null && s.capacite >= capMin))
    );

    res.json({ salles: disponibles, total: disponibles.length });
  } catch (err) {
    r.log.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ─── GET /api/salles/conflits ───────────────────────────── */
router.get("/api/salles/conflits", authMiddleware, requireRole("directeur", "censeur", "dev"), async (req, res) => {
  const r = req as Request;
  const user = r.user!;
  const { annee_scolaire_id } = r.query as Record<string, string>;

  if (!annee_scolaire_id) {
    res.status(400).json({ message: "annee_scolaire_id requis." }); return;
  }

  const etabId = user.role === "dev"
    ? (r.query.etablissement_id as string | undefined)
    : user.etablissement_id;

  if (!etabId) { res.json({ conflits: [], total: 0 }); return; }

  try {
    const cours = await db
      .select({
        id: emploisDuTempsTable.id,
        salle_id: emploisDuTempsTable.salle_id,
        jour: emploisDuTempsTable.jour,
        creneau_id: emploisDuTempsTable.creneau_id,
        classe_id: emploisDuTempsTable.classe_id,
        professeur_id: emploisDuTempsTable.professeur_id,
        matiere: emploisDuTempsTable.matiere,
        salle_nom: sallesTable.nom,
        salle_type: sallesTable.type,
      })
      .from(emploisDuTempsTable)
      .leftJoin(sallesTable, eq(sallesTable.id, emploisDuTempsTable.salle_id))
      .where(
        and(
          eq(emploisDuTempsTable.etablissement_id, etabId),
          eq(emploisDuTempsTable.annee_scolaire_id, annee_scolaire_id),
        )
      );

    const groupes: Record<string, typeof cours> = {};
    for (const c of cours) {
      if (!c.salle_id) continue;
      const key = `${c.salle_id}|${c.jour}|${c.creneau_id}`;
      if (!groupes[key]) groupes[key] = [];
      groupes[key].push(c);
    }

    const conflits = Object.entries(groupes)
      .filter(([, g]) => g.length > 1)
      .map(([key, g]) => {
        const [salle_id, jour, creneau_id] = key.split("|");
        return {
          salle_id,
          salle_nom: g[0].salle_nom,
          salle_type: g[0].salle_type,
          jour,
          creneau_id,
          creneaux_conflictuels: g.map(c => ({
            id: c.id,
            classe_id: c.classe_id,
            professeur_id: c.professeur_id,
            matiere: c.matiere,
          })),
        };
      });

    res.json({ conflits, total: conflits.length });
  } catch (err) {
    r.log.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ─── GET /api/salles/:id/disponibilite ──────────────────── */
router.get("/api/salles/:id/disponibilite", authMiddleware, async (req, res) => {
  const r = req as Request;
  const user = r.user!;
  const rawId = String(r.params.id);
  const { annee_scolaire_id } = r.query as Record<string, string>;

  if (!annee_scolaire_id) {
    res.status(400).json({ message: "annee_scolaire_id requis." }); return;
  }

  try {
    const salleRows = await db.select().from(sallesTable).where(eq(sallesTable.id, rawId)).limit(1);
    const salle = salleRows[0];
    if (!salle) { res.status(404).json({ message: "Salle introuvable." }); return; }
    if (user.role !== "dev" && user.etablissement_id !== salle.etablissement_id) {
      res.status(403).json({ message: "Accès refusé." }); return;
    }

    const creneauxOccupes = await db
      .select({
        id: emploisDuTempsTable.id,
        jour: emploisDuTempsTable.jour,
        creneau_id: emploisDuTempsTable.creneau_id,
        matiere: emploisDuTempsTable.matiere,
        classe_id: emploisDuTempsTable.classe_id,
        creneau_libelle: creneauxHorairesTable.libelle,
        creneau_heure_debut: creneauxHorairesTable.heure_debut,
        creneau_heure_fin: creneauxHorairesTable.heure_fin,
      })
      .from(emploisDuTempsTable)
      .leftJoin(creneauxHorairesTable, eq(creneauxHorairesTable.id, emploisDuTempsTable.creneau_id))
      .where(
        and(
          eq(emploisDuTempsTable.salle_id, rawId),
          eq(emploisDuTempsTable.annee_scolaire_id, annee_scolaire_id),
        )
      );

    const tousCreneaux = await db
      .select()
      .from(creneauxHorairesTable)
      .where(and(eq(creneauxHorairesTable.etablissement_id, salle.etablissement_id), eq(creneauxHorairesTable.actif, true)))
      .orderBy(creneauxHorairesTable.ordre);

    const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
    const occupesKeys = new Set(creneauxOccupes.map(c => `${c.jour}|${c.creneau_id}`));

    const creneauxLibres = [];
    for (const jour of JOURS) {
      for (const creneau of tousCreneaux) {
        if (!occupesKeys.has(`${jour}|${creneau.id}`)) {
          creneauxLibres.push({
            jour,
            creneau_id: creneau.id,
            libelle: creneau.libelle,
            heure_debut: creneau.heure_debut,
            heure_fin: creneau.heure_fin,
          });
        }
      }
    }

    res.json({ salle, creneaux_occupes: creneauxOccupes, creneaux_libres: creneauxLibres });
  } catch (err) {
    r.log.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ─── POST /api/salles/creer ─────────────────────────────── */
router.post("/api/salles/creer", authMiddleware, requireRole("directeur", "censeur", "dev"), async (req, res) => {
  const r = req as Request;
  const user = r.user!;
  const { nom, capacite, type, equipements, etage, batiment, etablissement_id } = r.body as Record<string, unknown>;

  if (typeof nom !== "string" || !nom.trim()) {
    res.status(400).json({ message: "Le nom de la salle est obligatoire." }); return;
  }

  const etabId = user.role === "dev"
    ? (typeof etablissement_id === "string" ? etablissement_id : null)
    : user.etablissement_id;
  if (!etabId) { res.status(400).json({ message: "Établissement requis." }); return; }

  const equipementsList: string[] | null = Array.isArray(equipements)
    ? (equipements as unknown[]).filter((e): e is string => typeof e === "string")
    : null;

  try {
    const inserted = await db.insert(sallesTable).values({
      etablissement_id: etabId,
      nom: nom.trim(),
      capacite: capacite != null ? Number(capacite) : null,
      type: toTypeSalle(type),
      equipements: equipementsList,
      etage: typeof etage === "string" ? etage.trim() || null : null,
      batiment: typeof batiment === "string" ? batiment.trim() || null : null,
      actif: true,
    }).returning();
    res.status(201).json(inserted[0]);
  } catch (err) {
    r.log.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ─── PUT /api/salles/:id/modifier ──────────────────────── */
router.put("/api/salles/:id/modifier", authMiddleware, requireRole("directeur", "censeur", "dev"), async (req, res) => {
  const r = req as Request;
  const user = r.user!;
  const rawId = String(r.params.id);
  const { nom, capacite, type, equipements, etage, batiment } = r.body as Record<string, unknown>;

  try {
    const salleRows = await db.select().from(sallesTable).where(eq(sallesTable.id, rawId)).limit(1);
    const salle = salleRows[0];
    if (!salle) { res.status(404).json({ message: "Salle introuvable." }); return; }
    if (user.role !== "dev" && user.etablissement_id !== salle.etablissement_id) {
      res.status(403).json({ message: "Accès refusé." }); return;
    }

    const equipementsList: string[] | null = Array.isArray(equipements)
      ? (equipements as unknown[]).filter((e): e is string => typeof e === "string")
      : (salle.equipements ?? null);

    const updated = await db.update(sallesTable).set({
      nom: typeof nom === "string" ? nom.trim() : salle.nom,
      capacite: capacite != null ? Number(capacite) : salle.capacite,
      type: toTypeSalle(type, salle.type),
      equipements: equipementsList,
      etage: typeof etage === "string" ? etage.trim() || null : salle.etage,
      batiment: typeof batiment === "string" ? batiment.trim() || null : salle.batiment,
      updated_at: new Date(),
    }).where(eq(sallesTable.id, rawId)).returning();

    res.json(updated[0]);
  } catch (err) {
    r.log.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

/* ─── PUT /api/salles/:id/desactiver ────────────────────── */
router.put("/api/salles/:id/desactiver", authMiddleware, requireRole("directeur", "dev"), async (req, res) => {
  const r = req as Request;
  const user = r.user!;
  const rawId = String(r.params.id);

  try {
    const salleRows = await db.select().from(sallesTable).where(eq(sallesTable.id, rawId)).limit(1);
    const salle = salleRows[0];
    if (!salle) { res.status(404).json({ message: "Salle introuvable." }); return; }
    if (user.role !== "dev" && user.etablissement_id !== salle.etablissement_id) {
      res.status(403).json({ message: "Accès refusé." }); return;
    }

    const coursActif = await db
      .select({ id: emploisDuTempsTable.id })
      .from(emploisDuTempsTable)
      .where(eq(emploisDuTempsTable.salle_id, rawId))
      .limit(1);

    if (coursActif.length > 0) {
      res.status(400).json({ message: "Des cours utilisent encore cette salle. Modifiez-les d'abord." }); return;
    }

    const updated = await db.update(sallesTable)
      .set({ actif: false, updated_at: new Date() })
      .where(eq(sallesTable.id, rawId))
      .returning();

    res.json(updated[0]);
  } catch (err) {
    r.log.error(err);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

export default router;
