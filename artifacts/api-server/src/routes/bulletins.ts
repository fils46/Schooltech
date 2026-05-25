import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import {
  db,
  notesTable,
  bulletinsTable,
  bulletinDetailsTable,
  matieresConfigTable,
  eleveClassesTable,
  elevesTable,
  classesTable,
  anneesScolairesTable,
  utilisateursTable,
  conseilsClasseTable,
  etablissementsTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

const ROLES_ADMIN = ["dev", "directeur", "censeur"];

function assignerMention(moy: number): "tres_bien" | "bien" | "assez_bien" | "passable" | "insuffisant" {
  if (moy >= 16) return "tres_bien";
  if (moy >= 14) return "bien";
  if (moy >= 12) return "assez_bien";
  if (moy >= 10) return "passable";
  return "insuffisant";
}

/* ─── Helper : enrichir un bulletin avec ses détails ────────── */
async function enrichirBulletin(b: typeof bulletinsTable.$inferSelect) {
  const [eleve] = await db
    .select({
      nom: elevesTable.nom,
      prenoms: elevesTable.prenoms,
      matricule: elevesTable.matricule,
    })
    .from(elevesTable)
    .where(eq(elevesTable.id, b.eleve_id))
    .limit(1);

  const [classe] = await db
    .select({ nom: classesTable.nom })
    .from(classesTable)
    .where(eq(classesTable.id, b.classe_id))
    .limit(1);

  const [annee] = await db
    .select({ libelle: anneesScolairesTable.libelle })
    .from(anneesScolairesTable)
    .where(eq(anneesScolairesTable.id, b.annee_scolaire_id))
    .limit(1);

  const details = await db
    .select()
    .from(bulletinDetailsTable)
    .where(eq(bulletinDetailsTable.bulletin_id, b.id));

  return {
    ...b,
    moyenne_generale: b.moyenne_generale !== null ? Number(b.moyenne_generale) : null,
    eleve_nom: eleve?.nom ?? null,
    eleve_prenoms: eleve?.prenoms ?? null,
    eleve_matricule: eleve?.matricule ?? null,
    classe_nom: classe?.nom ?? null,
    annee_scolaire_libelle: annee?.libelle ?? null,
    details: details.map(d => ({
      ...d,
      coefficient: Number(d.coefficient),
      moyenne_matiere: d.moyenne_matiere !== null ? Number(d.moyenne_matiere) : null,
      note_min_classe: d.note_min_classe !== null ? Number(d.note_min_classe) : null,
      note_max_classe: d.note_max_classe !== null ? Number(d.note_max_classe) : null,
      moyenne_classe: d.moyenne_classe !== null ? Number(d.moyenne_classe) : null,
    })),
  };
}

/* ─── Helper : générer le bulletin d'un élève ───────────────── */
async function genererBulletinPourEleve(
  eleveId: string,
  classeId: string,
  anneeId: string,
  trimestre: "1" | "2" | "3",
  etabId: string
): Promise<typeof bulletinsTable.$inferSelect> {
  // 1. Récupérer les matières configurées
  const matieres = await db
    .select()
    .from(matieresConfigTable)
    .where(
      and(
        eq(matieresConfigTable.classe_id, classeId),
        eq(matieresConfigTable.annee_scolaire_id, anneeId),
        eq(matieresConfigTable.etablissement_id, etabId),
        eq(matieresConfigTable.actif, true)
      )
    )
    .orderBy(matieresConfigTable.ordre_affichage);

  // 2. Récupérer tous les élèves de la classe pour les stats
  const eleveClassesRows = await db
    .select({ eleve_id: eleveClassesTable.eleve_id })
    .from(eleveClassesTable)
    .where(
      and(
        eq(eleveClassesTable.classe_id, classeId),
        eq(eleveClassesTable.annee_scolaire_id, anneeId)
      )
    );
  const tousEleveIds = eleveClassesRows.map(e => e.eleve_id);

  // 3. Récupérer toutes les notes de la classe pour ce trimestre
  const toutesNotes =
    tousEleveIds.length > 0
      ? await db
          .select()
          .from(notesTable)
          .where(
            and(
              eq(notesTable.classe_id, classeId),
              eq(notesTable.annee_scolaire_id, anneeId),
              eq(notesTable.trimestre, trimestre),
              eq(notesTable.etablissement_id, etabId)
            )
          )
      : [];

  // 4. Notes de l'élève uniquement
  const notesEleve = toutesNotes.filter(n => n.eleve_id === eleveId);

  // 5. Calculer moyenne par matière pour l'élève + stats classe
  let sommeWeightedMoyennes = 0;
  let sommeCoefficients = 0;

  // Upsert bulletin
  const existing = await db
    .select()
    .from(bulletinsTable)
    .where(
      and(
        eq(bulletinsTable.eleve_id, eleveId),
        eq(bulletinsTable.classe_id, classeId),
        eq(bulletinsTable.annee_scolaire_id, anneeId),
        eq(bulletinsTable.trimestre, trimestre)
      )
    )
    .limit(1);

  let bulletinId: string;
  if (existing.length > 0) {
    bulletinId = existing[0].id;
  } else {
    const [newBulletin] = await db
      .insert(bulletinsTable)
      .values({
        etablissement_id: etabId,
        eleve_id: eleveId,
        classe_id: classeId,
        annee_scolaire_id: anneeId,
        trimestre,
        publie: false,
      })
      .returning();
    bulletinId = newBulletin.id;
  }

  // 6. Pour chaque matière configurée, calculer la moyenne
  for (const mat of matieres) {
    const coef = Number(mat.coefficient);
    const notesMatEleve = notesEleve.filter(n => n.matiere === mat.nom_matiere);

    let moyenneMatiere: number | null = null;
    if (notesMatEleve.length > 0) {
      let sommeNum = 0;
      let sommeDen = 0;
      for (const n of notesMatEleve) {
        const note = Number(n.note);
        const noteSur = Number(n.note_sur);
        const coefNote = Number(n.coefficient);
        sommeNum += (note / noteSur) * 20 * coefNote;
        sommeDen += coefNote;
      }
      moyenneMatiere = sommeDen > 0 ? sommeNum / sommeDen : null;
    }

    // Stats classe pour cette matière
    const notesMatiereClasse = toutesNotes.filter(n => n.matiere === mat.nom_matiere);
    const moyennesParEleve: number[] = [];

    for (const eid of tousEleveIds) {
      const notesEleveMatiere = notesMatiereClasse.filter(n => n.eleve_id === eid);
      if (notesEleveMatiere.length > 0) {
        let s = 0;
        let d = 0;
        for (const n of notesEleveMatiere) {
          s += (Number(n.note) / Number(n.note_sur)) * 20 * Number(n.coefficient);
          d += Number(n.coefficient);
        }
        if (d > 0) moyennesParEleve.push(s / d);
      }
    }

    const noteMinClasse = moyennesParEleve.length > 0 ? Math.min(...moyennesParEleve) : null;
    const noteMaxClasse = moyennesParEleve.length > 0 ? Math.max(...moyennesParEleve) : null;
    const moyenneClasse =
      moyennesParEleve.length > 0
        ? moyennesParEleve.reduce((a, b) => a + b, 0) / moyennesParEleve.length
        : null;

    // Upsert detail
    const [detailExisting] = await db
      .select()
      .from(bulletinDetailsTable)
      .where(
        and(
          eq(bulletinDetailsTable.bulletin_id, bulletinId),
          eq(bulletinDetailsTable.matiere, mat.nom_matiere)
        )
      )
      .limit(1);

    const detailData = {
      coefficient: String(coef),
      moyenne_matiere: moyenneMatiere !== null ? String(moyenneMatiere.toFixed(2)) : null,
      note_min_classe: noteMinClasse !== null ? String(noteMinClasse.toFixed(2)) : null,
      note_max_classe: noteMaxClasse !== null ? String(noteMaxClasse.toFixed(2)) : null,
      moyenne_classe: moyenneClasse !== null ? String(moyenneClasse.toFixed(2)) : null,
      updated_at: new Date(),
    };

    if (detailExisting) {
      await db
        .update(bulletinDetailsTable)
        .set(detailData)
        .where(eq(bulletinDetailsTable.id, detailExisting.id));
    } else {
      await db.insert(bulletinDetailsTable).values({
        bulletin_id: bulletinId,
        matiere: mat.nom_matiere,
        ...detailData,
      });
    }

    if (moyenneMatiere !== null) {
      sommeWeightedMoyennes += moyenneMatiere * coef;
      sommeCoefficients += coef;
    }
  }

  // 7. Calculer moyenne générale
  const moyenneGenerale =
    sommeCoefficients > 0 ? sommeWeightedMoyennes / sommeCoefficients : null;

  const mention = moyenneGenerale !== null ? assignerMention(moyenneGenerale) : null;

  const [bulletin] = await db
    .update(bulletinsTable)
    .set({
      moyenne_generale: moyenneGenerale !== null ? String(moyenneGenerale.toFixed(2)) : null,
      mention,
      updated_at: new Date(),
    })
    .where(eq(bulletinsTable.id, bulletinId))
    .returning();

  return bulletin;
}

/* ─── Helper : calculer les rangs d'une classe ──────────────── */
async function calculerRangsClasse(classeId: string, anneeId: string, trimestre: "1" | "2" | "3") {
  const bulletins = await db
    .select()
    .from(bulletinsTable)
    .where(
      and(
        eq(bulletinsTable.classe_id, classeId),
        eq(bulletinsTable.annee_scolaire_id, anneeId),
        eq(bulletinsTable.trimestre, trimestre)
      )
    );

  const avecMoyenne = bulletins
    .filter(b => b.moyenne_generale !== null)
    .sort((a, b) => Number(b.moyenne_generale!) - Number(a.moyenne_generale!));

  const effectif = bulletins.length;
  let rang = 1;
  let prevMoy: number | null = null;
  let prevRang = 1;

  for (let i = 0; i < avecMoyenne.length; i++) {
    const moy = Number(avecMoyenne[i].moyenne_generale!);
    if (prevMoy !== null && moy !== prevMoy) {
      rang = i + 1;
    }
    if (prevMoy === null || moy !== prevMoy) {
      prevRang = rang;
    }
    await db
      .update(bulletinsTable)
      .set({ rang: prevRang, effectif_classe: effectif, updated_at: new Date() })
      .where(eq(bulletinsTable.id, avecMoyenne[i].id));
    prevMoy = moy;
  }

  // Ceux sans moyenne
  for (const b of bulletins.filter(b => b.moyenne_generale === null)) {
    await db
      .update(bulletinsTable)
      .set({ rang: null, effectif_classe: effectif, updated_at: new Date() })
      .where(eq(bulletinsTable.id, b.id));
  }
}

/* ─── POST /api/bulletins/generer ───────────────────────────── */
router.post(
  "/bulletins/generer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const { eleve_id, classe_id, annee_scolaire_id, trimestre } = req.body as Record<string, string>;
    if (!eleve_id || !classe_id || !annee_scolaire_id || !trimestre) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const etabId = user.etablissement_id ?? "";
    const b = await genererBulletinPourEleve(
      eleve_id, classe_id, annee_scolaire_id, trimestre as "1" | "2" | "3", etabId
    );
    const enriched = await enrichirBulletin(b);
    res.json({ bulletin: enriched });
  }
);

