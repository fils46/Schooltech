import { Router } from "express";
import { eq, and, ne, inArray } from "drizzle-orm";
import {
  db, emploisDuTempsTable, creneauxHorairesTable,
  classesTable, sallesTable, utilisateursTable,
  professeurClassesTable, anneesScolairesTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
type Jour = typeof JOURS[number];

/* ─── Helper : enrichir un cours ─────────────────────────── */
async function enrichirCours(cours: typeof emploisDuTempsTable.$inferSelect) {
  const [classe] = await db
    .select({ nom: classesTable.nom })
    .from(classesTable)
    .where(eq(classesTable.id, cours.classe_id))
    .limit(1);

  const [prof] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, cours.professeur_id))
    .limit(1);

  let salle_nom: string | null = null;
  if (cours.salle_id) {
    const [s] = await db
      .select({ nom: sallesTable.nom })
      .from(sallesTable)
      .where(eq(sallesTable.id, cours.salle_id))
      .limit(1);
    salle_nom = s?.nom ?? null;
  }

  const [creneau] = await db
    .select()
    .from(creneauxHorairesTable)
    .where(eq(creneauxHorairesTable.id, cours.creneau_id))
    .limit(1);

  return {
    ...cours,
    classe_nom: classe?.nom ?? null,
    professeur_nom: prof ? `${prof.prenoms} ${prof.nom}` : null,
    salle_nom,
    creneau_libelle: creneau?.libelle ?? null,
    creneau_debut: creneau?.heure_debut ?? null,
    creneau_fin: creneau?.heure_fin ?? null,
    creneau_ordre: creneau?.ordre ?? null,
  };
}

/* ─── Helper : vérifier conflits ─────────────────────────── */
async function verifierConflitsInsertion(params: {
  classe_id: string;
  professeur_id: string;
  salle_id?: string | null;
  jour: Jour;
  creneau_id: string;
  annee_scolaire_id: string;
  exclude_id?: string;
}): Promise<{ type: string; message: string }[]> {
  const conflits: { type: string; message: string }[] = [];

  const baseCondition = and(
    eq(emploisDuTempsTable.jour, params.jour),
    eq(emploisDuTempsTable.creneau_id, params.creneau_id),
    eq(emploisDuTempsTable.annee_scolaire_id, params.annee_scolaire_id),
    params.exclude_id ? ne(emploisDuTempsTable.id, params.exclude_id) : undefined
  );

  // Conflit professeur
  const [conflitProf] = await db
    .select()
    .from(emploisDuTempsTable)
    .where(and(baseCondition, eq(emploisDuTempsTable.professeur_id, params.professeur_id)))
    .limit(1);
  if (conflitProf) {
    conflits.push({ type: "professeur", message: "Ce professeur a déjà un cours à ce créneau." });
  }

  // Conflit classe
  const [conflitClasse] = await db
    .select()
    .from(emploisDuTempsTable)
    .where(and(baseCondition, eq(emploisDuTempsTable.classe_id, params.classe_id)))
    .limit(1);
  if (conflitClasse) {
    conflits.push({ type: "classe", message: "Cette classe a déjà un cours à ce créneau." });
  }

  // Conflit salle
  if (params.salle_id) {
    const [conflitSalle] = await db
      .select()
      .from(emploisDuTempsTable)
      .where(and(baseCondition, eq(emploisDuTempsTable.salle_id, params.salle_id)))
      .limit(1);
    if (conflitSalle) {
      conflits.push({ type: "salle", message: "Cette salle est déjà occupée à ce créneau." });
    }
  }

  return conflits;
}

