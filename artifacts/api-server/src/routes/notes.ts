import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db, notesTable, elevesTable, eleveClassesTable,
  utilisateursTable, professeurClassesTable, typesEvaluationsConfigTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

type TypeEval = "devoir" | "interrogation" | "composition" | "examen_blanc" | "tp" | "expose" | "autre";

const TYPES_DEFAUT = [
  { type_evaluation: "composition",   libelle: "Composition",                 coefficient_defaut: "2.00" },
  { type_evaluation: "devoir",        libelle: "Devoir surveillé",            coefficient_defaut: "1.00" },
  { type_evaluation: "interrogation", libelle: "Interrogation orale/écrite",  coefficient_defaut: "1.00" },
  { type_evaluation: "tp",            libelle: "Travaux pratiques",           coefficient_defaut: "1.00" },
  { type_evaluation: "expose",        libelle: "Exposé",                      coefficient_defaut: "1.00" },
  { type_evaluation: "examen_blanc",  libelle: "Examen blanc",                coefficient_defaut: "1.00" },
  { type_evaluation: "autre",         libelle: "Autre",                       coefficient_defaut: "1.00" },
];

async function seederConfigDefaut(etablissement_id: string): Promise<void> {
  const existing = await db
    .select()
    .from(typesEvaluationsConfigTable)
    .where(eq(typesEvaluationsConfigTable.etablissement_id, etablissement_id))
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(typesEvaluationsConfigTable).values(
    TYPES_DEFAUT.map(t => ({ etablissement_id, ...t }))
  ).onConflictDoNothing();
}

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

async function enrichirNote(n: typeof notesTable.$inferSelect) {
  const [eleve] = await db
    .select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
    .from(elevesTable)
    .where(eq(elevesTable.id, n.eleve_id))
    .limit(1);
  return {
    ...n,
    note: Number(n.note),
    note_sur: Number(n.note_sur),
    coefficient: Number(n.coefficient),
    eleve_nom: eleve?.nom ?? null,
    eleve_prenoms: eleve?.prenoms ?? null,
  };
}

/* ─── GET /notes/types-config ───────────────────────── */
router.get(
  "/notes/types-config",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const etabId = user.etablissement_id ?? "";
    if (!etabId) {
      res.json({ types: TYPES_DEFAUT.map((t, i) => ({ id: String(i), ...t, actif: true })) });
      return;
    }
    await seederConfigDefaut(etabId);
    const types = await db
      .select()
      .from(typesEvaluationsConfigTable)
      .where(eq(typesEvaluationsConfigTable.etablissement_id, etabId))
      .orderBy(typesEvaluationsConfigTable.libelle);
    res.json({ types: types.map(t => ({ ...t, coefficient_defaut: Number(t.coefficient_defaut) })) });
  }
);

/* ─── PUT /notes/types-config/:id ───────────────────── */
router.put(
  "/notes/types-config/:id",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!["directeur", "dev"].includes(user.role)) {
      res.status(403).json({ message: "Accès réservé au directeur." });
      return;
    }
    if (!user.etablissement_id) {
      res.status(400).json({ message: "Aucun établissement associé à ce compte." });
      return;
    }
    const id = normalizeId(req.params.id);
    const { libelle, coefficient_defaut, actif } = req.body as {
      libelle?: string;
      coefficient_defaut?: number;
      actif?: boolean;
    };
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (libelle !== undefined) updates.libelle = libelle;
    if (coefficient_defaut !== undefined) {
      if (coefficient_defaut < 0.5 || coefficient_defaut > 10) {
        res.status(400).json({ message: "Le coefficient doit être entre 0.5 et 10." });
        return;
      }
      updates.coefficient_defaut = String(coefficient_defaut);
    }
    if (actif !== undefined) updates.actif = actif;
    const [updated] = await db
      .update(typesEvaluationsConfigTable)
      .set(updates)
      .where(and(
        eq(typesEvaluationsConfigTable.id, id),
        eq(typesEvaluationsConfigTable.etablissement_id, user.etablissement_id ?? "")
      ))
      .returning();
    if (!updated) {
      res.status(404).json({ message: "Configuration introuvable." });
      return;
    }
    res.json({ message: "Configuration mise à jour.", config: { ...updated, coefficient_defaut: Number(updated.coefficient_defaut) } });
  }
);

