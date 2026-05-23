import { Router } from "express";
import { eq, and, desc, count, gte, lte } from "drizzle-orm";
import {
  db, epreuvesBlanChesTable, resultatsEpreuvesTable,
  utilisateursTable, eleveClassesTable, elevesTable, classesTable,
  notificationsTable, parentsElevesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { emitNotification } from "../socket/socketManager";

const router = Router();
const ADMINS = ["dev", "directeur", "censeur"];
const GESTIONNAIRES = ["dev", "directeur", "censeur", "professeur"];

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

function calcStats(notes: number[], bareme: number) {
  if (!notes.length) return { moyenne: 0, note_min: 0, note_max: 0, ecart_type: 0, taux_reussite: 0 };
  const moy = notes.reduce((a, b) => a + b, 0) / notes.length;
  const min = Math.min(...notes);
  const max = Math.max(...notes);
  const variance = notes.reduce((acc, n) => acc + Math.pow(n - moy, 2), 0) / notes.length;
  const taux = (notes.filter(n => n >= bareme / 2).length / notes.length) * 100;
  return {
    moyenne: Math.round(moy * 100) / 100,
    note_min: min, note_max: max,
    ecart_type: Math.round(Math.sqrt(variance) * 100) / 100,
    taux_reussite: Math.round(taux * 10) / 10,
  };
}

/* ── GET /examens/epreuves ────────────────────────────── */
router.get("/examens/epreuves", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const { classe_id, matiere, statut, date_debut, date_fin } = req.query as Record<string, string>;
  const etabId = user.etablissement_id ?? null;

  const conditions: ReturnType<typeof eq>[] = [];
  if (etabId) conditions.push(eq(epreuvesBlanChesTable.etablissement_id, etabId));
  if (classe_id) conditions.push(eq(epreuvesBlanChesTable.classe_id, classe_id));
  if (matiere)   conditions.push(eq(epreuvesBlanChesTable.matiere, matiere));
  if (statut)    conditions.push(eq(epreuvesBlanChesTable.statut, statut as "planifiee" | "en_cours" | "terminee" | "corrigee"));
  if (date_debut) conditions.push(gte(epreuvesBlanChesTable.date_epreuve, date_debut));
  if (date_fin)   conditions.push(lte(epreuvesBlanChesTable.date_epreuve, date_fin));

  if (user.role === "professeur") {
    conditions.push(eq(epreuvesBlanChesTable.professeur_id, user.id));
  } else if (user.role === "eleve") {
    const [eleveInfo] = await db.select({ classe_id: eleveClassesTable.classe_id })
      .from(eleveClassesTable).where(eq(eleveClassesTable.eleve_id, user.id)).limit(1);
    if (!eleveInfo) { res.json({ epreuves: [], total: 0 }); return; }
    conditions.push(eq(epreuvesBlanChesTable.classe_id, eleveInfo.classe_id));
  } else if (user.role === "parent") {
    const enfants = await db.select({ eleve_id: parentsElevesTable.eleve_id })
      .from(parentsElevesTable).where(eq(parentsElevesTable.utilisateur_id, user.id));
    if (!enfants.length) { res.json({ epreuves: [], total: 0 }); return; }
    const classesEnfants = await db.select({ classe_id: eleveClassesTable.classe_id })
      .from(eleveClassesTable)
      .where(and(...enfants.map(e => eq(eleveClassesTable.eleve_id, e.eleve_id))));
    const classeIds = [...new Set(classesEnfants.map(c => c.classe_id))];
    if (!classeIds.length) { res.json({ epreuves: [], total: 0 }); return; }
    conditions.push(eq(epreuvesBlanChesTable.classe_id, classeIds[0]));
  }

  const rows = await db
    .select({
      epreuve: epreuvesBlanChesTable,
      professeur_nom: utilisateursTable.nom,
      classe_nom: classesTable.nom,
    })
    .from(epreuvesBlanChesTable)
    .leftJoin(utilisateursTable, eq(epreuvesBlanChesTable.professeur_id, utilisateursTable.id))
    .leftJoin(classesTable, eq(epreuvesBlanChesTable.classe_id, classesTable.id))
    .where(and(...conditions))
    .orderBy(desc(epreuvesBlanChesTable.date_epreuve));

  const epreuves = rows.map(r => ({
    ...r.epreuve,
    professeur_nom: r.professeur_nom ?? "",
    classe_nom: r.classe_nom ?? "",
  }));

  res.json({ epreuves, total: epreuves.length });
});