/* ─── Vérifier disponibilité ─────────────────────────────── */
router.post(
  "/emploi-du-temps/verifier-disponibilite",
  authMiddleware,
  async (req, res): Promise<void> => {
    const { classe_id, professeur_id, salle_id, jour, creneau_id, annee_scolaire_id, exclude_id } =
      req.body as Record<string, string>;

    if (!classe_id || !professeur_id || !jour || !creneau_id || !annee_scolaire_id) {
      res.status(400).json({ message: "Paramètres manquants." });
      return;
    }

    if (!JOURS.includes(jour as Jour)) {
      res.status(400).json({ message: "Jour invalide." });
      return;
    }

    try {
      const conflits = await verifierConflitsInsertion({
        classe_id, professeur_id,
        salle_id: salle_id || null,
        jour: jour as Jour,
        creneau_id, annee_scolaire_id,
        exclude_id: exclude_id || undefined,
      });

      res.json({ disponible: conflits.length === 0, conflits });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Créer un cours ─────────────────────────────────────── */
router.post(
  "/emploi-du-temps/creer",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { classe_id, professeur_id, salle_id, matiere, jour, creneau_id,
            annee_scolaire_id, couleur, etablissement_id } =
      req.body as Record<string, unknown>;

    if (
      typeof classe_id !== "string" || typeof professeur_id !== "string" ||
      typeof matiere !== "string" || !matiere.trim() ||
      typeof jour !== "string" || !JOURS.includes(jour as Jour) ||
      typeof creneau_id !== "string" || typeof annee_scolaire_id !== "string"
    ) {
      res.status(400).json({ message: "Données invalides." });
      return;
    }

    const etabId = user.role === "dev"
      ? (typeof etablissement_id === "string" ? etablissement_id : null)
      : user.etablissement_id;
    if (!etabId) { res.status(400).json({ message: "Établissement requis." }); return; }

    try {
      const conflits = await verifierConflitsInsertion({
        classe_id, professeur_id,
        salle_id: typeof salle_id === "string" ? salle_id : null,
        jour: jour as Jour,
        creneau_id, annee_scolaire_id,
      });

      if (conflits.length > 0) {
        res.status(400).json({ message: conflits[0]!.message, conflits });
        return;
      }

      const [cours] = await db
        .insert(emploisDuTempsTable)
        .values({
          etablissement_id: etabId,
          annee_scolaire_id,
          classe_id,
          professeur_id,
          salle_id: typeof salle_id === "string" ? salle_id : null,
          matiere: matiere.trim(),
          jour: jour as Jour,
          creneau_id,
          couleur: typeof couleur === "string" ? couleur : null,
        })
        .returning();

      res.status(201).json(await enrichirCours(cours!));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Modifier un cours ──────────────────────────────────── */
router.put(
  "/emploi-du-temps/:id/modifier",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { classe_id, professeur_id, salle_id, matiere, jour, creneau_id,
            annee_scolaire_id, couleur } = req.body as Record<string, unknown>;

    try {
      const rows = await db
        .select()
        .from(emploisDuTempsTable)
        .where(eq(emploisDuTempsTable.id, rawId))
        .limit(1);
      const cours = rows[0];
      if (!cours) { res.status(404).json({ message: "Cours introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== cours.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const newJour = (typeof jour === "string" && JOURS.includes(jour as Jour))
        ? jour as Jour : cours.jour;
      const newCreneau = typeof creneau_id === "string" ? creneau_id : cours.creneau_id;
      const newClasse  = typeof classe_id === "string" ? classe_id : cours.classe_id;
      const newProf    = typeof professeur_id === "string" ? professeur_id : cours.professeur_id;
      const newSalle   = typeof salle_id === "string" ? salle_id : cours.salle_id;
      const newAnnee   = typeof annee_scolaire_id === "string" ? annee_scolaire_id : cours.annee_scolaire_id;

      const conflits = await verifierConflitsInsertion({
        classe_id: newClasse, professeur_id: newProf, salle_id: newSalle,
        jour: newJour, creneau_id: newCreneau, annee_scolaire_id: newAnnee,
        exclude_id: rawId,
      });

      if (conflits.length > 0) {
        res.status(400).json({ message: conflits[0]!.message, conflits });
        return;
      }

      const [updated] = await db
        .update(emploisDuTempsTable)
        .set({
          classe_id: newClasse,
          professeur_id: newProf,
          salle_id: newSalle,
          matiere: typeof matiere === "string" ? matiere.trim() : cours.matiere,
          jour: newJour,
          creneau_id: newCreneau,
          annee_scolaire_id: newAnnee,
          couleur: typeof couleur === "string" ? couleur : cours.couleur,
          updated_at: new Date(),
        })
        .where(eq(emploisDuTempsTable.id, rawId))
        .returning();

      res.json(await enrichirCours(updated!));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Supprimer un cours ─────────────────────────────────── */
router.delete(
  "/emploi-du-temps/:id/supprimer",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db
        .select()
        .from(emploisDuTempsTable)
        .where(eq(emploisDuTempsTable.id, rawId))
        .limit(1);
      const cours = rows[0];
      if (!cours) { res.status(404).json({ message: "Cours introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== cours.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      await db.delete(emploisDuTempsTable).where(eq(emploisDuTempsTable.id, rawId));
      res.json({ message: "Cours supprimé." });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Helper : construire grille ─────────────────────────── */
async function construireGrille(
  coursList: (typeof emploisDuTempsTable.$inferSelect)[],
  etabId: string
) {
  const creneaux = await db
    .select()
    .from(creneauxHorairesTable)
    .where(eq(creneauxHorairesTable.etablissement_id, etabId))
    .orderBy(creneauxHorairesTable.ordre);

  const enriched = await Promise.all(coursList.map(enrichirCours));

  const grille: Record<Jour, typeof enriched> = {
    lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [], samedi: [],
  };

  for (const c of enriched) {
    const j = c.jour as Jour;
    if (grille[j]) {
      grille[j].push(c);
    }
  }

  for (const j of JOURS) {
    grille[j].sort((a, b) => (a.creneau_ordre ?? 0) - (b.creneau_ordre ?? 0));
  }

  return { grille, creneaux };
}

/* ─── Emploi du temps d'une classe ──────────────────────── */
router.get(
  "/emploi-du-temps/classe/:classeId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const classeId = Array.isArray(req.params.classeId) ? req.params.classeId[0] : req.params.classeId;
    const anneeId = req.query.annee_scolaire_id as string | undefined;

    try {
      const [classe] = await db
        .select()
        .from(classesTable)
        .where(eq(classesTable.id, classeId))
        .limit(1);

      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }

      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const conditions = [eq(emploisDuTempsTable.classe_id, classeId)];
      if (anneeId) conditions.push(eq(emploisDuTempsTable.annee_scolaire_id, anneeId));

      const coursList = await db
        .select()
        .from(emploisDuTempsTable)
        .where(and(...conditions));

      const etabId = classe.etablissement_id;
      res.json(await construireGrille(coursList, etabId));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Emploi du temps d'un professeur ───────────────────── */
router.get(
  "/emploi-du-temps/professeur/:profId",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const profId = Array.isArray(req.params.profId) ? req.params.profId[0] : req.params.profId;
    const anneeId = req.query.annee_scolaire_id as string | undefined;

    if (user.role === "professeur" && user.id !== profId) {
      res.status(403).json({ message: "Accès refusé." }); return;
    }

    try {
      const [prof] = await db
        .select()
        .from(utilisateursTable)
        .where(eq(utilisateursTable.id, profId))
        .limit(1);

      if (!prof) { res.status(404).json({ message: "Professeur introuvable." }); return; }

      const conditions = [eq(emploisDuTempsTable.professeur_id, profId)];
      if (anneeId) conditions.push(eq(emploisDuTempsTable.annee_scolaire_id, anneeId));

      const coursList = await db
        .select()
        .from(emploisDuTempsTable)
        .where(and(...conditions));

      const etabId = (user.role === "dev" ? prof.etablissement_id : user.etablissement_id) ?? "";
      res.json(await construireGrille(coursList, etabId));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Emploi du temps d'une salle ───────────────────────── */
router.get(
  "/emploi-du-temps/salle/:salleId",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const salleId = Array.isArray(req.params.salleId) ? req.params.salleId[0] : req.params.salleId;
    const anneeId = req.query.annee_scolaire_id as string | undefined;

    try {
      const [salle] = await db
        .select()
        .from(sallesTable)
        .where(eq(sallesTable.id, salleId))
        .limit(1);

      if (!salle) { res.status(404).json({ message: "Salle introuvable." }); return; }

      const conditions = [eq(emploisDuTempsTable.salle_id, salleId)];
      if (anneeId) conditions.push(eq(emploisDuTempsTable.annee_scolaire_id, anneeId));

      const coursList = await db
        .select()
        .from(emploisDuTempsTable)
        .where(and(...conditions));

      const etabId = salle.etablissement_id;
      res.json(await construireGrille(coursList, etabId));
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Vérifier conflits globaux ──────────────────────────── */
router.get(
  "/emploi-du-temps/conflits",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const anneeId = req.query.annee_scolaire_id as string | undefined;

    const etabId = user.role === "dev"
      ? (req.query.etablissement_id as string | undefined)
      : user.etablissement_id;

    if (!etabId) { res.json({ conflits: [], total: 0 }); return; }

    try {
      const conditions = [eq(emploisDuTempsTable.etablissement_id, etabId)];
      if (anneeId) conditions.push(eq(emploisDuTempsTable.annee_scolaire_id, anneeId));

      const coursList = await db
        .select()
        .from(emploisDuTempsTable)
        .where(and(...conditions));

      const conflits: Array<{ type: string; description: string; cours: unknown[] }> = [];

      // Grouper par (jour, creneau_id) pour détecter les conflits
      const groupes = new Map<string, typeof coursList>();
      for (const c of coursList) {
        const key = `${c.jour}|${c.creneau_id}|${c.annee_scolaire_id}`;
        const g = groupes.get(key) ?? [];
        g.push(c);
        groupes.set(key, g);
      }

      for (const [, groupe] of groupes) {
        if (groupe.length < 2) continue;

        // Conflits professeur
        const profMap = new Map<string, typeof coursList>();
        for (const c of groupe) {
          const l = profMap.get(c.professeur_id) ?? [];
          l.push(c);
          profMap.set(c.professeur_id, l);
        }
        for (const [, cs] of profMap) {
          if (cs.length > 1) {
            const enriched = await Promise.all(cs.map(enrichirCours));
            conflits.push({
              type: "professeur",
              description: `${enriched[0]?.professeur_nom ?? "?"} : ${cs.length} cours le même créneau`,
              cours: enriched,
            });
          }
        }

        // Conflits classe
        const classeMap = new Map<string, typeof coursList>();
        for (const c of groupe) {
          const l = classeMap.get(c.classe_id) ?? [];
          l.push(c);
          classeMap.set(c.classe_id, l);
        }
        for (const [, cs] of classeMap) {
          if (cs.length > 1) {
            const enriched = await Promise.all(cs.map(enrichirCours));
            conflits.push({
              type: "classe",
              description: `Classe ${enriched[0]?.classe_nom ?? "?"} : ${cs.length} cours le même créneau`,
              cours: enriched,
            });
          }
        }

        // Conflits salle
        const salleMap = new Map<string, typeof coursList>();
        for (const c of groupe) {
          if (c.salle_id) {
            const l = salleMap.get(c.salle_id) ?? [];
            l.push(c);
            salleMap.set(c.salle_id, l);
          }
        }
        for (const [, cs] of salleMap) {
          if (cs.length > 1) {
            const enriched = await Promise.all(cs.map(enrichirCours));
            conflits.push({
              type: "salle",
              description: `Salle ${enriched[0]?.salle_nom ?? "?"} : ${cs.length} cours le même créneau`,
              cours: enriched,
            });
          }
        }
      }

      res.json({ conflits, total: conflits.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Dupliquer l'emploi du temps ────────────────────────── */
router.post(
  "/emploi-du-temps/dupliquer",
  authMiddleware,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { classe_source_id, classe_destination_id, annee_scolaire_id } =
      req.body as Record<string, unknown>;

    if (
      typeof classe_source_id !== "string" ||
      typeof classe_destination_id !== "string" ||
      typeof annee_scolaire_id !== "string"
    ) {
      res.status(400).json({ message: "classe_source_id, classe_destination_id et annee_scolaire_id sont requis." });
      return;
    }

    try {
      const [srcClasse] = await db
        .select()
        .from(classesTable)
        .where(eq(classesTable.id, classe_source_id))
        .limit(1);
      if (!srcClasse) { res.status(404).json({ message: "Classe source introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== srcClasse.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const coursSrc = await db
        .select()
        .from(emploisDuTempsTable)
        .where(and(
          eq(emploisDuTempsTable.classe_id, classe_source_id),
          eq(emploisDuTempsTable.annee_scolaire_id, annee_scolaire_id)
        ));

      let copies = 0;
      const conflitsMessages: string[] = [];

      for (const c of coursSrc) {
        const conflits = await verifierConflitsInsertion({
          classe_id: classe_destination_id,
          professeur_id: c.professeur_id,
          salle_id: c.salle_id,
          jour: c.jour,
          creneau_id: c.creneau_id,
          annee_scolaire_id,
        });

        if (conflits.length > 0) {
          conflitsMessages.push(`${c.matiere} (${c.jour}) : ${conflits[0]!.message}`);
          continue;
        }

        await db.insert(emploisDuTempsTable).values({
          etablissement_id: srcClasse.etablissement_id,
          annee_scolaire_id,
          classe_id: classe_destination_id,
          professeur_id: c.professeur_id,
          salle_id: c.salle_id,
          matiere: c.matiere,
          jour: c.jour,
          creneau_id: c.creneau_id,
          couleur: c.couleur,
        });
        copies++;
      }

      res.json({
        message: `${copies} cours dupliqué(s), ${conflitsMessages.length} conflit(s) ignoré(s).`,
        copies,
        conflits: conflitsMessages,
      });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

export default router;