/* ─── POST /api/notes/saisir ─────────────────────────────── */
router.post(
  "/notes/saisir",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const {
      eleve_id, classe_id, annee_scolaire_id, matiere,
      type_evaluation, trimestre, intitule, note,
      note_sur = 20, coefficient = 1, periode, date_evaluation, observations,
    } = req.body as Record<string, string | number>;

    if (!eleve_id || !classe_id || !matiere || !type_evaluation ||
        !trimestre || !intitule || note === undefined || !date_evaluation) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const n = Number(note);
    const ns = Number(note_sur);
    if (n < 0 || n > ns) {
      res.status(400).json({ message: `La note doit être entre 0 et ${ns}.` });
      return;
    }

    if (user.role === "professeur") {
      const [assoc] = await db
        .select()
        .from(professeurClassesTable)
        .where(
          and(
            eq(professeurClassesTable.professeur_id, user.id),
            eq(professeurClassesTable.classe_id, String(classe_id)),
            eq(professeurClassesTable.matiere, String(matiere))
          )
        )
        .limit(1);
      if (!assoc) {
        res.status(403).json({ message: "Vous n'enseignez pas cette matière dans cette classe." });
        return;
      }

      const [eleveClasse] = await db
        .select()
        .from(eleveClassesTable)
        .where(
          and(
            eq(eleveClassesTable.eleve_id, String(eleve_id)),
            eq(eleveClassesTable.classe_id, String(classe_id)),
            ...(annee_scolaire_id ? [eq(eleveClassesTable.annee_scolaire_id, String(annee_scolaire_id))] : [])
          )
        )
        .limit(1);
      if (!eleveClasse) {
        res.status(400).json({ message: "Cet élève n'appartient pas à cette classe." });
        return;
      }
    }

    const [note_] = await db
      .insert(notesTable)
      .values({
        etablissement_id: user.etablissement_id ?? "",
        professeur_id: user.id,
        eleve_id: String(eleve_id),
        classe_id: String(classe_id),
        annee_scolaire_id: String(annee_scolaire_id),
        matiere: String(matiere),
        type_evaluation: String(type_evaluation) as TypeEval,
        trimestre: String(trimestre) as "1" | "2" | "3",
        intitule: String(intitule),
        note: String(n),
        note_sur: String(ns),
        coefficient: String(Number(coefficient)),
        periode: periode ? String(periode) : null,
        date_evaluation: String(date_evaluation),
        observations: observations ? String(observations) : null,
      })
      .returning();

    res.status(201).json({ message: "Note saisie.", note: await enrichirNote(note_) });
  }
);

/* ─── POST /api/notes/saisir-groupe ─────────────────────── */
router.post(
  "/notes/saisir-groupe",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const {
      classe_id, matiere, type_evaluation, trimestre, intitule,
      annee_scolaire_id, note_sur = 20, coefficient = 1,
      date_evaluation, periode, notes,
    } = req.body as {
      classe_id: string;
      matiere: string;
      type_evaluation: string;
      trimestre: string;
      intitule: string;
      annee_scolaire_id: string;
      note_sur?: number;
      coefficient?: number;
      date_evaluation: string;
      periode?: string;
      notes: { eleve_id: string; note: number; observations?: string }[];
    };

    if (!classe_id || !matiere || !type_evaluation || !trimestre ||
        !intitule || !date_evaluation || !Array.isArray(notes)) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    let saisies = 0;
    const erreurs: unknown[] = [];

    for (const item of notes) {
      try {
        const n = Number(item.note);
        const ns = Number(note_sur);
        if (n < 0 || n > ns) {
          erreurs.push({ eleve_id: item.eleve_id, message: `Note invalide: ${n}/${ns}` });
          continue;
        }
        // Supprimer l'éventuelle note existante pour éviter les doublons
        await db.delete(notesTable).where(and(
          eq(notesTable.eleve_id, item.eleve_id),
          eq(notesTable.intitule, intitule),
          eq(notesTable.classe_id, classe_id),
          eq(notesTable.matiere, matiere),
          eq(notesTable.trimestre, trimestre as "1" | "2" | "3"),
          eq(notesTable.annee_scolaire_id, annee_scolaire_id),
        ));
        await db.insert(notesTable).values({
          etablissement_id: user.etablissement_id ?? "",
          professeur_id: user.id,
          eleve_id: item.eleve_id,
          classe_id,
          annee_scolaire_id,
          matiere,
          type_evaluation: type_evaluation as TypeEval,
          trimestre: trimestre as "1" | "2" | "3",
          intitule,
          note: String(n),
          note_sur: String(ns),
          coefficient: String(Number(coefficient)),
          periode: periode ?? null,
          date_evaluation,
          observations: item.observations ?? null,
        });
        saisies++;
      } catch (e) {
        erreurs.push({ eleve_id: item.eleve_id, message: (e as Error).message });
      }
    }

    res.json({ saisies, erreurs });
  }
);

