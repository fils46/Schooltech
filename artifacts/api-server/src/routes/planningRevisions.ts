import { Router } from "express";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import {
  db, planningRevisionsTable, utilisateursTable, eleveClassesTable,
  emploisDuTempsTable, resultatsEpreuvesTable, epreuvesBlanChesTable,
  parentsElevesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getDaysBetween(from: string, to: string): number {
  const a = new Date(from);
  const b = new Date(to);
  return Math.max(0, Math.floor((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24)));
}

function isWeekend(dateStr: string): boolean {
  const day = new Date(dateStr).getDay();
  return day === 0; // dimanche seulement — samedi travaillé en CI
}

/* ── POST /examens/planning/generer ───────────────────── */
router.post("/examens/planning/generer", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const { eleve_id, date_examen, nb_heures_par_jour, matieres_prioritaires = [] } = req.body as {
    eleve_id: string; date_examen: string;
    nb_heures_par_jour: number; matieres_prioritaires?: string[];
  };

  if (!eleve_id || !date_examen || !nb_heures_par_jour) {
    res.status(400).json({ message: "Champs obligatoires manquants." }); return;
  }

  const canCreate = user.id === eleve_id
    || ["dev", "directeur", "censeur"].includes(user.role)
    || user.role === "parent";

  if (!canCreate) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  if (user.role === "parent") {
    const link = await db.select().from(parentsElevesTable)
      .where(and(eq(parentsElevesTable.utilisateur_id, user.id), eq(parentsElevesTable.eleve_id, eleve_id)));
    if (!link.length) { res.status(403).json({ message: "Accès non autorisé." }); return; }
  }

  const [eleveInfo] = await db.select({ etablissement_id: utilisateursTable.etablissement_id })
    .from(utilisateursTable).where(eq(utilisateursTable.id, eleve_id)).limit(1);
  if (!eleveInfo?.etablissement_id) { res.status(404).json({ message: "Élève introuvable." }); return; }

  const etabId = eleveInfo.etablissement_id;
  const today = new Date().toISOString().split("T")[0];
  const nbJours = getDaysBetween(today, date_examen);

  if (nbJours < 1) {
    res.status(400).json({ message: "La date d'examen doit être dans le futur." }); return;
  }

  /* Déterminer les matières à réviser */
  let matieres: string[] = matieres_prioritaires.length ? matieres_prioritaires : [];

  if (!matieres.length) {
    const resultats = await db
      .select({ matiere: epreuvesBlanChesTable.matiere })
      .from(resultatsEpreuvesTable)
      .leftJoin(epreuvesBlanChesTable, eq(resultatsEpreuvesTable.epreuve_id, epreuvesBlanChesTable.id))
      .where(and(eq(resultatsEpreuvesTable.eleve_id, eleve_id), eq(epreuvesBlanChesTable.statut, "corrigee")));
    matieres = [...new Set(resultats.map(r => r.matiere).filter(Boolean))] as string[];
  }

  if (!matieres.length) {
    matieres = ["Mathématiques", "Français", "Physique-Chimie", "SVT", "Histoire-Géographie"];
  }

  /* Calculer les poids selon performances */
  const poids: Record<string, number> = {};
  for (const m of matieres) {
    const notesRows = await db
      .select({ note: resultatsEpreuvesTable.note, bareme: epreuvesBlanChesTable.bareme_total })
      .from(resultatsEpreuvesTable)
      .leftJoin(epreuvesBlanChesTable, eq(resultatsEpreuvesTable.epreuve_id, epreuvesBlanChesTable.id))
      .where(and(
        eq(resultatsEpreuvesTable.eleve_id, eleve_id),
        eq(epreuvesBlanChesTable.matiere, m),
        eq(resultatsEpreuvesTable.present, true),
      ));
    const notes = notesRows.filter(n => n.note !== null);
    if (!notes.length) { poids[m] = 2; continue; }
    const avgNote = notes.reduce((a, r) => a + parseFloat(String(r.note)), 0) / notes.length;
    const avgBareme = notes.reduce((a, r) => a + parseFloat(String(r.bareme)), 0) / notes.length;
    const ratio = avgNote / (avgBareme / 2);
    poids[m] = ratio < 1 ? 3 : ratio < 1.3 ? 2 : 1;
  }

  const totalPoids = Object.values(poids).reduce((a, b) => a + b, 0);
  const heuresTotal = Math.min(nbJours, 60) * nb_heures_par_jour;
  const heuresParSession = 1.5;
  const sessionsTotal = Math.floor(heuresTotal / heuresParSession);

  const schedule: { matiere: string; count: number }[] = matieres.map(m => ({
    matiere: m,
    count: Math.max(1, Math.round((poids[m] / totalPoids) * sessionsTotal)),
  }));

  /* Supprimer l'ancien planning de l'élève */
  await db.delete(planningRevisionsTable).where(
    and(eq(planningRevisionsTable.eleve_id, eleve_id), gte(planningRevisionsTable.date_session, today))
  );

  /* Générer les sessions */
  const sessions: typeof planningRevisionsTable.$inferInsert[] = [];
  let dayOffset = 0;
  const allSessions: { matiere: string }[] = schedule.flatMap(s => Array(s.count).fill({ matiere: s.matiere }));
  let sessionIdx = 0;

  while (sessionIdx < allSessions.length && dayOffset < nbJours) {
    const currentDate = addDays(today, dayOffset);
    if (isWeekend(currentDate)) { dayOffset++; continue; }

    const sessionsAujourdHui = Math.min(
      Math.floor(nb_heures_par_jour / heuresParSession),
      allSessions.length - sessionIdx
    );

    for (let s = 0; s < sessionsAujourdHui && sessionIdx < allSessions.length; s++) {
      const heureDebut = `${7 + s * 2}:00`;
      const heureFin = `${8 + s * 2 + Math.floor(heuresParSession)}:30`;
      sessions.push({
        eleve_id,
        etablissement_id: etabId,
        matiere: allSessions[sessionIdx].matiere,
        titre_session: `Révision ${allSessions[sessionIdx].matiere}`,
        date_session: currentDate,
        heure_debut: heureDebut,
        heure_fin: heureFin,
        statut: "planifie",
      });
      sessionIdx++;
    }
    dayOffset++;
  }

  if (sessions.length) {
    await db.insert(planningRevisionsTable).values(sessions);
  }

  const inserted = await db.select()
    .from(planningRevisionsTable)
    .where(and(eq(planningRevisionsTable.eleve_id, eleve_id), gte(planningRevisionsTable.date_session, today)))
    .orderBy(planningRevisionsTable.date_session, planningRevisionsTable.heure_debut);

  res.json({ sessions: inserted, total: inserted.length });
});