/* ── POST /examens/epreuves ───────────────────────────── */
router.post("/examens/epreuves", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!GESTIONNAIRES.includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }
  if (!user.etablissement_id) {
    res.status(400).json({ message: "Aucun établissement assigné." }); return;
  }

  const {
    classe_id, matiere, sujet_id, titre, type_examen = "blanc",
    date_epreuve, duree_minutes, bareme_total = 20, instructions,
  } = req.body as {
    classe_id: string; matiere: string; sujet_id?: string;
    titre: string; type_examen?: string; date_epreuve: string;
    duree_minutes: number; bareme_total?: number; instructions?: string;
  };

  if (!classe_id || !matiere?.trim() || !titre?.trim() || !date_epreuve || !duree_minutes) {
    res.status(400).json({ message: "Champs obligatoires manquants." }); return;
  }

  const [epreuve] = await db.insert(epreuvesBlanChesTable).values({
    etablissement_id: user.etablissement_id,
    professeur_id: user.id,
    classe_id,
    matiere: matiere.trim(),
    sujet_id: sujet_id ?? null,
    titre: titre.trim(),
    type_examen: type_examen as "BEPC" | "BAC" | "blanc",
    date_epreuve,
    duree_minutes,
    bareme_total: String(bareme_total),
    instructions: instructions ?? null,
  }).returning();

  const eleveLinks = await db
    .select({ eleve_id: eleveClassesTable.eleve_id })
    .from(eleveClassesTable)
    .where(eq(eleveClassesTable.classe_id, classe_id));

  if (eleveLinks.length) {
    await db.insert(resultatsEpreuvesTable).values(
      eleveLinks.map(e => ({
        epreuve_id: epreuve.id,
        eleve_id: e.eleve_id,
        present: true,
        note: null,
      }))
    ).onConflictDoNothing();

    for (const { eleve_id } of eleveLinks) {
      const [notif] = await db.insert(notificationsTable).values({
        etablissement_id: user.etablissement_id!,
        destinataire_id: eleve_id,
        type: "annonce",
        titre: `📝 Épreuve blanche planifiée : ${epreuve.titre}`,
        contenu: `Une épreuve blanche de ${epreuve.matiere} est prévue le ${epreuve.date_epreuve} (${epreuve.duree_minutes} min).`,
        lien: "/epreuves-blanches",
      }).returning();
      await emitNotification(eleve_id, {
        id: notif.id, type: "annonce",
        titre: notif.titre, contenu: notif.contenu, lien: notif.lien,
        created_at: notif.created_at,
      });
    }
  }

  const [classe] = await db.select({ nom: classesTable.nom }).from(classesTable).where(eq(classesTable.id, classe_id)).limit(1);
  const [prof] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, user.id)).limit(1);

  res.status(201).json({
    epreuve: { ...epreuve, professeur_nom: prof?.nom ?? "", classe_nom: classe?.nom ?? "" },
  });
});

/* ── GET /examens/epreuves/:id ────────────────────────── */
router.get("/examens/epreuves/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [row] = await db
    .select({
      epreuve: epreuvesBlanChesTable,
      professeur_nom: utilisateursTable.nom,
      classe_nom: classesTable.nom,
    })
    .from(epreuvesBlanChesTable)
    .leftJoin(utilisateursTable, eq(epreuvesBlanChesTable.professeur_id, utilisateursTable.id))
    .leftJoin(classesTable, eq(epreuvesBlanChesTable.classe_id, classesTable.id))
    .where(eq(epreuvesBlanChesTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ message: "Épreuve introuvable." }); return; }

  let resultats: typeof resultatsEpreuvesTable.$inferSelect[] = [];
  if (row.epreuve.statut === "corrigee") {
    const allResultats = await db
      .select({
        resultat: resultatsEpreuvesTable,
        eleve_nom: utilisateursTable.nom,
        eleve_prenoms: utilisateursTable.prenoms,
      })
      .from(resultatsEpreuvesTable)
      .leftJoin(utilisateursTable, eq(resultatsEpreuvesTable.eleve_id, utilisateursTable.id))
      .where(
        user.role === "eleve"
          ? and(eq(resultatsEpreuvesTable.epreuve_id, id), eq(resultatsEpreuvesTable.eleve_id, user.id))
          : eq(resultatsEpreuvesTable.epreuve_id, id)
      );
    resultats = allResultats.map(r => ({ ...r.resultat, eleve_nom: r.eleve_nom ?? "", eleve_prenoms: r.eleve_prenoms ?? "" })) as typeof resultatsEpreuvesTable.$inferSelect[];
  }

  res.json({
    epreuve: { ...row.epreuve, professeur_nom: row.professeur_nom ?? "", classe_nom: row.classe_nom ?? "" },
    resultats,
  });
});