/* ─── POST /api/bulletins/generer-classe ────────────────────── */
router.post(
  "/bulletins/generer-classe",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const { classe_id, annee_scolaire_id, trimestre } = req.body as Record<string, string>;
    if (!classe_id || !annee_scolaire_id || !trimestre) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const etabId = user.etablissement_id ?? "";
    const t = trimestre as "1" | "2" | "3";

    const eleveClassesRows = await db
      .select({ eleve_id: eleveClassesTable.eleve_id })
      .from(eleveClassesTable)
      .where(
        and(
          eq(eleveClassesTable.classe_id, classe_id),
          eq(eleveClassesTable.annee_scolaire_id, annee_scolaire_id)
        )
      );

    if (eleveClassesRows.length === 0) {
      res.status(404).json({ message: "Aucun élève dans cette classe pour cette année scolaire." });
      return;
    }

    let generes = 0;
    const erreurs: Array<{ eleve_id: string; message: string }> = [];

    for (const row of eleveClassesRows) {
      try {
        await genererBulletinPourEleve(row.eleve_id, classe_id, annee_scolaire_id, t, etabId);
        generes++;
      } catch (e: unknown) {
        erreurs.push({ eleve_id: row.eleve_id, message: String((e as Error).message) });
      }
    }

    // Calculer les rangs après génération
    await calculerRangsClasse(classe_id, annee_scolaire_id, t);

    res.json({ generes, erreurs });
  }
);

