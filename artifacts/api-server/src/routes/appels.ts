import { Router } from "express";
import { eq, and, desc, gte, lte, count } from "drizzle-orm";
import {
  db, appelsTable, appelDetailsTable, elevesTable,
  eleveClassesTable, utilisateursTable, classesTable,
  professeurClassesTable, absencesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { declencherNotificationsAbsence } from "../lib/notificationService";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

async function resumeAppel(appelId: string) {
  const details = await db
    .select({ statut: appelDetailsTable.statut })
    .from(appelDetailsTable)
    .where(eq(appelDetailsTable.appel_id, appelId));

  return {
    presents: details.filter(d => d.statut === "present").length,
    absents: details.filter(d => d.statut === "absent").length,
    retards: details.filter(d => d.statut === "retard").length,
    excused: details.filter(d => d.statut === "excused").length,
  };
}

async function enrichirAppel(
  appel: typeof appelsTable.$inferSelect,
  includeDetails = false
) {
  const [prof] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, appel.professeur_id))
    .limit(1);
  const [classe] = await db
    .select({ nom: classesTable.nom })
    .from(classesTable)
    .where(eq(classesTable.id, appel.classe_id))
    .limit(1);

  const resume = await resumeAppel(appel.id);

  let details: Record<string, unknown>[] = [];
  if (includeDetails) {
    const rows = await db
      .select()
      .from(appelDetailsTable)
      .where(eq(appelDetailsTable.appel_id, appel.id));

    details = await Promise.all(
      rows.map(async (d) => {
        const [eleve] = await db
          .select({
            nom: elevesTable.nom,
            prenoms: elevesTable.prenoms,
            matricule: elevesTable.matricule,
            photo_url: elevesTable.photo_url,
          })
          .from(elevesTable)
          .where(eq(elevesTable.id, d.eleve_id))
          .limit(1);
        return {
          ...d,
          eleve_nom: eleve?.nom ?? null,
          eleve_prenoms: eleve?.prenoms ?? null,
          eleve_matricule: eleve?.matricule ?? null,
          eleve_photo_url: eleve?.photo_url ?? null,
        };
      })
    );
  }

  return {
    ...appel,
    professeur_nom: prof ? `${prof.prenoms} ${prof.nom}` : null,
    classe_nom: classe?.nom ?? null,
    resume,
    ...(includeDetails ? { details } : {}),
  };
}

/* ─── POST /api/appels/creer ─────────────────────────────── */
router.post(
  "/appels/creer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const { classe_id, matiere, annee_scolaire_id, date_appel, creneau_id } =
      req.body as Record<string, string>;

    if (!classe_id || !matiere || !annee_scolaire_id || !date_appel) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    // Vérifier que le prof enseigne dans cette classe
    if (user.role === "professeur") {
      const [assoc] = await db
        .select()
        .from(professeurClassesTable)
        .where(
          and(
            eq(professeurClassesTable.professeur_id, user.id),
            eq(professeurClassesTable.classe_id, classe_id),
            eq(professeurClassesTable.matiere, matiere)
          )
        )
        .limit(1);
      if (!assoc) {
        res.status(403).json({ message: "Vous n'enseignez pas cette matière dans cette classe." });
        return;
      }
    }

    // Créer l'appel
    const [appel] = await db
      .insert(appelsTable)
      .values({
        etablissement_id: user.etablissement_id ?? "",
        professeur_id: user.id,
        classe_id,
        matiere,
        annee_scolaire_id,
        date_appel,
        creneau_id: creneau_id ?? null,
        statut: "en_cours",
      })
      .returning();

    // Récupérer tous les élèves actifs de la classe
    const eleveIds = await db
      .select({ eleve_id: eleveClassesTable.eleve_id })
      .from(eleveClassesTable)
      .where(
        and(
          eq(eleveClassesTable.classe_id, classe_id),
          eq(eleveClassesTable.annee_scolaire_id, annee_scolaire_id)
        )
      );

    if (eleveIds.length > 0) {
      await db.insert(appelDetailsTable).values(
        eleveIds.map(({ eleve_id }) => ({
          appel_id: appel.id,
          eleve_id,
          statut: "present" as const,
        }))
      );
    }

    res.status(201).json({
      message: "Appel créé.",
      appel: await enrichirAppel(appel, true),
    });
  }
);

/* ─── GET /api/appels/historique ────────────────────────── */
router.get(
  "/appels/historique",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const { classe_id, matiere, date_debut, date_fin, annee_scolaire_id } =
      req.query as Record<string, string>;

    const conditions = [eq(appelsTable.etablissement_id, user.etablissement_id ?? "")];

    if (user.role === "professeur") {
      conditions.push(eq(appelsTable.professeur_id, user.id));
    }
    if (classe_id) conditions.push(eq(appelsTable.classe_id, classe_id));
    if (matiere) conditions.push(eq(appelsTable.matiere, matiere));
    if (annee_scolaire_id)
      conditions.push(eq(appelsTable.annee_scolaire_id, annee_scolaire_id));
    if (date_debut) conditions.push(gte(appelsTable.date_appel, date_debut));
    if (date_fin) conditions.push(lte(appelsTable.date_appel, date_fin));

    const appels = await db
      .select()
      .from(appelsTable)
      .where(and(...conditions))
      .orderBy(desc(appelsTable.date_appel));

    const enriched = await Promise.all(appels.map(a => enrichirAppel(a, false)));
    res.json({ appels: enriched, total: enriched.length });
  }
);