/* ── GET /examens/planning/:eleveId ───────────────────── */
router.get("/examens/planning/:eleveId", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const eleveId = normalizeId(req.params["eleveId"]);
  const { semaine, mois, matiere } = req.query as Record<string, string>;

  const canView = user.id === eleveId
    || ["dev", "directeur", "censeur", "professeur"].includes(user.role)
    || user.role === "parent";

  if (!canView) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const conditions: ReturnType<typeof eq>[] = [eq(planningRevisionsTable.eleve_id, eleveId)];
  if (matiere) conditions.push(eq(planningRevisionsTable.matiere, matiere));

  if (semaine) {
    const weekStart = semaine;
    const weekEnd = addDays(semaine, 6);
    conditions.push(gte(planningRevisionsTable.date_session, weekStart));
    conditions.push(lte(planningRevisionsTable.date_session, weekEnd));
  } else if (mois) {
    const [year, month] = mois.split("-").map(Number);
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const end = `${year}-${String(month).padStart(2, "0")}-31`;
    conditions.push(gte(planningRevisionsTable.date_session, start));
    conditions.push(lte(planningRevisionsTable.date_session, end));
  }

  const sessions = await db.select()
    .from(planningRevisionsTable)
    .where(and(...conditions))
    .orderBy(planningRevisionsTable.date_session, planningRevisionsTable.heure_debut);

  res.json({ sessions, total: sessions.length });
});

/* ── PUT /examens/planning/sessions/:id ───────────────── */
router.put("/examens/planning/sessions/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [session] = await db.select()
    .from(planningRevisionsTable)
    .where(eq(planningRevisionsTable.id, id))
    .limit(1);

  if (!session) { res.status(404).json({ message: "Session introuvable." }); return; }

  const canEdit = session.eleve_id === user.id
    || ["dev", "directeur", "censeur"].includes(user.role);

  if (!canEdit) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const { statut, notes_eleve } = req.body as {
    statut?: "planifie" | "fait" | "saute";
    notes_eleve?: string | null;
  };

  const [updated] = await db.update(planningRevisionsTable).set({
    ...(statut      !== undefined && { statut }),
    ...(notes_eleve !== undefined && { notes_eleve }),
    updated_at: new Date(),
  }).where(eq(planningRevisionsTable.id, id)).returning();

  res.json(updated);
});

/* ── GET /examens/planning/:eleveId/completion ─────────── */
router.get("/examens/planning/:eleveId/completion", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const eleveId = normalizeId(req.params["eleveId"]);

  const canView = user.id === eleveId
    || ["dev", "directeur", "censeur", "professeur", "parent"].includes(user.role);
  if (!canView) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const sessions = await db.select()
    .from(planningRevisionsTable)
    .where(eq(planningRevisionsTable.eleve_id, eleveId));

  const total = sessions.length;
  const fait = sessions.filter(s => s.statut === "fait").length;
  const saute = sessions.filter(s => s.statut === "saute").length;
  const planifie = sessions.filter(s => s.statut === "planifie").length;
  const taux_completion = total ? Math.round((fait / total) * 100 * 10) / 10 : 0;

  const matieres: Record<string, { total: number; fait: number }> = {};
  for (const s of sessions) {
    if (!matieres[s.matiere]) matieres[s.matiere] = { total: 0, fait: 0 };
    matieres[s.matiere].total++;
    if (s.statut === "fait") matieres[s.matiere].fait++;
  }

  const par_matiere = Object.entries(matieres).map(([matiere, data]) => ({
    matiere,
    total: data.total,
    fait: data.fait,
    taux: data.total ? Math.round((data.fait / data.total) * 100 * 10) / 10 : 0,
  }));

  res.json({ total, fait, saute, planifie, taux_completion, par_matiere });
});

export default router;