/* ─── GET /api/notes/classe/:classeId ───────────────────── */
router.get(
  "/notes/classe/:classeId",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const classeId = normalizeId(req.params.classeId);
    const user = req.user!;
    const { matiere, trimestre, type_evaluation, annee_scolaire_id } =
      req.query as Record<string, string>;

    const conditions = [
      eq(notesTable.etablissement_id, user.etablissement_id ?? ""),
      eq(notesTable.classe_id, classeId),
    ];
    if (matiere) conditions.push(eq(notesTable.matiere, matiere));
    if (trimestre) conditions.push(eq(notesTable.trimestre, trimestre as "1" | "2" | "3"));
    if (type_evaluation)
      conditions.push(eq(notesTable.type_evaluation, type_evaluation as TypeEval));
    if (annee_scolaire_id)
      conditions.push(eq(notesTable.annee_scolaire_id, annee_scolaire_id));

    const rows = await db
      .select()
      .from(notesTable)
      .where(and(...conditions))
      .orderBy(desc(notesTable.date_evaluation));

    const enriched = await Promise.all(rows.map(enrichirNote));

    const notes_num = enriched.map(n => n.note);
    const total = notes_num.length;
    const moyenne_classe = total > 0
      ? Math.round(notes_num.reduce((a, b) => a + b, 0) / total * 100) / 100
      : 0;
    const note_max = total > 0 ? Math.max(...notes_num) : 0;
    const note_min = total > 0 ? Math.min(...notes_num) : 0;

    res.json({
      notes: enriched,
      stats: { moyenne_classe, note_max, note_min, total },
    });
  }
);

/* ─── GET /api/notes/eleve/:eleveId ─────────────────────── */
router.get(
  "/notes/eleve/:eleveId",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const eleveId = normalizeId(req.params.eleveId);
    const user = req.user!;
    const { matiere, trimestre, annee_scolaire_id } = req.query as Record<string, string>;

    const conditions = [
      eq(notesTable.etablissement_id, user.etablissement_id ?? ""),
      eq(notesTable.eleve_id, eleveId),
    ];
    if (matiere) conditions.push(eq(notesTable.matiere, matiere));
    if (trimestre) conditions.push(eq(notesTable.trimestre, trimestre as "1" | "2" | "3"));
    if (annee_scolaire_id)
      conditions.push(eq(notesTable.annee_scolaire_id, annee_scolaire_id));

    const rows = await db
      .select()
      .from(notesTable)
      .where(and(...conditions))
      .orderBy(desc(notesTable.date_evaluation));

    const enriched = await Promise.all(rows.map(enrichirNote));

    // Calcul moyennes pondérées par matière + trimestre
    type Acc = Record<string, { somme_pond: number; somme_coef: number }>;
    const accMap: Acc = {};
    for (const n of enriched) {
      const key = `${n.matiere}__${n.trimestre}`;
      if (!accMap[key]) accMap[key] = { somme_pond: 0, somme_coef: 0 };
      const note_20 = n.note_sur > 0 ? (n.note / n.note_sur) * 20 : 0;
      accMap[key].somme_pond += note_20 * n.coefficient;
      accMap[key].somme_coef += n.coefficient;
    }

    const moyennes = Object.entries(accMap).map(([key, v]) => {
      const [mat, tri] = key.split("__");
      return {
        matiere: mat,
        trimestre: tri,
        moyenne: v.somme_coef > 0 ? Math.round((v.somme_pond / v.somme_coef) * 100) / 100 : 0,
        coefficient_total: v.somme_coef,
      };
    });

    res.json({ notes: enriched, moyennes });
  }
);

