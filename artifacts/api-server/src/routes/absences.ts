import { Router } from "express";
import { eq, and, gte, lte, desc, count, sql } from "drizzle-orm";
import {
  db, absencesTable, justificationsTable, utilisateursTable,
  elevesTable, classesTable, parentsElevesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import {
  creerNotification, envoyerNotificationJustification,
  getDirecteurEtablissement, declencherNotificationsAbsence, SEUIL_ABSENCES,
} from "../lib/notificationService";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

async function getParentEleve(eleveId: string) {
  const rows = await db
    .select({ parent_id: parentsElevesTable.utilisateur_id })
    .from(parentsElevesTable)
    .where(eq(parentsElevesTable.eleve_id, eleveId))
    .limit(1);
  return rows[0]?.parent_id ?? null;
}

async function enrichirAbsence(a: typeof absencesTable.$inferSelect, avecJustif = false) {
  const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
    .from(elevesTable).where(eq(elevesTable.id, a.eleve_id)).limit(1);
  const [prof] = await db.select({ nom: utilisateursTable.nom })
    .from(utilisateursTable).where(eq(utilisateursTable.id, a.professeur_id)).limit(1);
  const [classe] = await db.select({ nom: classesTable.nom })
    .from(classesTable).where(eq(classesTable.id, a.classe_id)).limit(1);

  let justification = null;
  if (avecJustif) {
    const [j] = await db.select().from(justificationsTable)
      .where(eq(justificationsTable.absence_id, a.id)).limit(1);
    justification = j ?? null;
  }

  return {
    ...a,
    eleve_nom: eleve?.nom ?? "",
    eleve_prenoms: eleve?.prenoms ?? "",
    classe_nom: classe?.nom ?? "",
    professeur_nom: prof?.nom ?? "",
    justification,
  };
}

/* ── GET /api/absences/statistiques ────────────────────── */
router.get("/absences/statistiques", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const { classe_id, annee_scolaire_id, trimestre } = req.query as Record<string, string>;

  const roles = ["dev", "directeur", "censeur"];
  if (!roles.includes(user.role)) {
    res.status(403).json({ message: "Accès refusé." });
    return;
  }

  const conditions: ReturnType<typeof eq>[] = [
    eq(absencesTable.etablissement_id, user.etablissement_id ?? ""),
  ];
  if (classe_id) conditions.push(eq(absencesTable.classe_id, classe_id));
  if (annee_scolaire_id) conditions.push(eq(absencesTable.annee_scolaire_id, annee_scolaire_id));

  const absences = await db.select().from(absencesTable).where(and(...conditions));

  const total = absences.length;
  const justifiees = absences.filter(a => a.statut === "justifiee").length;
  const non_justifiees = absences.filter(a => a.statut === "non_justifiee").length;
  const en_attente = absences.filter(a => a.statut === "en_attente").length;

  const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  const parJour = jours.map((jour, i) => ({
    jour,
    count: absences.filter(a => new Date(a.date_absence).getDay() === (i + 1) % 7).length,
  }));

  const parMatiereMap: Record<string, number> = {};
  for (const a of absences) {
    parMatiereMap[a.matiere] = (parMatiereMap[a.matiere] ?? 0) + 1;
  }
  const par_matiere = Object.entries(parMatiereMap).map(([matiere, count]) => ({ matiere, count })).sort((a, b) => b.count - a.count);

  const elevesMap: Record<string, number> = {};
  for (const a of absences) {
    elevesMap[a.eleve_id] = (elevesMap[a.eleve_id] ?? 0) + 1;
  }

  const topAbsentIds = Object.entries(elevesMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const top_absents = await Promise.all(topAbsentIds.map(async ([eleve_id, nb]) => {
    const [e] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
      .from(elevesTable).where(eq(elevesTable.id, eleve_id)).limit(1);
    return { eleve_id, nom: e?.nom ?? "", prenoms: e?.prenoms ?? "", nb_absences: nb };
  }));

  res.json({ statistiques: { total, justifiees, non_justifiees, en_attente, par_jour: parJour, par_matiere, top_absents } });
});

/* ── GET /api/absences/eleves-a-risque ─────────────────── */
router.get("/absences/eleves-a-risque", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const { annee_scolaire_id } = req.query as Record<string, string>;

  const roles = ["dev", "directeur", "censeur"];
  if (!roles.includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }

  const conditions: ReturnType<typeof eq>[] = [
    eq(absencesTable.etablissement_id, user.etablissement_id ?? ""),
    eq(absencesTable.statut, "non_justifiee"),
  ];
  if (annee_scolaire_id) conditions.push(eq(absencesTable.annee_scolaire_id, annee_scolaire_id));

  const rows = await db
    .select({ eleve_id: absencesTable.eleve_id, count: count(), derniere: sql<string>`max(${absencesTable.date_absence})` })
    .from(absencesTable)
    .where(and(...conditions))
    .groupBy(absencesTable.eleve_id)
    .having(sql`count(*) >= ${SEUIL_ABSENCES}`)
    .orderBy(desc(count()));

  const eleves = await Promise.all(rows.map(async r => {
    const [e] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
      .from(elevesTable).where(eq(elevesTable.id, r.eleve_id)).limit(1);
    const lastAbs = await db.select({ classe_id: absencesTable.classe_id })
      .from(absencesTable).where(eq(absencesTable.eleve_id, r.eleve_id)).orderBy(desc(absencesTable.date_absence)).limit(1);
    const classeId = lastAbs[0]?.classe_id;
    const [cls] = classeId ? await db.select({ nom: classesTable.nom }).from(classesTable).where(eq(classesTable.id, classeId)).limit(1) : [null];
    return { eleve_id: r.eleve_id, nom: e?.nom ?? "", prenoms: e?.prenoms ?? "", classe_nom: cls?.nom ?? "", nb_absences: r.count, derniere_absence: r.derniere };
  }));

  res.json({ seuil: SEUIL_ABSENCES, eleves });
});