/* ─── POST /api/bulletins/calculer-rangs ────────────────────── */
router.post(
  "/bulletins/calculer-rangs",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const { classe_id, annee_scolaire_id, trimestre } = req.body as Record<string, string>;
    if (!classe_id || !annee_scolaire_id || !trimestre) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    await calculerRangsClasse(classe_id, annee_scolaire_id, trimestre as "1" | "2" | "3");
    res.json({ message: "Rangs calculés avec succès." });
  }
);

/* ─── PUT /api/bulletins/publier-classe ─────────────────────── */
router.put(
  "/bulletins/publier-classe",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (user.role !== "directeur" && user.role !== "dev" && user.role !== "censeur") {
      res.status(403).json({ message: "Accès réservé au directeur ou au censeur." });
      return;
    }

    const { classe_id, annee_scolaire_id, trimestre } = req.body as Record<string, string>;
    if (!classe_id || !annee_scolaire_id || !trimestre) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const bulletins = await db
      .select()
      .from(bulletinsTable)
      .where(
        and(
          eq(bulletinsTable.classe_id, classe_id),
          eq(bulletinsTable.annee_scolaire_id, annee_scolaire_id),
          eq(bulletinsTable.trimestre, trimestre as "1" | "2" | "3"),
          eq(bulletinsTable.publie, false)
        )
      );

    let publies = 0;
    const erreurs: Array<{ bulletin_id: string; message: string }> = [];

    for (const b of bulletins) {
      if (!b.moyenne_generale) {
        erreurs.push({ bulletin_id: b.id, message: "Moyenne non calculée." });
        continue;
      }
      if (!b.rang) {
        erreurs.push({ bulletin_id: b.id, message: "Rang non calculé." });
        continue;
      }
      await db
        .update(bulletinsTable)
        .set({
          publie: true,
          date_publication: new Date().toISOString().slice(0, 10),
          valide_par: user.id,
          date_validation: new Date().toISOString().slice(0, 10),
          updated_at: new Date(),
        })
        .where(eq(bulletinsTable.id, b.id));
      publies++;
    }

    res.json({ publies, erreurs });
  }
);

