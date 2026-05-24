import { Router } from "express";
import { eq, and, inArray, gte, lte } from "drizzle-orm";
import {
  db, parentsElevesTable, elevesTable, eleveClassesTable, classesTable,
  anneesScolairesTable, filieresTable, notesTable, bulletinsTable,
  absencesTable, cahierTextesTable, emploisDuTempsTable, messagesTable,
  utilisateursTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

/* ── Helper : vérifier lien parent ↔ élève ─────────────────── */
async function verifierLienParent(parentId: string, eleveId: string): Promise<boolean> {
  const [lien] = await db
    .select()
    .from(parentsElevesTable)
    .where(and(
      eq(parentsElevesTable.utilisateur_id, parentId),
      eq(parentsElevesTable.eleve_id, eleveId)
    ))
    .limit(1);
  return !!lien;
}

async function getClasseActiveEleve(eleveId: string) {
  const [ec] = await db
    .select()
    .from(eleveClassesTable)
    .where(and(eq(eleveClassesTable.eleve_id, eleveId), eq(eleveClassesTable.statut, "actif")))
    .limit(1);
  if (!ec) return null;

  const [classe] = await db.select().from(classesTable).where(eq(classesTable.id, ec.classe_id)).limit(1);
  const [annee]  = await db.select().from(anneesScolairesTable).where(eq(anneesScolairesTable.id, ec.annee_scolaire_id)).limit(1);
  const filiere  = classe?.filiere_id
    ? (await db.select().from(filieresTable).where(eq(filieresTable.id, classe.filiere_id)).limit(1))[0]
    : null;

  return { eleveClasse: ec, classe, annee, filiere };
}

/* ── GET /api/parent/mes-enfants ────────────────────────────── */
router.get("/parent/mes-enfants", authMiddleware, async (req, res) => {
  const user = req.user!;
  if (user.role !== "parent") { res.status(403).json({ message: "Accès parent uniquement." }); return; }

  const liens = await db
    .select()
    .from(parentsElevesTable)
    .where(eq(parentsElevesTable.utilisateur_id, user.id));

  const enfants = await Promise.all(liens.map(async l => {
    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, l.eleve_id)).limit(1);
    const ctx = await getClasseActiveEleve(l.eleve_id);
    return {
      id: l.id,
      eleve_id: l.eleve_id,
      nom: eleve?.nom ?? "",
      prenoms: eleve?.prenoms ?? "",
      matricule: eleve?.matricule ?? "",
      photo_url: eleve?.photo_url ?? null,
      classe_nom: ctx?.classe?.nom ?? "—",
      annee_scolaire: ctx?.annee?.libelle ?? "—",
      lien: l.lien,
      est_principal: l.est_principal,
    };
  }));

  res.json({ enfants });
});

/* ── GET /api/parent/dashboard ──────────────────────────────── */
router.get("/parent/dashboard", authMiddleware, async (req, res) => {
  const user = req.user!;
  if (user.role !== "parent") { res.status(403).json({ message: "Accès parent uniquement." }); return; }

  const liens = await db
    .select()
    .from(parentsElevesTable)
    .where(eq(parentsElevesTable.utilisateur_id, user.id));

  const today = new Date().toISOString().slice(0, 10);
  const jourSemaine = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"][new Date().getDay()];

  const enfants = await Promise.all(liens.map(async l => {
    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, l.eleve_id)).limit(1);
    const ctx = await getClasseActiveEleve(l.eleve_id);

    /* Dernier bulletin */
    const dernierBulletin = ctx
      ? await db.select().from(bulletinsTable).where(
          and(
            eq(bulletinsTable.eleve_id, l.eleve_id),
            eq(bulletinsTable.annee_scolaire_id, ctx.eleveClasse.annee_scolaire_id),
            eq(bulletinsTable.publie, true)
          )
        ).limit(3)
      : [];

    const bulletinRef = dernierBulletin.sort((a, b) => Number(b.trimestre) - Number(a.trimestre))[0];

    /* Dernières absences */
    const dernieres_absences = await db
      .select()
      .from(absencesTable)
      .where(eq(absencesTable.eleve_id, l.eleve_id))
      .limit(3);

    /* Prochains devoirs */
    const prochains_devoirs = ctx
      ? await db.select().from(cahierTextesTable).where(
          and(
            eq(cahierTextesTable.classe_id, ctx.eleveClasse.classe_id),
            eq(cahierTextesTable.devoir_a_rendre, true),
            gte(cahierTextesTable.date_remise_devoir ?? today, today)
          )
        ).limit(5)
      : [];

    /* Cours du jour */
    const cours_du_jour = ctx
      ? await db.select().from(emploisDuTempsTable).where(
          and(
            eq(emploisDuTempsTable.classe_id, ctx.eleveClasse.classe_id),
            eq(emploisDuTempsTable.jour, jourSemaine.toLowerCase() as "lundi"|"mardi"|"mercredi"|"jeudi"|"vendredi"|"samedi")
          )
        )
      : [];

    /* Messages non lus */
    const nbMessages = await db
      .select()
      .from(messagesTable)
      .where(and(
        eq(messagesTable.destinataire_id, user.id),
        eq(messagesTable.lu, false),
        eq(messagesTable.archive_destinataire, false)
      ));

    return {
      eleve_id: l.eleve_id,
      nom: eleve?.nom ?? "",
      prenoms: eleve?.prenoms ?? "",
      matricule: eleve?.matricule ?? "",
      classe_nom: ctx?.classe?.nom ?? "—",
      classe_id: ctx?.eleveClasse?.classe_id ?? null,
      annee_scolaire_id: ctx?.eleveClasse?.annee_scolaire_id ?? null,
      filiere_nom: ctx?.filiere?.nom ?? null,
      annee_scolaire: ctx?.annee?.libelle ?? "—",
      moyenne_generale: bulletinRef?.moyenne_generale != null ? Number(bulletinRef.moyenne_generale) : null,
      rang: bulletinRef?.rang ?? null,
      effectif: bulletinRef?.effectif_classe ?? null,
      nb_absences: dernieres_absences.filter(a => a.statut === "non_justifiee").length,
      nb_messages_non_lus: nbMessages.length,
      bulletins_disponibles: dernierBulletin.length,
      cours_du_jour,
      dernieres_absences,
      prochains_devoirs,
    };
  }));

  res.json({ enfants });
});