/* ── GET /api/absences/liste ────────────────────────────── */
router.get("/absences/liste", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const { eleve_id, classe_id, matiere, statut, type, date_debut, date_fin, annee_scolaire_id } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt((req.query["page"] as string) || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query["limit"] as string) || "20", 10)));

  const conditions: ReturnType<typeof eq>[] = [];

  if (user.role === "dev") {
    // dev sees all
  } else if (["directeur", "censeur"].includes(user.role)) {
    conditions.push(eq(absencesTable.etablissement_id, user.etablissement_id ?? ""));
  } else if (user.role === "professeur") {
    conditions.push(eq(absencesTable.etablissement_id, user.etablissement_id ?? ""));
    conditions.push(eq(absencesTable.professeur_id, user.id));
  } else if (user.role === "parent") {
    const enfants = await db.select({ eleve_id: parentsElevesTable.eleve_id })
      .from(parentsElevesTable).where(eq(parentsElevesTable.utilisateur_id, user.id));
    const ids = enfants.map(e => e.eleve_id);
    if (ids.length === 0) { res.json({ absences: [], total: 0, page, limit }); return; }
    conditions.push(sql`${absencesTable.eleve_id} = ANY(${ids})`);
  } else if (user.role === "educateur") {
    conditions.push(eq(absencesTable.etablissement_id, user.etablissement_id ?? ""));
  } else if (user.role === "eleve") {
    conditions.push(eq(absencesTable.eleve_id, user.id));
  } else {
    res.status(403).json({ message: "Accès refusé." }); return;
  }

  if (eleve_id) conditions.push(eq(absencesTable.eleve_id, eleve_id));
  if (classe_id) conditions.push(eq(absencesTable.classe_id, classe_id));
  if (matiere) conditions.push(eq(absencesTable.matiere, matiere));
  if (statut) conditions.push(eq(absencesTable.statut, statut as "non_justifiee" | "en_attente" | "justifiee" | "rejetee"));
  if (type) conditions.push(eq(absencesTable.type, type as "absence" | "retard"));
  if (annee_scolaire_id) conditions.push(eq(absencesTable.annee_scolaire_id, annee_scolaire_id));
  if (date_debut) conditions.push(gte(absencesTable.date_absence, date_debut));
  if (date_fin) conditions.push(lte(absencesTable.date_absence, date_fin));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db.select({ total: count() }).from(absencesTable).where(whereClause);
  const rows = await db.select().from(absencesTable).where(whereClause)
    .orderBy(desc(absencesTable.date_absence))
    .limit(limit).offset((page - 1) * limit);

  const absences = await Promise.all(rows.map(r => enrichirAbsence(r, false)));
  res.json({ absences, total, page, limit });
});

/* ── POST /api/absences/creer ───────────────────────────── */
router.post("/absences/creer", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const roles = ["dev", "directeur", "censeur"];
  if (!roles.includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }

  const { eleve_id, classe_id, annee_scolaire_id, matiere, date_absence, creneau_id, type } = req.body as Record<string, string>;
  if (!eleve_id || !classe_id || !annee_scolaire_id || !matiere || !date_absence || !type) {
    res.status(400).json({ message: "Champs obligatoires manquants." }); return;
  }

  const [absence] = await db.insert(absencesTable).values({
    etablissement_id: user.etablissement_id ?? "",
    eleve_id,
    classe_id,
    annee_scolaire_id,
    matiere,
    professeur_id: user.id,
    date_absence,
    creneau_id: creneau_id ?? null,
    type: type as "absence" | "retard",
    statut: "non_justifiee",
  }).returning();

  if (!absence) { res.status(500).json({ message: "Erreur création absence." }); return; }

  await declencherNotificationsAbsence(absence);
  res.status(201).json({ absence: await enrichirAbsence(absence, false) });
});