/* ─── GET /api/bulletins/classe/:classeId ───────────────────── */
router.get(
  "/bulletins/classe/:classeId",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const classeId = normalizeId(req.params.classeId);
    const user = req.user!;
    const { trimestre, annee_scolaire_id, publie } = req.query as Record<string, string>;

    const conditions = [eq(bulletinsTable.classe_id, classeId)];
    if (user.role !== "dev") {
      conditions.push(eq(bulletinsTable.etablissement_id, user.etablissement_id ?? ""));
    }
    if (trimestre) conditions.push(eq(bulletinsTable.trimestre, trimestre as "1" | "2" | "3"));
    if (annee_scolaire_id) conditions.push(eq(bulletinsTable.annee_scolaire_id, annee_scolaire_id));
    if (publie !== undefined) conditions.push(eq(bulletinsTable.publie, publie === "true"));

    const bulletins = await db
      .select()
      .from(bulletinsTable)
      .where(and(...conditions));

    const enriched = await Promise.all(bulletins.map(enrichirBulletin));
    enriched.sort((a, b) => {
      if (a.rang === null && b.rang === null) return 0;
      if (a.rang === null) return 1;
      if (b.rang === null) return -1;
      return a.rang - b.rang;
    });

    // Stats classe
    const moyennes = enriched.map(b => b.moyenne_generale).filter((m): m is number => m !== null);
    const stats = {
      moyenne_classe: moyennes.length > 0 ? moyennes.reduce((a, b) => a + b, 0) / moyennes.length : 0,
      meilleure_moyenne: moyennes.length > 0 ? Math.max(...moyennes) : 0,
      plus_basse_moyenne: moyennes.length > 0 ? Math.min(...moyennes) : 0,
      nb_au_dessus_10: moyennes.filter(m => m >= 10).length,
      nb_en_dessous_10: moyennes.filter(m => m < 10).length,
      total: enriched.length,
    };

    res.json({ bulletins: enriched, stats });
  }
);