/* ─── GET /api/notes/moyennes/:classeId ─────────────────── */
router.get(
  "/notes/moyennes/:classeId",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const classeId = normalizeId(req.params.classeId);
    const user = req.user!;
    const { trimestre, annee_scolaire_id } = req.query as Record<string, string>;

    const conditions = [
      eq(notesTable.etablissement_id, user.etablissement_id ?? ""),
      eq(notesTable.classe_id, classeId),
    ];
    if (trimestre) conditions.push(eq(notesTable.trimestre, trimestre as "1" | "2" | "3"));
    if (annee_scolaire_id)
      conditions.push(eq(notesTable.annee_scolaire_id, annee_scolaire_id));

    const rows = await db
      .select()
      .from(notesTable)
      .where(and(...conditions));

    const parEleve: Record<string, { somme_pond: number; somme_coef: number }> = {};
    const notesParEleve: Record<string, { matiere: string; notes: number[]; coefs: number[] }[]> = {};

    for (const row of rows) {
      if (!parEleve[row.eleve_id]) parEleve[row.eleve_id] = { somme_pond: 0, somme_coef: 0 };
      const note20 = Number(row.note_sur) > 0
        ? (Number(row.note) / Number(row.note_sur)) * 20 : 0;
      const coef = Number(row.coefficient);
      parEleve[row.eleve_id].somme_pond += note20 * coef;
      parEleve[row.eleve_id].somme_coef += coef;

      if (!notesParEleve[row.eleve_id]) notesParEleve[row.eleve_id] = [];
      let matiereEntry = notesParEleve[row.eleve_id].find(e => e.matiere === row.matiere);
      if (!matiereEntry) {
        matiereEntry = { matiere: row.matiere, notes: [], coefs: [] };
        notesParEleve[row.eleve_id].push(matiereEntry);
      }
      matiereEntry.notes.push(note20);
      matiereEntry.coefs.push(coef);
    }

    const eleveIds = Object.keys(parEleve);
    const elevesInfos = eleveIds.length > 0
      ? await db.select().from(elevesTable).where(
          sql`${elevesTable.id} = ANY(${sql.raw(`ARRAY['${eleveIds.join("','")}']::uuid[]`)})`
        )
      : [];

    const classement = Object.entries(parEleve)
      .map(([eleveId, v]) => {
        const eleve = elevesInfos.find(e => e.id === eleveId);
        const moy_gen = v.somme_coef > 0 ? Math.round((v.somme_pond / v.somme_coef) * 100) / 100 : 0;
        const moyennes_matieres = (notesParEleve[eleveId] ?? []).map(me => ({
          matiere: me.matiere,
          moyenne: me.coefs.reduce((a, b) => a + b, 0) > 0
            ? Math.round(
                (me.notes.reduce((a, n, i) => a + n * me.coefs[i], 0) /
                  me.coefs.reduce((a, b) => a + b, 0)) * 100
              ) / 100
            : 0,
        }));
        return { eleve_id: eleveId, eleve_nom: eleve?.nom ?? "", eleve_prenoms: eleve?.prenoms ?? "", moyenne_generale: moy_gen, moyennes_matieres };
      })
      .sort((a, b) => b.moyenne_generale - a.moyenne_generale)
      .map((e, i) => ({ rang: i + 1, ...e }));

    res.json({ classement });
  }
);