/* ── POST /examens/epreuves/:id/resultats ─────────────── */
router.post("/examens/epreuves/:id/resultats", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!GESTIONNAIRES.includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  const id = normalizeId(req.params["id"]);
  const [epreuve] = await db.select().from(epreuvesBlanChesTable).where(eq(epreuvesBlanChesTable.id, id)).limit(1);
  if (!epreuve) { res.status(404).json({ message: "Épreuve introuvable." }); return; }

  if (user.role === "professeur" && epreuve.professeur_id !== user.id) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  const { resultats } = req.body as {
    resultats: { eleve_id: string; note?: number | null; appreciation?: string; present?: boolean }[];
  };

  if (!Array.isArray(resultats) || !resultats.length) {
    res.status(400).json({ message: "Résultats manquants." }); return;
  }

  const today = new Date().toISOString().split("T")[0];

  for (const r of resultats) {
    await db.update(resultatsEpreuvesTable)
      .set({
        note: r.note !== undefined ? (r.note !== null ? String(r.note) : null) : undefined,
        appreciation: r.appreciation ?? null,
        present: r.present ?? true,
        date_correction: today,
        updated_at: new Date(),
      })
      .where(and(
        eq(resultatsEpreuvesTable.epreuve_id, id),
        eq(resultatsEpreuvesTable.eleve_id, r.eleve_id),
      ));
  }

  await db.update(epreuvesBlanChesTable)
    .set({ statut: "corrigee", updated_at: new Date() })
    .where(eq(epreuvesBlanChesTable.id, id));

  const notesNum = resultats.filter(r => r.present !== false && r.note !== null && r.note !== undefined)
    .map(r => Number(r.note));
  const bareme = parseFloat(String(epreuve.bareme_total));
  const stats = calcStats(notesNum, bareme);

  const dist = { "0-5": 0, "5-10": 0, "10-14": 0, "14-20": 0 };
  notesNum.forEach(n => {
    if (n < 5) dist["0-5"]++;
    else if (n < 10) dist["5-10"]++;
    else if (n < 14) dist["10-14"]++;
    else dist["14-20"]++;
  });

  for (const r of resultats) {
    if (r.note === null || r.note === undefined) continue;
    const [notif] = await db.insert(notificationsTable).values({
      etablissement_id: epreuve.etablissement_id,
      destinataire_id: r.eleve_id,
      type: "bulletin_publie",
      titre: `📊 Résultat disponible : ${epreuve.titre}`,
      contenu: `Ta note au blanc de ${epreuve.matiere} : ${r.note}/${bareme}.`,
      lien: "/resultats-progression",
    }).returning();
    await emitNotification(r.eleve_id, {
      id: notif.id, type: "bulletin_publie",
      titre: notif.titre, contenu: notif.contenu, lien: notif.lien,
      created_at: notif.created_at,
    });
  }

  res.json({
    ...stats,
    epreuve_id: id,
    nb_presents: notesNum.length,
    nb_absents: resultats.filter(r => r.present === false).length,
    distribution: dist,
    resultats,
  });
});