/* ─── GET /api/bulletins/eleve/:eleveId ─────────────────────── */
router.get(
  "/bulletins/eleve/:eleveId",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const eleveId = normalizeId(req.params.eleveId);
    const user = req.user!;
    const { annee_scolaire_id } = req.query as Record<string, string>;

    // RBAC : parent voit seulement ses enfants, élève voit lui-même
    if (user.role === "eleve" && user.id !== eleveId) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const conditions = [eq(bulletinsTable.eleve_id, eleveId)];
    if (user.role !== "dev") {
      conditions.push(eq(bulletinsTable.etablissement_id, user.etablissement_id ?? ""));
    }
    // Filtre publie pour élève/parent
    if (user.role === "eleve" || user.role === "parent") {
      conditions.push(eq(bulletinsTable.publie, true));
    }
    if (annee_scolaire_id) conditions.push(eq(bulletinsTable.annee_scolaire_id, annee_scolaire_id));

    const bulletins = await db
      .select()
      .from(bulletinsTable)
      .where(and(...conditions));

    const enriched = await Promise.all(bulletins.map(enrichirBulletin));
    res.json({ bulletins: enriched });
  }
);

/* ─── GET /api/bulletins/:id ────────────────────────────────── */
router.get(
  "/bulletins/:id",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;

    const [bulletin] = await db
      .select()
      .from(bulletinsTable)
      .where(eq(bulletinsTable.id, id))
      .limit(1);

    if (!bulletin) {
      res.status(404).json({ message: "Bulletin introuvable." });
      return;
    }

    // Vérifier accès
    if ((user.role === "eleve" || user.role === "parent") && !bulletin.publie) {
      res.status(403).json({ message: "Ce bulletin n'est pas encore publié." });
      return;
    }
    if (user.role === "eleve" && bulletin.eleve_id !== user.id) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const enriched = await enrichirBulletin(bulletin);
    res.json({ bulletin: enriched });
  }
);

/* ─── PUT /api/bulletins/:id/appreciation ───────────────────── */
router.put(
  "/bulletins/:id/appreciation",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const id = normalizeId(req.params.id);
    const { appreciation_conseil, decision_conseil } = req.body as {
      appreciation_conseil?: string | null;
      decision_conseil?: string | null;
    };

    const [bulletin] = await db
      .select()
      .from(bulletinsTable)
      .where(eq(bulletinsTable.id, id))
      .limit(1);

    if (!bulletin) {
      res.status(404).json({ message: "Bulletin introuvable." });
      return;
    }

    const [updated] = await db
      .update(bulletinsTable)
      .set({
        appreciation_conseil: appreciation_conseil ?? bulletin.appreciation_conseil,
        decision_conseil: (decision_conseil as "passage" | "redoublement" | "exclusion" | "orientation" | null) ?? bulletin.decision_conseil,
        updated_at: new Date(),
      })
      .where(eq(bulletinsTable.id, id))
      .returning();

    const enriched = await enrichirBulletin(updated);
    res.json({ bulletin: enriched });
  }
);