/* ── GET /api/absences/eleve/:eleveId/resume ──────────────── */
router.get("/absences/eleve/:eleveId/resume", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const eleveId = normalizeId(req.params["eleveId"]);
  const { annee_scolaire_id } = req.query as Record<string, string>;

  if (user.role === "parent") {
    const enfants = await db.select().from(parentsElevesTable)
      .where(and(eq(parentsElevesTable.utilisateur_id, user.id), eq(parentsElevesTable.eleve_id, eleveId)));
    if (enfants.length === 0) { res.status(403).json({ message: "Accès refusé." }); return; }
  } else if (user.role === "eleve" && user.id !== eleveId) {
    res.status(403).json({ message: "Accès refusé." }); return;
  }

  const conditions: ReturnType<typeof eq>[] = [eq(absencesTable.eleve_id, eleveId)];
  if (annee_scolaire_id) conditions.push(eq(absencesTable.annee_scolaire_id, annee_scolaire_id));

  const absences = await db.select().from(absencesTable).where(and(...conditions));

  const total = absences.length;
  const justifiees = absences.filter(a => a.statut === "justifiee").length;
  const non_justifiees = absences.filter(a => a.statut === "non_justifiee").length;
  const retards = absences.filter(a => a.type === "retard").length;

  const parMatiereMap: Record<string, { total: number; type_absence: number; type_retard: number }> = {};
  for (const a of absences) {
    if (!parMatiereMap[a.matiere]) parMatiereMap[a.matiere] = { total: 0, type_absence: 0, type_retard: 0 };
    parMatiereMap[a.matiere]!.total++;
    if (a.type === "retard") parMatiereMap[a.matiere]!.type_retard++;
    else parMatiereMap[a.matiere]!.type_absence++;
  }
  const par_matiere = Object.entries(parMatiereMap).map(([matiere, d]) => ({ matiere, ...d }));

  const mensuelMap: Record<string, number> = {};
  for (const a of absences) {
    const m = a.date_absence.slice(0, 7);
    mensuelMap[m] = (mensuelMap[m] ?? 0) + 1;
  }
  const evolution_mensuelle = Object.entries(mensuelMap).sort().map(([mois, count]) => ({ mois, count }));

  const taux_presence = total === 0 ? 100 : Math.max(0, 100 - (total / (total + 200)) * 100);

  res.json({ resume: { total, justifiees, non_justifiees, retards, taux_presence: Math.round(taux_presence * 10) / 10, par_matiere, evolution_mensuelle } });
});

/* ── GET /api/absences/:id ──────────────────────────────── */
router.get("/absences/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [absence] = await db.select().from(absencesTable).where(eq(absencesTable.id, id)).limit(1);
  if (!absence) { res.status(404).json({ message: "Absence introuvable." }); return; }

  if (user.role === "eleve" && absence.eleve_id !== user.id) { res.status(403).json({ message: "Accès refusé." }); return; }
  if (user.role === "parent") {
    const enfants = await db.select().from(parentsElevesTable)
      .where(and(eq(parentsElevesTable.utilisateur_id, user.id), eq(parentsElevesTable.eleve_id, absence.eleve_id)));
    if (enfants.length === 0) { res.status(403).json({ message: "Accès refusé." }); return; }
  }

  res.json({ absence: await enrichirAbsence(absence, true) });
});

/* ── PUT /api/absences/:id/modifier ────────────────────── */
router.put("/absences/:id/modifier", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);
  const roles = ["dev", "directeur", "censeur"];
  if (!roles.includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }

  const { type, date_absence, matiere } = req.body as Record<string, string>;

  const [updated] = await db.update(absencesTable)
    .set({
      ...(type ? { type: type as "absence" | "retard" } : {}),
      ...(date_absence ? { date_absence } : {}),
      ...(matiere ? { matiere } : {}),
      updated_at: new Date(),
    })
    .where(and(eq(absencesTable.id, id), eq(absencesTable.etablissement_id, user.etablissement_id ?? "")))
    .returning();

  if (!updated) { res.status(404).json({ message: "Absence introuvable." }); return; }
  res.json({ absence: await enrichirAbsence(updated, true) });
});

/* ── DELETE /api/absences/:id/supprimer ─────────────────── */
router.delete("/absences/:id/supprimer", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);
  const roles = ["dev", "directeur"];
  if (!roles.includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }

  const [deleted] = await db.delete(absencesTable)
    .where(and(eq(absencesTable.id, id), eq(absencesTable.etablissement_id, user.etablissement_id ?? "")))
    .returning();

  if (!deleted) { res.status(404).json({ message: "Absence introuvable." }); return; }
  res.json({ message: "Absence supprimée." });
});