/* ── GET /examens/epreuves/:id/stats ──────────────────── */
router.get("/examens/epreuves/:id/stats", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!GESTIONNAIRES.includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  const id = normalizeId(req.params["id"]);
  const [epreuve] = await db.select().from(epreuvesBlanChesTable).where(eq(epreuvesBlanChesTable.id, id)).limit(1);
  if (!epreuve) { res.status(404).json({ message: "Épreuve introuvable." }); return; }

  const rows = await db
    .select({
      resultat: resultatsEpreuvesTable,
      eleve_nom: utilisateursTable.nom,
      eleve_prenoms: utilisateursTable.prenoms,
    })
    .from(resultatsEpreuvesTable)
    .leftJoin(utilisateursTable, eq(resultatsEpreuvesTable.eleve_id, utilisateursTable.id))
    .where(eq(resultatsEpreuvesTable.epreuve_id, id))
    .orderBy(desc(resultatsEpreuvesTable.note));

  const bareme = parseFloat(String(epreuve.bareme_total));
  const notesNum = rows
    .filter(r => r.resultat.present && r.resultat.note !== null)
    .map(r => parseFloat(String(r.resultat.note)));
  const stats = calcStats(notesNum, bareme);

  const dist = { "0-5": 0, "5-10": 0, "10-14": 0, "14-20": 0 };
  notesNum.forEach(n => {
    if (n < 5) dist["0-5"]++;
    else if (n < 10) dist["5-10"]++;
    else if (n < 14) dist["10-14"]++;
    else dist["14-20"]++;
  });

  const resultats = rows.map(r => ({
    ...r.resultat, eleve_nom: r.eleve_nom ?? "", eleve_prenoms: r.eleve_prenoms ?? "",
  }));

  res.json({
    epreuve_id: id,
    nb_presents: notesNum.length,
    nb_absents: rows.filter(r => !r.resultat.present).length,
    ...stats,
    distribution: dist,
    resultats,
  });
});

/* ── GET /examens/eleve/:eleveId/progression ──────────── */
router.get("/examens/eleve/:eleveId/progression", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const eleveId = normalizeId(req.params["eleveId"]);

  const canView = ["dev", "directeur", "censeur", "professeur"].includes(user.role)
    || user.id === eleveId;

  if (!canView && user.role === "parent") {
    const parentsEleves = await db.select()
      .from(parentsElevesTable)
      .where(and(eq(parentsElevesTable.utilisateur_id, user.id), eq(parentsElevesTable.eleve_id, eleveId)));
    if (!parentsEleves.length) { res.status(403).json({ message: "Accès non autorisé." }); return; }
  } else if (!canView) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  const rows = await db
    .select({
      resultat: resultatsEpreuvesTable,
      epreuve: epreuvesBlanChesTable,
    })
    .from(resultatsEpreuvesTable)
    .leftJoin(epreuvesBlanChesTable, eq(resultatsEpreuvesTable.epreuve_id, epreuvesBlanChesTable.id))
    .where(and(
      eq(resultatsEpreuvesTable.eleve_id, eleveId),
      eq(epreuvesBlanChesTable.statut, "corrigee"),
    ))
    .orderBy(desc(epreuvesBlanChesTable.date_epreuve));

  const parMatiere: Record<string, { notes: number[]; dates: string[]; titres: string[]; baremes: string[] }> = {};
  for (const r of rows) {
    if (!r.epreuve || !r.resultat.present || r.resultat.note === null) continue;
    const mat = r.epreuve.matiere;
    if (!parMatiere[mat]) parMatiere[mat] = { notes: [], dates: [], titres: [], baremes: [] };
    parMatiere[mat].notes.push(parseFloat(String(r.resultat.note)));
    parMatiere[mat].dates.push(r.epreuve.date_epreuve);
    parMatiere[mat].titres.push(r.epreuve.titre);
    parMatiere[mat].baremes.push(String(r.epreuve.bareme_total));
  }

  const parMatiereArr = Object.entries(parMatiere).map(([matiere, data]) => {
    const nb = data.notes.length;
    const moy = nb ? data.notes.reduce((a, b) => a + b, 0) / nb : 0;
    const last = data.notes[0] ?? 0;
    const prev = data.notes[1] ?? last;
    const tendance = last > prev ? "hausse" : last < prev ? "baisse" : "stable";
    return {
      matiere, moyenne_blancs: Math.round(moy * 100) / 100,
      nb_epreuves: nb, meilleure_note: Math.max(...data.notes),
      derniere_note: last, tendance,
    };
  });

  const points_forts = parMatiereArr.filter(m => m.moyenne_blancs >= 14).map(m => m.matiere);
  const points_faibles = parMatiereArr.filter(m => m.moyenne_blancs < 10).map(m => m.matiere);

  const historique = rows
    .filter(r => r.epreuve && r.resultat.present && r.resultat.note !== null)
    .map(r => ({
      date_epreuve: r.epreuve!.date_epreuve,
      matiere: r.epreuve!.matiere,
      note: parseFloat(String(r.resultat.note)),
      bareme_total: String(r.epreuve!.bareme_total),
      titre: r.epreuve!.titre,
    }));

  res.json({ eleve_id: eleveId, par_matiere: parMatiereArr, points_forts, points_faibles, historique });
});

export default router;