/* ─── PUT /api/bulletins/:id/publier ────────────────────────── */
router.put(
  "/bulletins/:id/publier",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (user.role !== "directeur" && user.role !== "dev" && user.role !== "censeur") {
      res.status(403).json({ message: "Accès réservé au directeur ou au censeur." });
      return;
    }

    const id = normalizeId(req.params.id);
    const [bulletin] = await db
      .select()
      .from(bulletinsTable)
      .where(eq(bulletinsTable.id, id))
      .limit(1);

    if (!bulletin) {
      res.status(404).json({ message: "Bulletin introuvable." });
      return;
    }
    if (!bulletin.moyenne_generale) {
      res.status(400).json({ message: "La moyenne générale doit être calculée avant la publication." });
      return;
    }
    if (!bulletin.rang) {
      res.status(400).json({ message: "Le rang doit être calculé avant la publication. Générez d'abord les bulletins de la classe." });
      return;
    }

    const [updated] = await db
      .update(bulletinsTable)
      .set({
        publie: true,
        date_publication: new Date().toISOString().slice(0, 10),
        valide_par: user.id,
        date_validation: new Date().toISOString().slice(0, 10),
        updated_at: new Date(),
      })
      .where(eq(bulletinsTable.id, id))
      .returning();

    const enriched = await enrichirBulletin(updated);
    res.json({ bulletin: enriched });
  }
);