/* ── GET /api/parent/enfant/:eleveId ──────────────────────────── */
router.get("/parent/enfant/:eleveId", authMiddleware, async (req, res) => {
  const user = req.user!;
  const eleveId = req.params["eleveId"] as string;

  if (user.role !== "parent" && !["dev","directeur","censeur"].includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }
  if (user.role === "parent" && !(await verifierLienParent(user.id, eleveId))) {
    res.status(403).json({ message: "Cet élève n'est pas votre enfant." }); return;
  }

  const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, eleveId)).limit(1);
  if (!eleve) { res.status(404).json({ message: "Élève introuvable." }); return; }

  const ctx = await getClasseActiveEleve(eleveId);
  res.json({ eleve, classe: ctx?.classe ?? null, filiere: ctx?.filiere ?? null, annee_scolaire: ctx?.annee ?? null });
});

/* ── GET /api/parent/enfant/:eleveId/notes ───────────────────── */
router.get("/parent/enfant/:eleveId/notes", authMiddleware, async (req, res) => {
  const user = req.user!;
  const eleveId = req.params["eleveId"] as string;
  const { trimestre, annee_scolaire_id } = req.query as Record<string, string>;

  if (user.role === "parent" && !(await verifierLienParent(user.id, eleveId))) {
    res.status(403).json({ message: "Cet élève n'est pas votre enfant." }); return;
  }

  const ctx = await getClasseActiveEleve(eleveId);
  const anneId = annee_scolaire_id ?? ctx?.eleveClasse.annee_scolaire_id ?? "";
  const tri = (trimestre ?? "1") as "1" | "2" | "3";

  const conditions = [
    eq(notesTable.eleve_id, eleveId),
    eq(notesTable.annee_scolaire_id, anneId),
    eq(notesTable.trimestre, tri),
  ];

  const notes = await db.select().from(notesTable).where(and(...conditions));

  /* Regrouper par matière */
  const matieresMap: Record<string, typeof notes> = {};
  for (const n of notes) {
    if (!matieresMap[n.matiere]) matieresMap[n.matiere] = [];
    matieresMap[n.matiere].push(n);
  }

  const matieres = Object.entries(matieresMap).map(([matiere, notesM]) => {
    const totalPoids = notesM.reduce((s, n) => s + Number(n.coefficient), 0);
    const somme = notesM.reduce((s, n) => s + (Number(n.note) / Number(n.note_sur)) * 20 * Number(n.coefficient), 0);
    const moyenne = totalPoids > 0 ? somme / totalPoids : null;
    return {
      matiere,
      coefficient: Number(notesM[0].coefficient),
      notes: notesM,
      moyenne: moyenne != null ? Math.round(moyenne * 100) / 100 : null,
      appreciation: null,
    };
  });

  /* Moyenne générale */
  const [bulletin] = await db
    .select()
    .from(bulletinsTable)
    .where(and(
      eq(bulletinsTable.eleve_id, eleveId),
      eq(bulletinsTable.annee_scolaire_id, anneId),
      eq(bulletinsTable.trimestre, tri)
    ))
    .limit(1);

  res.json({
    matieres,
    moyenne_generale: bulletin?.moyenne_generale != null ? Number(bulletin.moyenne_generale) : null,
    rang: bulletin?.rang ?? null,
    trimestre: tri,
    annee_scolaire_id: anneId,
  });
});

