import { Router } from "express";
import {
  db,
  criteresAdmissionTable,
  decisionsFinAnneeTable,
  promotionsTable,
  eleveClassesTable,
  bulletinsTable,
  classesTable,
  anneesScolairesTable,
  utilisateursTable,
  notificationsTable,
  parentsElevesTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { eq, and, inArray, isNull, sql } from "drizzle-orm";
import { emitNotification } from "../socket/socketManager";

const router = Router();

const ADMINS = ["dev", "directeur", "censeur"] as const;
const DIRS = ["dev", "directeur"] as const;

/* ── Classes terminales ─────────────────────────────────────── */
const NIVEAUX_TERMINAUX = ["3eme", "3ème", "terminale", "Terminale", "tle", "Tle"];
function estNiveauTerminal(niveau: string): boolean {
  return NIVEAUX_TERMINAUX.some((n) => niveau.toLowerCase().includes(n.toLowerCase()));
}

/* ── Helper : notifier un parent ───────────────────────────── */
async function notifierParent(
  parentId: string,
  etablissementId: string,
  titre: string,
  contenu: string
): Promise<void> {
  try {
    const [notif] = await db.insert(notificationsTable).values({
      destinataire_id: parentId,
      etablissement_id: etablissementId,
      titre,
      contenu,
      type: "message" as const,
    }).returning();
    if (notif) {
      await emitNotification(parentId, {
        id: notif.id,
        titre: notif.titre,
        contenu: notif.contenu,
        type: notif.type,
        lien: notif.lien ?? undefined,
        created_at: notif.created_at,
      });
    }
  } catch {
    // non-bloquant
  }
}

/* ═══════════════════════════════════════════════════════════════
   1. POST /api/cloture/criteres — configurer critères
══════════════════════════════════════════════════════════════ */
router.post("/api/cloture/criteres", authMiddleware, requireRole(...DIRS), async (req, res) => {
  try {
    const user = req.user!;
    const {
      annee_scolaire_id,
      classe_id,
      moyenne_admission,
      nb_matieres_eliminatoires_max,
      moyenne_eliminatoire,
      conseil_obligatoire,
      notes_criteres,
    } = req.body as {
      annee_scolaire_id: string;
      classe_id?: string | null;
      moyenne_admission: number;
      nb_matieres_eliminatoires_max?: number;
      moyenne_eliminatoire?: number | null;
      conseil_obligatoire?: boolean;
      notes_criteres?: string | null;
    };

    if (!annee_scolaire_id || moyenne_admission === undefined) {
      res.status(400).json({ success: false, message: "annee_scolaire_id et moyenne_admission requis" });
      return;
    }

    const etablissement_id = user.etablissement_id!;

    // Upsert : chercher existing
    const whereConditions = classe_id
      ? and(
          eq(criteresAdmissionTable.etablissement_id, etablissement_id),
          eq(criteresAdmissionTable.annee_scolaire_id, annee_scolaire_id),
          eq(criteresAdmissionTable.classe_id, classe_id)
        )
      : and(
          eq(criteresAdmissionTable.etablissement_id, etablissement_id),
          eq(criteresAdmissionTable.annee_scolaire_id, annee_scolaire_id),
          isNull(criteresAdmissionTable.classe_id)
        );

    const [existing] = await db.select().from(criteresAdmissionTable).where(whereConditions);

    const values = {
      etablissement_id,
      annee_scolaire_id,
      classe_id: classe_id ?? null,
      moyenne_admission: String(moyenne_admission),
      nb_matieres_eliminatoires_max: nb_matieres_eliminatoires_max ?? 0,
      ...(moyenne_eliminatoire !== undefined ? { moyenne_eliminatoire: String(moyenne_eliminatoire) } : {}),
      ...(conseil_obligatoire !== undefined ? { conseil_obligatoire } : {}),
      ...(notes_criteres !== undefined ? { notes_criteres } : {}),
      updated_at: new Date(),
    };

    let critere;
    if (existing) {
      [critere] = await db.update(criteresAdmissionTable).set(values).where(whereConditions).returning();
    } else {
      [critere] = await db.insert(criteresAdmissionTable).values(values).returning();
    }

    res.json({ success: true, data: critere });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   2. GET /api/cloture/criteres
══════════════════════════════════════════════════════════════ */
router.get("/api/cloture/criteres", authMiddleware, requireRole(...ADMINS), async (req, res) => {
  try {
    const user = req.user!;
    const { annee_scolaire_id } = req.query as { annee_scolaire_id: string };

    if (!annee_scolaire_id) {
      res.status(400).json({ success: false, message: "annee_scolaire_id requis" });
      return;
    }

    const etablissement_id = user.etablissement_id!;
    const criteres = await db
      .select()
      .from(criteresAdmissionTable)
      .where(
        and(
          eq(criteresAdmissionTable.etablissement_id, etablissement_id),
          eq(criteresAdmissionTable.annee_scolaire_id, annee_scolaire_id)
        )
      );

    const global = criteres.find((c: any) => c.classe_id === null) ?? null;
    const par_classe = criteres.filter((c: any) => c.classe_id !== null);

    res.json({ success: true, data: { global, par_classe } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   3. GET /api/cloture/resultats/:classeId
══════════════════════════════════════════════════════════════ */
router.get("/api/cloture/resultats/:classeId", authMiddleware, requireRole(...ADMINS), async (req, res) => {
  try {
    const user = req.user!;
    const classeId = req.params["classeId"] as string;
    const { annee_scolaire_id } = req.query as { annee_scolaire_id: string };

    if (!annee_scolaire_id) {
      res.status(400).json({ success: false, message: "annee_scolaire_id requis" });
      return;
    }

    const etablissement_id = user.etablissement_id!;

    // Info classe
    const [classe] = await db.select().from(classesTable).where(eq(classesTable.id, classeId));
    if (!classe) {
      res.status(404).json({ success: false, message: "Classe introuvable" });
      return;
    }

    const est_terminale = estNiveauTerminal(classe.niveau);

    // Critères applicables : classe spécifique ou global
    const [critereClasse] = await db.select().from(criteresAdmissionTable).where(
      and(
        eq(criteresAdmissionTable.etablissement_id, etablissement_id),
        eq(criteresAdmissionTable.annee_scolaire_id, annee_scolaire_id),
        eq(criteresAdmissionTable.classe_id, classeId)
      )
    );
    const [critereGlobal] = await db.select().from(criteresAdmissionTable).where(
      and(
        eq(criteresAdmissionTable.etablissement_id, etablissement_id),
        eq(criteresAdmissionTable.annee_scolaire_id, annee_scolaire_id),
        isNull(criteresAdmissionTable.classe_id)
      )
    );
    const criteres = critereClasse ?? critereGlobal ?? {
      moyenne_admission: "10.00",
      nb_matieres_eliminatoires_max: 0,
      moyenne_eliminatoire: "5.00",
    };

    const moyAdmission = parseFloat(criteres.moyenne_admission ?? "10");
    const moyElim = parseFloat(String(criteres.moyenne_eliminatoire ?? "5"));
    const maxElim = criteres.nb_matieres_eliminatoires_max ?? 0;

    // Élèves de la classe
    const inscriptions = await db
      .select()
      .from(eleveClassesTable)
      .where(
        and(
          eq(eleveClassesTable.classe_id, classeId),
          eq(eleveClassesTable.annee_scolaire_id, annee_scolaire_id),
          eq(eleveClassesTable.statut, "actif")
        )
      );

    if (inscriptions.length === 0) {
      res.json({ success: true, data: { classe: { id: classe.id, nom: classe.nom, niveau: classe.niveau, est_terminale }, criteres, eleves: [], stats: { total: 0, admis: 0, redoublants: 0, sans_decision: 0 } } });
      return;
    }

    const eleveIds = inscriptions.map((i) => i.eleve_id);

    // Bulletins T1, T2, T3
    const bulletins = eleveIds.length > 0 ? await db
      .select()
      .from(bulletinsTable)
      .where(
        and(
          inArray(bulletinsTable.eleve_id, eleveIds),
          eq(bulletinsTable.annee_scolaire_id, annee_scolaire_id),
          eq(bulletinsTable.publie, true)
        )
      ) : [];

    // Décisions déjà enregistrées
    const decisions = eleveIds.length > 0 ? await db
      .select()
      .from(decisionsFinAnneeTable)
      .where(
        and(
          inArray(decisionsFinAnneeTable.eleve_id, eleveIds),
          eq(decisionsFinAnneeTable.annee_scolaire_id, annee_scolaire_id)
        )
      ) : [];

    // Classe destination (classe de niveau supérieur, même filière)
    let classeDestination: { id: string; nom: string } | null = null;
    if (!est_terminale && classe.filiere_id) {
      const classesEtab = await db.select().from(classesTable).where(
        and(
          eq(classesTable.etablissement_id, etablissement_id),
          eq(classesTable.filiere_id, classe.filiere_id),
          eq(classesTable.actif, true)
        )
      );
      // Chercher la classe de niveau supérieur dans la même filière
      const niveauxOrdre = ["6ème", "6eme", "5ème", "5eme", "4ème", "4eme", "3ème", "3eme", "2nde", "seconde", "1ère", "1ere", "terminale", "tle"];
      const niveauActuelIdx = niveauxOrdre.findIndex((n: string) => classe.niveau.toLowerCase().includes(n.toLowerCase()));
      if (niveauActuelIdx >= 0 && niveauActuelIdx < niveauxOrdre.length - 1) {
        const niveauSup = niveauxOrdre[niveauActuelIdx + 1];
        const dest = classesEtab.find((c: {id:string;nom:string;niveau:string}) =>
          c.id !== classeId && c.niveau.toLowerCase().includes(niveauSup?.toLowerCase() ?? "")
        );
        if (dest) classeDestination = { id: dest.id, nom: dest.nom };
      }
    }

    // Infos élèves
    const utilisateurs = eleveIds.length > 0 ? await db.select({
      id: utilisateursTable.id,
      nom: utilisateursTable.nom,
      prenoms: utilisateursTable.prenoms,
    }).from(utilisateursTable).where(inArray(utilisateursTable.id, eleveIds)) : [];

    // Construire résultats
    const eleves = inscriptions.map((insc) => {
      const user_ = utilisateurs.find((u) => u.id === insc.eleve_id);
      const bT1 = bulletins.find(b => b.eleve_id === insc.eleve_id && b.trimestre === "1");
      const bT2 = bulletins.find(b => b.eleve_id === insc.eleve_id && b.trimestre === "2");
      const bT3 = bulletins.find(b => b.eleve_id === insc.eleve_id && b.trimestre === "3");

      const mT1 = bT1?.moyenne_generale ? parseFloat(bT1.moyenne_generale) : null;
      const mT2 = bT2?.moyenne_generale ? parseFloat(bT2.moyenne_generale) : null;
      const mT3 = bT3?.moyenne_generale ? parseFloat(bT3.moyenne_generale) : null;

      const disponibles = [mT1, mT2, mT3].filter((m) => m !== null) as number[];
      const moyenne_annuelle = disponibles.length > 0
        ? Math.round((disponibles.reduce((s, m) => s + m, 0) / disponibles.length) * 100) / 100
        : null;

      const bulletin_incomplet = [mT1, mT2, mT3].some((m) => m === null);

      // Matières éliminatoires estimées depuis moyenne générale (approx)
      const nb_matieres_elim = 0; // Sans bulletinDetails, on ne peut pas calculer par matière

      // Proposition auto
      let proposition_auto = "redoublant";
      if (est_terminale) {
        proposition_auto = "oriente_sortie";
      } else if (moyenne_annuelle !== null && moyenne_annuelle >= moyAdmission && nb_matieres_elim <= maxElim) {
        proposition_auto = "admis";
      }

      const decisionEnregistree = decisions.find(d => d.eleve_id === insc.eleve_id);

      return {
        eleve_id: insc.eleve_id,
        nom: user_?.nom ?? "",
        prenom: user_?.prenoms ?? "",
        matricule: null,
        moyenne_t1: mT1,
        moyenne_t2: mT2,
        moyenne_t3: mT3,
        moyenne_annuelle,
        nb_matieres_elim,
        bulletin_incomplet,
        proposition_auto,
        decision_enregistree: decisionEnregistree?.decision ?? null,
        decision_id: decisionEnregistree?.id ?? null,
        classe_destination_id: decisionEnregistree?.classe_destination_id ?? classeDestination?.id ?? null,
        classe_destination_nom: classeDestination?.nom ?? null,
        parent_notifie: decisionEnregistree?.parent_notifie ?? false,
      };
    });

    const stats = {
      total: eleves.length,
      admis: eleves.filter(e => e.decision_enregistree === "admis" || e.decision_enregistree === "admis_avec_reserve").length,
      redoublants: eleves.filter(e => e.decision_enregistree === "redoublant").length,
      sans_decision: eleves.filter(e => !e.decision_enregistree).length,
    };

    res.json({
      success: true,
      data: {
        classe: { id: classe.id, nom: classe.nom, niveau: classe.niveau, est_terminale },
        criteres: {
          moyenne_admission: criteres.moyenne_admission,
          nb_matieres_eliminatoires_max: criteres.nb_matieres_eliminatoires_max,
          moyenne_eliminatoire: criteres.moyenne_eliminatoire ?? null,
        },
        eleves,
        stats,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   4. POST /api/cloture/decisions — enregistrer une décision
══════════════════════════════════════════════════════════════ */
router.post("/api/cloture/decisions", authMiddleware, requireRole(...ADMINS), async (req, res) => {
  try {
    const user = req.user!;
    const {
      eleve_id, classe_id, annee_scolaire_id, decision,
      classe_destination_id, filiere_destination_id, motif,
      conseil_classe_id, date_decision, moyenne_annuelle,
    } = req.body as {
      eleve_id: string;
      classe_id: string;
      annee_scolaire_id: string;
      decision: string;
      classe_destination_id?: string | null;
      filiere_destination_id?: string | null;
      motif?: string | null;
      conseil_classe_id?: string | null;
      date_decision: string;
      moyenne_annuelle?: number | null;
    };

    if (!eleve_id || !classe_id || !annee_scolaire_id || !decision || !date_decision) {
      res.status(400).json({ success: false, message: "Champs requis manquants" });
      return;
    }

    // Validation cohérence
    if (decision === "admis" || decision === "admis_avec_reserve") {
      if (!classe_destination_id) {
        res.status(400).json({ success: false, message: "classe_destination_id requis pour décision admis" });
        return;
      }
    }

    const etablissement_id = user.etablissement_id!;

    // Vérifier classe terminale
    const [classe] = await db.select().from(classesTable).where(eq(classesTable.id, classe_id));
    if (classe && estNiveauTerminal(classe.niveau)) {
      if (decision === "admis" || decision === "redoublant" || decision === "admis_avec_reserve") {
        res.status(400).json({ success: false, message: `Décision '${decision}' non autorisée pour une classe terminale` });
        return;
      }
    }

    const values = {
      etablissement_id,
      eleve_id,
      classe_id,
      annee_scolaire_id,
      decision: decision as "admis" | "redoublant" | "exclu" | "oriente_sortie" | "admis_avec_reserve",
      ...(classe_destination_id !== undefined ? { classe_destination_id: classe_destination_id ?? null } : {}),
      ...(filiere_destination_id !== undefined ? { filiere_destination_id: filiere_destination_id ?? null } : {}),
      ...(motif !== undefined ? { motif: motif ?? null } : {}),
      ...(conseil_classe_id !== undefined ? { conseil_classe_id: conseil_classe_id ?? null } : {}),
      date_decision,
      ...(moyenne_annuelle !== undefined ? { moyenne_annuelle: moyenne_annuelle !== null ? String(moyenne_annuelle) : null } : {}),
      decidee_par: user.id,
      updated_at: new Date(),
    };

    // Upsert
    const [existing] = await db.select().from(decisionsFinAnneeTable).where(
      and(
        eq(decisionsFinAnneeTable.eleve_id, eleve_id),
        eq(decisionsFinAnneeTable.annee_scolaire_id, annee_scolaire_id)
      )
    );

    let decisionRec;
    if (existing) {
      [decisionRec] = await db.update(decisionsFinAnneeTable).set(values).where(
        and(
          eq(decisionsFinAnneeTable.eleve_id, eleve_id),
          eq(decisionsFinAnneeTable.annee_scolaire_id, annee_scolaire_id)
        )
      ).returning();
    } else {
      [decisionRec] = await db.insert(decisionsFinAnneeTable).values(values).returning();
    }

    res.json({ success: true, data: decisionRec });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   5. POST /api/cloture/decisions/masse
══════════════════════════════════════════════════════════════ */
router.post("/api/cloture/decisions/masse", authMiddleware, requireRole(...DIRS), async (req, res) => {
  try {
    const user = req.user!;
    const { annee_scolaire_id, classe_id, decisions } = req.body as {
      annee_scolaire_id: string;
      classe_id: string;
      decisions: Array<{
        eleve_id: string;
        decision: string;
        classe_destination_id?: string | null;
        motif?: string | null;
      }>;
    };

    if (!annee_scolaire_id || !classe_id || !Array.isArray(decisions)) {
      res.status(400).json({ success: false, message: "Paramètres requis manquants" });
      return;
    }

    const etablissement_id = user.etablissement_id!;
    const erreurs: string[] = [];
    let nb_enregistrees = 0;

    for (const dec of decisions) {
      try {
        if (!dec.eleve_id || !dec.decision) {
          erreurs.push(`Élève ${dec.eleve_id}: eleve_id et decision requis`);
          continue;
        }
        if ((dec.decision === "admis" || dec.decision === "admis_avec_reserve") && !dec.classe_destination_id) {
          erreurs.push(`Élève ${dec.eleve_id}: classe_destination_id requis pour admis`);
          continue;
        }

        const values = {
          etablissement_id,
          eleve_id: dec.eleve_id,
          classe_id,
          annee_scolaire_id,
          decision: dec.decision as "admis" | "redoublant" | "exclu" | "oriente_sortie" | "admis_avec_reserve",
          classe_destination_id: dec.classe_destination_id ?? null,
          motif: dec.motif ?? null,
          decidee_par: user.id,
          date_decision: new Date().toISOString().split("T")[0]!,
          updated_at: new Date(),
        };

        const [existing] = await db.select().from(decisionsFinAnneeTable).where(
          and(
            eq(decisionsFinAnneeTable.eleve_id, dec.eleve_id),
            eq(decisionsFinAnneeTable.annee_scolaire_id, annee_scolaire_id)
          )
        );

        if (existing) {
          await db.update(decisionsFinAnneeTable).set(values).where(eq(decisionsFinAnneeTable.id, existing.id));
        } else {
          await db.insert(decisionsFinAnneeTable).values(values);
        }
        nb_enregistrees++;
      } catch (e) {
        erreurs.push(`Élève ${dec.eleve_id}: erreur lors de l'enregistrement`);
      }
    }

    res.json({ success: true, data: { nb_enregistrees, erreurs } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   6. POST /api/cloture/promouvoir
══════════════════════════════════════════════════════════════ */
router.post("/api/cloture/promouvoir", authMiddleware, requireRole(...DIRS), async (req, res) => {
  try {
    const user = req.user!;
    const { annee_scolaire_source_id, annee_scolaire_destination_id, classe_source_id } = req.body as {
      annee_scolaire_source_id: string;
      annee_scolaire_destination_id: string;
      classe_source_id: string;
    };

    if (!annee_scolaire_source_id || !annee_scolaire_destination_id || !classe_source_id) {
      res.status(400).json({ success: false, message: "Paramètres requis manquants" });
      return;
    }

    const etablissement_id = user.etablissement_id!;

    // Vérifier année destination
    const [anneeDestination] = await db.select().from(anneesScolairesTable).where(
      eq(anneesScolairesTable.id, annee_scolaire_destination_id)
    );
    if (!anneeDestination) {
      res.status(400).json({ success: false, message: "Année scolaire destination introuvable" });
      return;
    }

    // Vérifier promotion déjà effectuée
    const [promotionExistante] = await db.select().from(promotionsTable).where(
      and(
        eq(promotionsTable.etablissement_id, etablissement_id),
        eq(promotionsTable.annee_scolaire_source_id, annee_scolaire_source_id),
        eq(promotionsTable.classe_source_id, classe_source_id)
      )
    );
    if (promotionExistante && promotionExistante.statut !== "annulee") {
      res.status(400).json({ success: false, message: "Une promotion a déjà été effectuée pour cette classe" });
      return;
    }

    // Élèves actifs de la classe
    const inscriptions = await db.select().from(eleveClassesTable).where(
      and(
        eq(eleveClassesTable.classe_id, classe_source_id),
        eq(eleveClassesTable.annee_scolaire_id, annee_scolaire_source_id),
        eq(eleveClassesTable.statut, "actif")
      )
    );
    const eleveIds = inscriptions.map((i) => i.eleve_id);

    // Vérifier que toutes les décisions sont enregistrées
    const decisions = eleveIds.length > 0 ? await db.select().from(decisionsFinAnneeTable).where(
      and(
        inArray(decisionsFinAnneeTable.eleve_id, eleveIds),
        eq(decisionsFinAnneeTable.annee_scolaire_id, annee_scolaire_source_id)
      )
    ) : [];

    const sansDecision = eleveIds.filter(id => !decisions.find(d => d.eleve_id === id));
    if (sansDecision.length > 0) {
      res.status(400).json({
        success: false,
        message: `${sansDecision.length} élève(s) sans décision. Promotion bloquée.`,
      });
      return;
    }

    // Séparer par décision
    const admis = decisions.filter(d => d.decision === "admis" || d.decision === "admis_avec_reserve");
    const redoublants = decisions.filter(d => d.decision === "redoublant");
    const exclus = decisions.filter(d => d.decision === "exclu");
    const sortie = decisions.filter(d => d.decision === "oriente_sortie");

    const dateAffectation = new Date().toISOString().split("T")[0]!;

    // Promotion en cascade
    // 1. Admis → nouvelle inscription dans classe destination
    for (const dec of admis) {
      if (!dec.classe_destination_id) continue;
      try {
        await db.insert(eleveClassesTable).values({
          eleve_id: dec.eleve_id,
          classe_id: dec.classe_destination_id,
          annee_scolaire_id: annee_scolaire_destination_id,
          date_affectation: dateAffectation,
          statut: "actif",
        });
      } catch {
        // ignore si déjà inscrit (contrainte uq)
      }
    }

    // 2. Redoublants → même classe, nouvelle année
    for (const dec of redoublants) {
      try {
        await db.insert(eleveClassesTable).values({
          eleve_id: dec.eleve_id,
          classe_id: classe_source_id,
          annee_scolaire_id: annee_scolaire_destination_id,
          date_affectation: dateAffectation,
          statut: "actif",
        });
      } catch {
        // ignore si déjà inscrit
      }
    }

    // 3. Exclus & sortie → passer statut actuel à "abandonne"
    const idsExitEleves = [...exclus, ...sortie].map(d => d.eleve_id);
    if (idsExitEleves.length > 0) {
      await db.update(eleveClassesTable).set({ statut: "abandonne", updated_at: new Date() }).where(
        and(
          inArray(eleveClassesTable.eleve_id, idsExitEleves),
          eq(eleveClassesTable.annee_scolaire_id, annee_scolaire_source_id),
          eq(eleveClassesTable.classe_id, classe_source_id)
        )
      );
    }

    // Créer entrée promotion
    const [promotion] = await db.insert(promotionsTable).values({
      etablissement_id,
      annee_scolaire_source_id,
      annee_scolaire_destination_id,
      classe_source_id,
      classe_destination_id: admis[0]?.classe_destination_id ?? classe_source_id,
      nb_eleves_promus: admis.length,
      nb_eleves_redoublants: redoublants.length,
      nb_eleves_exclus: exclus.length,
      nb_eleves_sortie: sortie.length,
      effectuee_par: user.id,
      statut: "terminee",
    }).returning();

    // Notifier parents
    if (eleveIds.length > 0) {
      const parents = await db.select().from(parentsElevesTable).where(
        inArray(parentsElevesTable.eleve_id, eleveIds)
      );

      for (const dec of decisions) {
        const parentsEleve = parents.filter(p => p.eleve_id === dec.eleve_id);
        for (const parent of parentsEleve) {
          const [utilisateurEleve] = await db.select({ prenoms: utilisateursTable.prenoms }).from(utilisateursTable).where(eq(utilisateursTable.id, dec.eleve_id));
          const prenomEleve = utilisateurEleve?.prenoms ?? "votre enfant";
          let titre = "Décision de fin d'année";
          let contenu = "";

          if (dec.decision === "admis" || dec.decision === "admis_avec_reserve") {
            contenu = `Votre enfant ${prenomEleve} est admis(e) en classe supérieure. Félicitations !`;
          } else if (dec.decision === "redoublant") {
            contenu = `Votre enfant ${prenomEleve} redoublera la classe de cette année.`;
          } else if (dec.decision === "exclu") {
            contenu = `Votre enfant ${prenomEleve} ne sera pas réinscrit(e) pour l'année prochaine. Veuillez contacter l'établissement.`;
          } else if (dec.decision === "oriente_sortie") {
            contenu = `Votre enfant ${prenomEleve} a terminé son cycle. Nous lui souhaitons bonne continuation.`;
          }

          await notifierParent(parent.utilisateur_id, etablissement_id, titre, contenu);
        }
      }
    }

    res.json({
      success: true,
      data: {
        promotion_id: promotion!.id,
        stats: {
          promus: admis.length,
          redoublants: redoublants.length,
          exclus: exclus.length,
          sortie: sortie.length,
        },
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   7. POST /api/cloture/notifier
══════════════════════════════════════════════════════════════ */
router.post("/api/cloture/notifier", authMiddleware, requireRole(...ADMINS), async (req, res) => {
  try {
    const user = req.user!;
    const { annee_scolaire_id, classe_id } = req.body as {
      annee_scolaire_id: string;
      classe_id?: string | null;
    };

    if (!annee_scolaire_id) {
      res.status(400).json({ success: false, message: "annee_scolaire_id requis" });
      return;
    }

    const etablissement_id = user.etablissement_id!;

    const conditions = [
      eq(decisionsFinAnneeTable.etablissement_id, etablissement_id),
      eq(decisionsFinAnneeTable.annee_scolaire_id, annee_scolaire_id),
      ...(classe_id ? [eq(decisionsFinAnneeTable.classe_id, classe_id)] : []),
    ];

    const decisions = await db.select().from(decisionsFinAnneeTable).where(and(...conditions));
    const eleveIds = decisions.map(d => d.eleve_id);

    if (eleveIds.length === 0) {
      res.json({ success: true, data: { nb_notifies: 0, erreurs: [] } });
      return;
    }

    const parents = await db.select().from(parentsElevesTable).where(inArray(parentsElevesTable.eleve_id, eleveIds));
    const utilisateurs = await db.select({ id: utilisateursTable.id, prenoms: utilisateursTable.prenoms }).from(utilisateursTable).where(inArray(utilisateursTable.id, eleveIds));

    const erreurs: string[] = [];
    let nb_notifies = 0;

    for (const dec of decisions) {
      try {
        const parentsEleve = parents.filter(p => p.eleve_id === dec.eleve_id);
        if (parentsEleve.length === 0) continue;

        const prenomEleve = utilisateurs.find(u => u.id === dec.eleve_id)?.prenoms ?? "Votre enfant";
        let contenu = "";
        const titre = "Décision de fin d'année scolaire";

        if (dec.decision === "admis" || dec.decision === "admis_avec_reserve") {
          contenu = `Votre enfant ${prenomEleve} est admis(e) en classe supérieure. Félicitations !`;
        } else if (dec.decision === "redoublant") {
          contenu = `Votre enfant ${prenomEleve} redoublera la classe de cette année.`;
        } else if (dec.decision === "exclu") {
          contenu = `Votre enfant ${prenomEleve} ne sera pas réinscrit(e) pour l'année prochaine. Veuillez contacter l'établissement.`;
        } else if (dec.decision === "oriente_sortie") {
          contenu = `Votre enfant ${prenomEleve} a terminé son cycle. Nous lui souhaitons bonne continuation.`;
        }

        for (const parent of parentsEleve) {
          await notifierParent(parent.utilisateur_id, etablissement_id, titre, contenu);
          nb_notifies++;
        }

        // Marquer notifié
        await db.update(decisionsFinAnneeTable).set({ parent_notifie: true, updated_at: new Date() }).where(eq(decisionsFinAnneeTable.id, dec.id));
      } catch {
        erreurs.push(`Élève ${dec.eleve_id}: erreur notification`);
      }
    }

    res.json({ success: true, data: { nb_notifies, erreurs } });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   8. GET /api/cloture/stats
══════════════════════════════════════════════════════════════ */
router.get("/api/cloture/stats", authMiddleware, requireRole(...ADMINS), async (req, res) => {
  try {
    const user = req.user!;
    const { annee_scolaire_id } = req.query as { annee_scolaire_id: string };

    if (!annee_scolaire_id) {
      res.status(400).json({ success: false, message: "annee_scolaire_id requis" });
      return;
    }

    const etablissement_id = user.etablissement_id!;

    // Toutes les classes actives de l'établissement
    const classes = await db.select().from(classesTable).where(
      and(eq(classesTable.etablissement_id, etablissement_id), eq(classesTable.actif, true))
    );

    const par_classe = [];
    let totaux = { total: 0, admis: 0, redoublants: 0, exclus: 0, sortie: 0, sans_decision: 0 };

    for (const classe of classes) {
      const inscriptions = await db.select().from(eleveClassesTable).where(
        and(
          eq(eleveClassesTable.classe_id, classe.id),
          eq(eleveClassesTable.annee_scolaire_id, annee_scolaire_id),
          eq(eleveClassesTable.statut, "actif")
        )
      );
      if (inscriptions.length === 0) continue;

      const eleveIds = inscriptions.map(i => i.eleve_id);
      const decisions = await db.select().from(decisionsFinAnneeTable).where(
        and(
          inArray(decisionsFinAnneeTable.eleve_id, eleveIds),
          eq(decisionsFinAnneeTable.annee_scolaire_id, annee_scolaire_id)
        )
      );

      const admis = decisions.filter(d => d.decision === "admis" || d.decision === "admis_avec_reserve").length;
      const redoublants = decisions.filter(d => d.decision === "redoublant").length;
      const exclus = decisions.filter(d => d.decision === "exclu").length;
      const sortie = decisions.filter(d => d.decision === "oriente_sortie").length;
      const sans_decision = inscriptions.length - decisions.length;
      const taux_reussite = inscriptions.length > 0 ? Math.round((admis / inscriptions.length) * 100) : 0;

      const [promotionClasse] = await db.select().from(promotionsTable).where(
        and(
          eq(promotionsTable.etablissement_id, etablissement_id),
          eq(promotionsTable.classe_source_id, classe.id),
          eq(promotionsTable.annee_scolaire_source_id, annee_scolaire_id)
        )
      );

      par_classe.push({
        classe_id: classe.id,
        classe_nom: classe.nom,
        total: inscriptions.length,
        admis,
        redoublants,
        exclus,
        sortie,
        sans_decision,
        taux_reussite,
        promotion_effectuee: promotionClasse?.statut === "terminee",
      });

      totaux.total += inscriptions.length;
      totaux.admis += admis;
      totaux.redoublants += redoublants;
      totaux.exclus += exclus;
      totaux.sortie += sortie;
      totaux.sans_decision += sans_decision;
    }

    const taux_reussite_global = totaux.total > 0 ? Math.round((totaux.admis / totaux.total) * 100) : 0;

    const promotions = await db.select({
      id: promotionsTable.id,
      classe_source_id: promotionsTable.classe_source_id,
      classe_destination_id: promotionsTable.classe_destination_id,
      nb_eleves_promus: promotionsTable.nb_eleves_promus,
      statut: promotionsTable.statut,
      date_promotion: promotionsTable.date_promotion,
    }).from(promotionsTable).where(
      and(
        eq(promotionsTable.etablissement_id, etablissement_id),
        eq(promotionsTable.annee_scolaire_source_id, annee_scolaire_id)
      )
    );

    const promotionsAvecNom = promotions.map(p => {
      const src = classes.find(c => c.id === p.classe_source_id);
      const dst = classes.find(c => c.id === p.classe_destination_id);
      return {
        ...p,
        classe_source: src?.nom ?? "",
        classe_destination: dst?.nom ?? "",
        nb_promus: p.nb_eleves_promus,
        date_promotion: p.date_promotion.toISOString(),
      };
    });

    res.json({
      success: true,
      data: {
        par_classe,
        totaux: { ...totaux, taux_reussite: taux_reussite_global },
        promotions: promotionsAvecNom,
      },
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   9. PUT /api/cloture/promotions/:id/annuler
══════════════════════════════════════════════════════════════ */
router.put("/api/cloture/promotions/:id/annuler", authMiddleware, requireRole(...DIRS), async (req, res) => {
  try {
    const user = req.user!;
    const id = req.params["id"] as string;

    const [promotion] = await db.select().from(promotionsTable).where(eq(promotionsTable.id, id));
    if (!promotion) {
      res.status(404).json({ success: false, message: "Promotion introuvable" });
      return;
    }

    if (promotion.statut === "annulee") {
      res.status(400).json({ success: false, message: "Promotion déjà annulée" });
      return;
    }

    // Vérifier < 24h
    const diff = Date.now() - promotion.date_promotion.getTime();
    if (diff > 24 * 60 * 60 * 1000) {
      res.status(400).json({ success: false, message: "Annulation impossible après 24h" });
      return;
    }

    // Rollback : supprimer les eleve_classes créés pour l'année destination
    const decisions = await db.select().from(decisionsFinAnneeTable).where(
      and(
        eq(decisionsFinAnneeTable.classe_id, promotion.classe_source_id),
        eq(decisionsFinAnneeTable.annee_scolaire_id, promotion.annee_scolaire_source_id)
      )
    );

    const eleveIds = decisions.map(d => d.eleve_id);
    if (eleveIds.length > 0) {
      // Supprimer inscriptions créées par la promotion (année destination)
      for (const eleveId of eleveIds) {
        await db.delete(eleveClassesTable).where(
          and(
            eq(eleveClassesTable.eleve_id, eleveId),
            eq(eleveClassesTable.annee_scolaire_id, promotion.annee_scolaire_destination_id)
          )
        );
      }

      // Restaurer statut actif pour les exclus/sortie
      const idsExit = decisions.filter(d => d.decision === "exclu" || d.decision === "oriente_sortie").map(d => d.eleve_id);
      if (idsExit.length > 0) {
        await db.update(eleveClassesTable).set({ statut: "actif", updated_at: new Date() }).where(
          and(
            inArray(eleveClassesTable.eleve_id, idsExit),
            eq(eleveClassesTable.annee_scolaire_id, promotion.annee_scolaire_source_id),
            eq(eleveClassesTable.classe_id, promotion.classe_source_id)
          )
        );
      }
    }

    await db.update(promotionsTable).set({ statut: "annulee", updated_at: new Date() }).where(eq(promotionsTable.id, id));

    req.log.info({ promotion_id: id, annulee_par: user.id }, "Promotion annulée");
    res.json({ success: true, message: "Promotion annulée avec succès" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

/* ═══════════════════════════════════════════════════════════════
   10. GET /api/cloture/promotions/historique
══════════════════════════════════════════════════════════════ */
router.get("/api/cloture/promotions/historique", authMiddleware, requireRole(...ADMINS), async (req, res) => {
  try {
    const user = req.user!;
    const { annee_scolaire_id, classe_id } = req.query as {
      annee_scolaire_id?: string;
      classe_id?: string;
    };

    const etablissement_id = user.etablissement_id!;

    const conditions = [
      eq(promotionsTable.etablissement_id, etablissement_id),
      ...(annee_scolaire_id ? [eq(promotionsTable.annee_scolaire_source_id, annee_scolaire_id)] : []),
      ...(classe_id ? [eq(promotionsTable.classe_source_id, classe_id)] : []),
    ];

    const promotions = await db.select().from(promotionsTable).where(and(...conditions));

    // Enrichir avec noms classes/années/utilisateurs
    const classeIds = [...new Set([
      ...promotions.map(p => p.classe_source_id),
      ...promotions.map(p => p.classe_destination_id),
    ])];
    const anneeIds = [...new Set([
      ...promotions.map(p => p.annee_scolaire_source_id),
      ...promotions.map(p => p.annee_scolaire_destination_id),
    ])];
    const userIds = promotions.map(p => p.effectuee_par);

    const [classes, annees, users] = await Promise.all([
      classeIds.length > 0 ? db.select().from(classesTable).where(inArray(classesTable.id, classeIds)) : Promise.resolve([]),
      anneeIds.length > 0 ? db.select().from(anneesScolairesTable).where(inArray(anneesScolairesTable.id, anneeIds)) : Promise.resolve([] as { id: string; libelle: string }[]),
      userIds.length > 0 ? db.select({ id: utilisateursTable.id, nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms }).from(utilisateursTable).where(inArray(utilisateursTable.id, userIds)) : Promise.resolve([] as { id: string; nom: string; prenoms: string | null }[]),
    ]);

    const data = promotions.map(p => ({
      id: p.id,
      classe_source_id: p.classe_source_id,
      classe_source_nom: classes.find(c => c.id === p.classe_source_id)?.nom ?? "",
      classe_destination_id: p.classe_destination_id,
      classe_destination_nom: classes.find(c => c.id === p.classe_destination_id)?.nom ?? "",
      annee_source: annees.find(a => a.id === p.annee_scolaire_source_id)?.libelle ?? "",
      annee_destination: annees.find(a => a.id === p.annee_scolaire_destination_id)?.libelle ?? "",
      nb_eleves_promus: p.nb_eleves_promus,
      nb_eleves_redoublants: p.nb_eleves_redoublants,
      nb_eleves_exclus: p.nb_eleves_exclus,
      nb_eleves_sortie: p.nb_eleves_sortie,
      statut: p.statut,
      date_promotion: p.date_promotion.toISOString(),
      effectuee_par: (() => {
        const u = users.find(u => u.id === p.effectuee_par);
        return u ? `${u.prenoms ?? ''} ${u.nom}` : "";
      })(),
    }));

    res.json({ success: true, data });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ success: false, message: "Erreur serveur" });
  }
});

export default router;