/* ─── GET /api/appels/eleve/:eleveId ────────────────────── */
router.get(
  "/appels/eleve/:eleveId",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const eleveId = normalizeId(req.params.eleveId);
    const user = req.user!;
    const { matiere, annee_scolaire_id } = req.query as Record<string, string>;

    // Récupérer tous les appel_details pour cet élève
    const rows = await db
      .select()
      .from(appelDetailsTable)
      .innerJoin(appelsTable, eq(appelDetailsTable.appel_id, appelsTable.id))
      .where(
        and(
          eq(appelDetailsTable.eleve_id, eleveId),
          eq(appelsTable.etablissement_id, user.etablissement_id ?? ""),
          ...(matiere ? [eq(appelsTable.matiere, matiere)] : []),
          ...(annee_scolaire_id ? [eq(appelsTable.annee_scolaire_id, annee_scolaire_id)] : [])
        )
      )
      .orderBy(desc(appelsTable.date_appel));

    // Calculer taux par matière
    const parMatiere: Record<string, { presents: number; total: number }> = {};
    for (const row of rows) {
      const m = row.appels.matiere;
      if (!parMatiere[m]) parMatiere[m] = { presents: 0, total: 0 };
      parMatiere[m].total++;
      if (row.appel_details.statut === "present") parMatiere[m].presents++;
    }

    const taux_par_matiere = Object.entries(parMatiere).map(([mat, d]) => ({
      matiere: mat,
      presents: d.presents,
      total: d.total,
      taux: d.total > 0 ? Math.round((d.presents / d.total) * 100) : 100,
    }));

    const presences = rows.map(r => ({
      ...r.appel_details,
      date_appel: r.appels.date_appel,
      matiere: r.appels.matiere,
      classe_id: r.appels.classe_id,
    }));

    res.json({ presences, taux_par_matiere });
  }
);

/* ─── GET /api/appels/:id ───────────────────────────────── */
router.get(
  "/appels/:id",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;

    const [appel] = await db
      .select()
      .from(appelsTable)
      .where(
        and(eq(appelsTable.id, id), eq(appelsTable.etablissement_id, user.etablissement_id ?? ""))
      )
      .limit(1);

    if (!appel) {
      res.status(404).json({ message: "Appel introuvable." });
      return;
    }

    res.json({ appel: await enrichirAppel(appel, true) });
  }
);

/* ─── PUT /api/appels/:id/presence ─────────────────────── */
router.put(
  "/appels/:id/presence",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;
    const { eleve_id, statut, motif } = req.body as Record<string, string>;

    if (!eleve_id || !statut) {
      res.status(400).json({ message: "eleve_id et statut sont obligatoires." });
      return;
    }

    const validStatuts = ["present", "absent", "retard", "excused"];
    if (!validStatuts.includes(statut)) {
      res.status(400).json({ message: "Statut invalide." });
      return;
    }

    const [appel] = await db
      .select()
      .from(appelsTable)
      .where(and(eq(appelsTable.id, id), eq(appelsTable.etablissement_id, user.etablissement_id ?? "")))
      .limit(1);

    if (!appel) {
      res.status(404).json({ message: "Appel introuvable." });
      return;
    }

    if (appel.statut === "termine") {
      res.status(400).json({ message: "Appel déjà terminé." });
      return;
    }

    if (user.role === "professeur" && appel.professeur_id !== user.id) {
      res.status(403).json({ message: "Non autorisé." });
      return;
    }

    const [detail] = await db
      .select()
      .from(appelDetailsTable)
      .where(and(eq(appelDetailsTable.appel_id, id), eq(appelDetailsTable.eleve_id, eleve_id)))
      .limit(1);

    await db
      .update(appelDetailsTable)
      .set({
        statut: statut as "present" | "absent" | "retard" | "excused",
        motif: motif ?? null,
        updated_at: new Date(),
      })
      .where(
        and(eq(appelDetailsTable.appel_id, id), eq(appelDetailsTable.eleve_id, eleve_id))
      );

    if ((statut === "absent" || statut === "retard") && detail) {
      const [existing] = await db
        .select({ id: absencesTable.id })
        .from(absencesTable)
        .where(eq(absencesTable.appel_detail_id, detail.id))
        .limit(1);

      if (!existing) {
        const [absence] = await db.insert(absencesTable).values({
          etablissement_id: appel.etablissement_id,
          eleve_id,
          classe_id: appel.classe_id,
          annee_scolaire_id: appel.annee_scolaire_id,
          appel_detail_id: detail.id,
          matiere: appel.matiere,
          professeur_id: appel.professeur_id,
          date_absence: appel.date_appel,
          creneau_id: appel.creneau_id ?? null,
          type: statut === "retard" ? "retard" : "absence",
        }).returning();

        if (absence) {
          void declencherNotificationsAbsence(absence);
        }
      }
    }

    res.json({ appel: await enrichirAppel(appel, true) });
  }
);

/* ─── PUT /api/appels/:id/terminer ─────────────────────── */
router.put(
  "/appels/:id/terminer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;

    const [appel] = await db
      .select()
      .from(appelsTable)
      .where(and(eq(appelsTable.id, id), eq(appelsTable.etablissement_id, user.etablissement_id ?? "")))
      .limit(1);

    if (!appel) {
      res.status(404).json({ message: "Appel introuvable." });
      return;
    }

    if (user.role === "professeur" && appel.professeur_id !== user.id) {
      res.status(403).json({ message: "Non autorisé." });
      return;
    }

    await db
      .update(appelsTable)
      .set({ statut: "termine", updated_at: new Date() })
      .where(eq(appelsTable.id, id));

    const [updated] = await db.select().from(appelsTable).where(eq(appelsTable.id, id)).limit(1);
    res.json({ appel: await enrichirAppel(updated, true) });
  }
);

// Unused import suppression
void count;

export default router;