/* ── GET /api/parent/enfant/:eleveId/bulletins ────────────────── */
router.get("/parent/enfant/:eleveId/bulletins", authMiddleware, async (req, res) => {
  const user = req.user!;
  const eleveId = req.params["eleveId"] as string;

  if (user.role === "parent" && !(await verifierLienParent(user.id, eleveId))) {
    res.status(403).json({ message: "Cet élève n'est pas votre enfant." }); return;
  }

  const bulletins = await db
    .select()
    .from(bulletinsTable)
    .where(and(eq(bulletinsTable.eleve_id, eleveId), eq(bulletinsTable.publie, true)));

  const enriched = await Promise.all(bulletins.map(async b => {
    const [annee] = await db.select({ libelle: anneesScolairesTable.libelle }).from(anneesScolairesTable).where(eq(anneesScolairesTable.id, b.annee_scolaire_id)).limit(1);
    return { ...b, annee_scolaire: annee?.libelle ?? "" };
  }));

  res.json({ bulletins: enriched.sort((a, b) => Number(b.trimestre) - Number(a.trimestre)) });
});

/* ── GET /api/parent/enfant/:eleveId/absences ─────────────────── */
router.get("/parent/enfant/:eleveId/absences", authMiddleware, async (req, res) => {
  const user = req.user!;
  const eleveId = req.params["eleveId"] as string;
  const { trimestre, statut } = req.query as Record<string, string>;

  if (user.role === "parent" && !(await verifierLienParent(user.id, eleveId))) {
    res.status(403).json({ message: "Cet élève n'est pas votre enfant." }); return;
  }

  const conditions = [eq(absencesTable.eleve_id, eleveId)];
  if (statut) conditions.push(eq(absencesTable.statut, statut as "non_justifiee" | "justifiee" | "en_attente" | "rejetee"));

  const absences = await db.select().from(absencesTable).where(and(...conditions));
  const total = absences.length;
  const justifiees = absences.filter(a => a.statut === "justifiee").length;
  const non_justifiees = absences.filter(a => a.statut === "non_justifiee").length;
  const taux_presence = total > 0 ? Math.round(((total - non_justifiees) / total) * 100) : 100;

  res.json({
    absences,
    resume: { total, justifiees, non_justifiees, taux_presence },
  });
});

/* ── GET /api/parent/enfant/:eleveId/cahier-textes ────────────── */
router.get("/parent/enfant/:eleveId/cahier-textes", authMiddleware, async (req, res) => {
  const user = req.user!;
  const eleveId = req.params["eleveId"] as string;
  const { matiere } = req.query as Record<string, string>;

  if (user.role === "parent" && !(await verifierLienParent(user.id, eleveId))) {
    res.status(403).json({ message: "Cet élève n'est pas votre enfant." }); return;
  }

  const ctx = await getClasseActiveEleve(eleveId);
  if (!ctx) { res.json({ seances: [], devoirs_a_venir: [] }); return; }

  const conditions = [eq(cahierTextesTable.classe_id, ctx.eleveClasse.classe_id)];
  if (matiere) conditions.push(eq(cahierTextesTable.matiere, matiere));

  const seances = await db.select().from(cahierTextesTable).where(and(...conditions));
  const today = new Date().toISOString().slice(0, 10);
  const devoirs_a_venir = seances.filter(s => s.devoir_a_rendre && s.date_remise_devoir && s.date_remise_devoir >= today);

  res.json({ seances, devoirs_a_venir });
});

/* ── GET /api/parent/enfant/:eleveId/emploi-du-temps ──────────── */
router.get("/parent/enfant/:eleveId/emploi-du-temps", authMiddleware, async (req, res) => {
  const user = req.user!;
  const eleveId = req.params["eleveId"] as string;

  if (user.role === "parent" && !(await verifierLienParent(user.id, eleveId))) {
    res.status(403).json({ message: "Cet élève n'est pas votre enfant." }); return;
  }

  const ctx = await getClasseActiveEleve(eleveId);
  if (!ctx) { res.json({ creneaux: [], classe_id: null }); return; }

  const creneaux = await db
    .select()
    .from(emploisDuTempsTable)
    .where(and(
      eq(emploisDuTempsTable.classe_id, ctx.eleveClasse.classe_id),
      eq(emploisDuTempsTable.annee_scolaire_id, ctx.eleveClasse.annee_scolaire_id),
    ));

  res.json({ creneaux, classe_id: ctx.eleveClasse.classe_id });
});

export default router;