/* ─── GET /api/bulletins/:id/pdf ────────────────────────────── */
router.get(
  "/bulletins/:id/pdf",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;

    const [bulletin] = await db
      .select()
      .from(bulletinsTable)
      .where(eq(bulletinsTable.id, id))
      .limit(1);

    if (!bulletin) {
      res.status(404).json({ message: "Bulletin introuvable." });
      return;
    }

    if ((user.role === "eleve" || user.role === "parent") && !bulletin.publie) {
      res.status(403).json({ message: "Ce bulletin n'est pas encore publié." });
      return;
    }

    const b = await enrichirBulletin(bulletin);

    const [etab] = await db
      .select()
      .from(etablissementsTable)
      .where(eq(etablissementsTable.id, bulletin.etablissement_id))
      .limit(1);

    const mentionLabel: Record<string, string> = {
      tres_bien: "Très Bien", bien: "Bien", assez_bien: "Assez Bien",
      passable: "Passable", insuffisant: "Insuffisant",
    };
    const decisionLabel: Record<string, string> = {
      passage: "Passage en classe supérieure", redoublement: "Redoublement",
      exclusion: "Exclusion", orientation: "Orientation",
    };
    const mentionColor: Record<string, string> = {
      tres_bien: "#00C9A7", bien: "#0080FF", assez_bien: "#F5C842",
      passable: "#F97316", insuffisant: "#FF4D6D",
    };

    const trimestreLabel = `Trimestre ${b.trimestre}`;
    const mention = b.mention ? mentionLabel[b.mention] ?? b.mention : "—";
    const mentionBg = b.mention ? mentionColor[b.mention] ?? "#8B9DC3" : "#8B9DC3";

    const tableRows = b.details.map(d => {
      const moy = d.moyenne_matiere;
      const rowBg = moy === null ? "#fff" : moy >= 14 ? "#e6f9f5" : moy < 10 ? "#fff0f3" : "#fff";
      const moyColor = moy === null ? "#666" : moy >= 10 ? "#00aa88" : "#cc2244";
      return `
        <tr style="background:${rowBg}">
          <td style="padding:8px 12px;border:1px solid #ddd;font-weight:500">${d.matiere}</td>
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:center">${d.coefficient}</td>
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:center;color:${moyColor};font-weight:bold">
            ${moy !== null ? moy.toFixed(2) : "—"}
          </td>
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:center">${d.moyenne_classe !== null ? d.moyenne_classe.toFixed(2) : "—"}</td>
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:center">${d.note_min_classe !== null ? d.note_min_classe.toFixed(2) : "—"}</td>
          <td style="padding:8px 12px;border:1px solid #ddd;text-align:center">${d.note_max_classe !== null ? d.note_max_classe.toFixed(2) : "—"}</td>
          <td style="padding:8px 12px;border:1px solid #ddd;color:#555;font-style:italic">${d.appreciation_prof ?? ""}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Bulletin — ${b.eleve_prenoms} ${b.eleve_nom}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Times New Roman', serif; margin: 0; padding: 20px; color: #111; font-size: 12px; }
    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
      @page { margin: 1.5cm; size: A4; }
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0A1628; padding-bottom: 12px; margin-bottom: 16px; }
    .etab-name { font-size: 18px; font-weight: bold; color: #0A1628; }
    .etab-sub { color: #555; font-size: 11px; margin-top: 4px; }
    .bulletin-title { text-align: center; font-size: 16px; font-weight: bold; color: #0A1628; text-transform: uppercase; letter-spacing: 2px; }
    .eleve-info { background: #f8f9fa; border: 1px solid #ddd; border-radius: 4px; padding: 12px 16px; margin-bottom: 16px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .info-item { display: flex; flex-direction: column; }
    .info-label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
    .info-value { font-weight: bold; font-size: 13px; color: #0A1628; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead th { background: #0A1628; color: #fff; padding: 10px 12px; text-align: center; border: 1px solid #0A1628; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; }
    thead th:first-child { text-align: left; }
    .summary-box { display: flex; justify-content: space-around; align-items: center; background: #0A1628; color: #fff; padding: 16px; border-radius: 4px; margin-bottom: 16px; }
    .summary-item { text-align: center; }
    .summary-label { font-size: 10px; opacity: 0.7; text-transform: uppercase; }
    .summary-value { font-size: 22px; font-weight: bold; color: #00C9A7; }
    .summary-mention { display: inline-block; background: ${mentionBg}; color: #fff; padding: 4px 12px; border-radius: 20px; font-weight: bold; font-size: 13px; }
    .conseil-box { border: 1px solid #ddd; border-radius: 4px; padding: 12px; margin-bottom: 16px; }
    .conseil-title { font-size: 11px; font-weight: bold; color: #0A1628; text-transform: uppercase; margin-bottom: 6px; }
    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 72px; color: rgba(255,0,0,0.07); font-weight: bold; text-transform: uppercase; pointer-events: none; z-index: 0; white-space: nowrap; }
    .footer { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #888; }
    .print-btn { position: fixed; bottom: 24px; right: 24px; background: #0A1628; color: #fff; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; }
    .print-btn:hover { background: #00C9A7; }
  </style>
</head>
<body>
  ${!b.publie ? '<div class="watermark">NON PUBLIÉ</div>' : ""}
  
  <div class="no-print">
    <button class="print-btn" onclick="window.print()">🖨️ Imprimer / PDF</button>
  </div>

  <!-- En-tête -->
  <div class="header">
    <div>
      <div class="etab-name">${etab?.nom ?? "Établissement"}</div>
      <div class="etab-sub">${etab?.ville ?? ""} — Côte d'Ivoire</div>
      <div class="etab-sub">${b.annee_scolaire_libelle ?? "Année scolaire"}</div>
    </div>
    <div style="text-align:center">
      <div class="bulletin-title">Bulletin Scolaire</div>
      <div style="font-size:13px;margin-top:4px;color:#555">${trimestreLabel}</div>
    </div>
    <div style="text-align:right;font-size:11px;color:#555">
      <div>m15-schooltech.ci</div>
      ${b.publie ? `<div style="color:#00aa88;font-weight:bold;margin-top:4px">✓ Publié le ${b.date_publication ?? ""}</div>` : `<div style="color:#cc2244;font-weight:bold;margin-top:4px">⚠ Non publié</div>`}
    </div>
  </div>

  <!-- Infos élève -->
  <div class="eleve-info">
    <div class="info-item"><span class="info-label">Nom & Prénoms</span><span class="info-value">${b.eleve_nom?.toUpperCase() ?? ""} ${b.eleve_prenoms ?? ""}</span></div>
    <div class="info-item"><span class="info-label">Matricule</span><span class="info-value">${b.eleve_matricule ?? "—"}</span></div>
    <div class="info-item"><span class="info-label">Classe</span><span class="info-value">${b.classe_nom ?? "—"}</span></div>
  </div>

  <!-- Tableau matières -->
  <table>
    <thead>
      <tr>
        <th style="width:25%;text-align:left">Matière</th>
        <th style="width:7%">Coeff.</th>
        <th style="width:10%">Moy/20</th>
        <th style="width:10%">Moy Classe</th>
        <th style="width:8%">Min</th>
        <th style="width:8%">Max</th>
        <th>Appréciation Prof</th>
      </tr>
    </thead>
    <tbody>
      ${tableRows || '<tr><td colspan="7" style="text-align:center;padding:12px;color:#888">Aucune matière configurée</td></tr>'}
    </tbody>
  </table>

  <!-- Résumé -->
  <div class="summary-box">
    <div class="summary-item">
      <div class="summary-label">Moyenne Générale</div>
      <div class="summary-value">${b.moyenne_generale !== null ? b.moyenne_generale.toFixed(2) : "—"}<span style="font-size:14px;opacity:0.7">/20</span></div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Rang</div>
      <div class="summary-value">${b.rang !== null ? `${b.rang}${b.rang === 1 ? "er" : "ème"}` : "—"}<span style="font-size:14px;opacity:0.7"> /${b.effectif_classe ?? "?"}</span></div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Mention</div>
      <div style="margin-top:4px"><span class="summary-mention">${mention}</span></div>
    </div>
  </div>

  <!-- Conseil de classe -->
  ${b.appreciation_conseil || b.decision_conseil ? `
  <div class="conseil-box">
    <div class="conseil-title">Conseil de Classe</div>
    ${b.appreciation_conseil ? `<p style="margin:4px 0"><strong>Appréciation :</strong> ${b.appreciation_conseil}</p>` : ""}
    ${b.decision_conseil ? `<p style="margin:4px 0"><strong>Décision :</strong> ${decisionLabel[b.decision_conseil] ?? b.decision_conseil}</p>` : ""}
  </div>` : ""}

  <!-- Signatures -->
  <div style="display:flex;justify-content:space-between;margin-top:32px">
    <div style="text-align:center;width:200px">
      <div style="border-top:1px solid #333;padding-top:8px;font-size:11px">Signature du Directeur</div>
    </div>
    <div style="text-align:center;width:200px">
      <div style="border-top:1px solid #333;padding-top:8px;font-size:11px">Cachet de l'Établissement</div>
    </div>
    <div style="text-align:center;width:200px">
      <div style="border-top:1px solid #333;padding-top:8px;font-size:11px">Signature Parent/Tuteur</div>
    </div>
  </div>

  <!-- Pied de page -->
  <div class="footer">
    <span>Plateforme M15-SchoolTech — m15-schooltech.ci</span>
    <span>Généré le ${new Date().toLocaleDateString("fr-FR")}</span>
  </div>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="Bulletin_${b.eleve_matricule ?? b.eleve_id}_T${b.trimestre}_${b.annee_scolaire_libelle ?? ""}.html"`
    );
    res.send(html);
  }
);

export default router;