/* ─── GET /api/notes/statistiques/:classeId ─────────────── */
router.get(
  "/notes/statistiques/:classeId",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const classeId = normalizeId(req.params.classeId);
    const user = req.user!;
    const { trimestre, annee_scolaire_id } = req.query as Record<string, string>;

    const conditions = [
      eq(notesTable.etablissement_id, user.etablissement_id ?? ""),
      eq(notesTable.classe_id, classeId),
    ];
    if (trimestre) conditions.push(eq(notesTable.trimestre, trimestre as "1" | "2" | "3"));
    if (annee_scolaire_id)
      conditions.push(eq(notesTable.annee_scolaire_id, annee_scolaire_id));

    const rows = await db.select().from(notesTable).where(and(...conditions));

    type GroupKey = string;
    const groups: Record<GroupKey, number[]> = {};
    for (const row of rows) {
      const key = `${row.matiere}__${row.trimestre}`;
      const note20 = Number(row.note_sur) > 0
        ? (Number(row.note) / Number(row.note_sur)) * 20 : 0;
      if (!groups[key]) groups[key] = [];
      groups[key].push(note20);
    }

    const statistiques = Object.entries(groups).map(([key, vals]) => {
      const [matiere, tri] = key.split("__");
      const sorted = [...vals].sort((a, b) => a - b);
      const n = sorted.length;
      const moy = sorted.reduce((a, b) => a + b, 0) / n;
      const mediane = n % 2 === 0
        ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        : sorted[Math.floor(n / 2)];
      const variance = sorted.reduce((acc, v) => acc + Math.pow(v - moy, 2), 0) / n;
      return {
        matiere,
        trimestre: tri,
        moyenne: Math.round(moy * 100) / 100,
        mediane: Math.round(mediane * 100) / 100,
        note_max: sorted[n - 1],
        note_min: sorted[0],
        nb_sup_10: sorted.filter(v => v >= 10).length,
        nb_inf_10: sorted.filter(v => v < 10).length,
        ecart_type: Math.round(Math.sqrt(variance) * 100) / 100,
      };
    });

    res.json({ statistiques });
  }
);

/* ─── PUT /api/notes/:id/modifier ───────────────────────── */
router.put(
  "/notes/:id/modifier",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;

    const [existing] = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.etablissement_id, user.etablissement_id ?? "")))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Note introuvable." });
      return;
    }

    if (user.role === "professeur") {
      if (existing.professeur_id !== user.id) {
        res.status(403).json({ message: "Non autorisé." });
        return;
      }
      const limite = new Date(existing.created_at);
      limite.setDate(limite.getDate() + 7);
      if (new Date() > limite) {
        res.status(403).json({
          message: "Modification possible uniquement dans les 7 jours suivant la saisie. Contactez le directeur.",
        });
        return;
      }
    } else if (!["directeur", "censeur", "dev"].includes(user.role)) {
      res.status(403).json({ message: "Non autorisé." });
      return;
    }

    const { note, note_sur, coefficient, observations } =
      req.body as Record<string, number | string>;

    const n = note !== undefined ? Number(note) : Number(existing.note);
    const ns = note_sur !== undefined ? Number(note_sur) : Number(existing.note_sur);
    if (n < 0 || n > ns) {
      res.status(400).json({ message: `La note doit être entre 0 et ${ns}.` });
      return;
    }

    const [updated] = await db
      .update(notesTable)
      .set({
        note: String(n),
        note_sur: String(ns),
        coefficient: coefficient !== undefined ? String(Number(coefficient)) : existing.coefficient,
        observations: observations ? String(observations) : existing.observations,
        updated_at: new Date(),
      })
      .where(eq(notesTable.id, id))
      .returning();

    res.json({ message: "Note modifiée.", note: await enrichirNote(updated) });
  }
);

/* ─── DELETE /api/notes/:id/supprimer ───────────────────── */
router.delete(
  "/notes/:id/supprimer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;

    if (!["directeur", "censeur", "dev"].includes(user.role)) {
      res.status(403).json({ message: "Seuls le directeur et le censeur peuvent supprimer des notes." });
      return;
    }

    const [existing] = await db
      .select()
      .from(notesTable)
      .where(and(eq(notesTable.id, id), eq(notesTable.etablissement_id, user.etablissement_id ?? "")))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Note introuvable." });
      return;
    }

    await db.delete(notesTable).where(eq(notesTable.id, id));
    res.json({ message: "Note supprimée." });
  }
);

export default router;