/* ── POST /api/absences/:id/justifier ───────────────────── */
router.post("/absences/:id/justifier", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);
  const { motif, document_url } = req.body as Record<string, string>;
  if (!motif) { res.status(400).json({ message: "Le motif est obligatoire." }); return; }

  const [absence] = await db.select().from(absencesTable).where(eq(absencesTable.id, id)).limit(1);
  if (!absence) { res.status(404).json({ message: "Absence introuvable." }); return; }

  if (user.role === "parent") {
    const enfants = await db.select().from(parentsElevesTable)
      .where(and(eq(parentsElevesTable.utilisateur_id, user.id), eq(parentsElevesTable.eleve_id, absence.eleve_id)));
    if (enfants.length === 0) { res.status(403).json({ message: "Accès refusé." }); return; }
  } else if (!["dev", "directeur", "censeur"].includes(user.role)) {
    res.status(403).json({ message: "Accès refusé." }); return;
  }

  if (absence.statut === "justifiee") {
    res.status(400).json({ message: "Cette absence est déjà justifiée." }); return;
  }

  await db.update(absencesTable).set({ statut: "en_attente", updated_at: new Date() })
    .where(eq(absencesTable.id, id));

  const [justification] = await db.insert(justificationsTable).values({
    absence_id: id,
    soumis_par: user.id,
    motif,
    document_url: document_url ?? null,
    statut: "en_attente",
  }).returning();

  const directeur = await getDirecteurEtablissement(absence.etablissement_id);
  if (directeur) {
    await creerNotification({
      etablissement_id: absence.etablissement_id,
      destinataire_id: directeur.id,
      type: "message",
      titre: "Nouvelle justification soumise",
      contenu: `Une justification a été soumise pour une absence du ${absence.date_absence}.`,
      lien: "/absences",
    });
  }

  res.status(201).json({ justification });
});

/* ── GET /api/justifications/liste ──────────────────────── */
router.get("/justifications/liste", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const roles = ["dev", "directeur", "censeur"];
  if (!roles.includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }

  const { statut, date_debut, date_fin } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt((req.query["page"] as string) || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query["limit"] as string) || "20", 10)));

  const conditions: ReturnType<typeof eq>[] = [];
  if (statut) conditions.push(eq(justificationsTable.statut, statut as "en_attente" | "validee" | "rejetee"));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(justificationsTable).where(whereClause);
  const rows = await db.select().from(justificationsTable).where(whereClause)
    .orderBy(desc(justificationsTable.created_at)).limit(limit).offset((page - 1) * limit);

  const justifications = await Promise.all(rows.map(async j => {
    const [absence] = await db.select().from(absencesTable).where(eq(absencesTable.id, j.absence_id)).limit(1);
    const [soumis] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, j.soumis_par)).limit(1);
    return { ...j, soumis_par_nom: soumis?.nom ?? "", absence: absence ?? null };
  }));

  res.json({ justifications, total });
});

/* ── PUT /api/justifications/:id/traiter ──────────────────── */
router.put("/justifications/:id/traiter", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);
  const roles = ["dev", "directeur", "censeur"];
  if (!roles.includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }

  const { decision, commentaire } = req.body as { decision: "validee" | "rejetee"; commentaire?: string };
  if (!decision || !["validee", "rejetee"].includes(decision)) {
    res.status(400).json({ message: "Décision invalide." }); return;
  }

  const [justification] = await db.select().from(justificationsTable).where(eq(justificationsTable.id, id)).limit(1);
  if (!justification) { res.status(404).json({ message: "Justification introuvable." }); return; }

  const [updated] = await db.update(justificationsTable).set({
    statut: decision,
    traite_par: user.id,
    date_traitement: new Date().toISOString().split("T")[0] ?? null,
    commentaire_traitement: commentaire ?? null,
    updated_at: new Date(),
  }).where(eq(justificationsTable.id, id)).returning();

  const newAbsenceStatut = decision === "validee" ? "justifiee" : "rejetee";
  await db.update(absencesTable).set({ statut: newAbsenceStatut, updated_at: new Date() })
    .where(eq(absencesTable.id, justification.absence_id));

  const [absence] = await db.select().from(absencesTable).where(eq(absencesTable.id, justification.absence_id)).limit(1);
  if (absence) {
    const parentId = await getParentEleve(absence.eleve_id);
    if (parentId) {
      await envoyerNotificationJustification({
        etablissement_id: absence.etablissement_id,
        parent_id: parentId,
        statut: decision,
        date_absence: absence.date_absence,
        commentaire: commentaire ?? null,
      });
    }
  }

  res.json({ justification: updated });
});

export { declencherNotificationsAbsence };
export default router;
