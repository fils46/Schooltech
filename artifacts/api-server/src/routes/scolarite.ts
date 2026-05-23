import { Router } from "express";
import { eq, and, desc, sql, like, inArray, gte, lte, or } from "drizzle-orm";
import {
  db,
  fraisConfigTable,
  scolariteEleveTable,
  paiementsScolariteTable,
  relancesScolariteTable,
  elevesTable,
  utilisateursTable,
  classesTable,
  eleveClassesTable,
  anneesScolairesTable,
  parentsElevesTable,
  notificationsTable,
  etablissementsTable,
} from "@workspace/db";
import {
  genererMessagePush,
  genererTitrePush,
  niveauRelance,
  premiereTrancheImpayee,
  type RelanceContext,
  type FraisConfigForRelance,
} from "../lib/relanceTemplates";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { emitNotification } from "../socket/socketManager";

const router = Router();
const ADMINS = ["dev", "directeur", "censeur"] as const;
const DIRS  = ["dev", "directeur"] as const;

/* ── Utilitaires ─────────────────────────────────────────────────── */

function toNum(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

function calculerStatut(paye: number, restant: number): "en_regle" | "partiel" | "impaye" {
  if (restant <= 0) return "en_regle";
  if (paye > 0) return "partiel";
  return "impaye";
}

async function genererNumeroRecu(etablissementId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REC-${year}-`;
  const rows = await db
    .select({ num: paiementsScolariteTable.numero_recu })
    .from(paiementsScolariteTable)
    .where(and(
      eq(paiementsScolariteTable.etablissement_id, etablissementId),
      like(paiementsScolariteTable.numero_recu, `${prefix}%`),
    ))
    .orderBy(desc(paiementsScolariteTable.numero_recu))
    .limit(1);
  const last = rows[0]?.num;
  const next = last ? parseInt(last.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(next).padStart(5, "0")}`;
}

async function getAnneeScolaireActive(etablissementId: string) {
  const [as] = await db
    .select()
    .from(anneesScolairesTable)
    .where(and(
      eq(anneesScolairesTable.etablissement_id, etablissementId),
      eq(anneesScolairesTable.est_active, true),
    ))
    .limit(1);
  return as ?? null;
}

async function getNiveauEleve(eleveId: string): Promise<string | null> {
  const [ec] = await db
    .select({ niveau: classesTable.niveau })
    .from(eleveClassesTable)
    .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
    .where(eq(eleveClassesTable.eleve_id, eleveId))
    .orderBy(desc(eleveClassesTable.created_at))
    .limit(1);
  return (ec as { niveau?: string } | undefined)?.niveau ?? null;
}

async function notifierParent(
  eleveId: string,
  etablissementId: string,
  message: string,
  titre = "Scolarité",
) {
  const parents = await db
    .select({ utilisateur_id: parentsElevesTable.utilisateur_id })
    .from(parentsElevesTable)
    .where(eq(parentsElevesTable.eleve_id, eleveId));

  for (const p of parents) {
    const [notif] = await db.insert(notificationsTable).values({
      destinataire_id: p.utilisateur_id,
      etablissement_id: etablissementId,
      titre,
      contenu: message,
      type: "message",
    }).returning();
    if (notif) emitNotification(p.utilisateur_id, notif);
  }
}

/* Construit le contexte de relance enrichi à partir des IDs */
async function construireContexteRelance(
  eleveId: string,
  etablissementId: string,
  scol: typeof scolariteEleveTable.$inferSelect,
  config: FraisConfigForRelance | null,
): Promise<Omit<RelanceContext, "numeroRelance">> {
  const [eleve] = await db
    .select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, sexe: elevesTable.sexe })
    .from(elevesTable).where(eq(elevesTable.id, eleveId)).limit(1);

  const [ec] = await db
    .select({ nom: classesTable.nom })
    .from(eleveClassesTable)
    .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
    .where(eq(eleveClassesTable.eleve_id, eleveId))
    .orderBy(desc(eleveClassesTable.created_at)).limit(1);

  const [etab] = await db
    .select({ nom: etablissementsTable.nom, telephone: etablissementsTable.telephone })
    .from(etablissementsTable).where(eq(etablissementsTable.id, etablissementId)).limit(1);

  const parents = await db
    .select({ utilisateur_id: parentsElevesTable.utilisateur_id })
    .from(parentsElevesTable)
    .where(eq(parentsElevesTable.eleve_id, eleveId)).limit(1);

  let nomParent = "Parent";
  if (parents[0]) {
    const [pu] = await db
      .select({ nom: utilisateursTable.nom })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.id, parents[0].utilisateur_id)).limit(1);
    if (pu) nomParent = pu.nom;
  }

  const trancheInfo = premiereTrancheImpayee(
    {
      inscription_payee: Boolean(scol.inscription_payee),
      tranche1_payee: Boolean(scol.tranche1_payee),
      tranche2_payee: Boolean(scol.tranche2_payee),
      tranche3_payee: Boolean(scol.tranche3_payee),
    },
    config,
  );

  return {
    nomParent,
    prenomEleve: (eleve?.prenoms ?? "").split(" ")[0] || eleve?.nom || "votre enfant",
    nomEleve: eleve?.nom ?? "",
    classeNom: ec?.nom ?? "—",
    nomEtablissement: etab?.nom ?? "l'établissement",
    telephoneEtablissement: etab?.telephone ?? null,
    nomDirecteur: null,
    montantRestant: parseFloat(scol.montant_restant ?? "0") || 0,
    totalDu: parseFloat(scol.montant_total_du ?? "0") || 0,
    totalPaye: parseFloat(scol.montant_total_paye ?? "0") || 0,
    trancheInfo,
  };
}

async function enrichirScolarite(s: typeof scolariteEleveTable.$inferSelect) {
  const [eleve] = await db
    .select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, matricule: elevesTable.matricule, photo_url: elevesTable.photo_url })
    .from(elevesTable).where(eq(elevesTable.id, s.eleve_id)).limit(1);
  const [ec] = await db
    .select({ nom: classesTable.nom })
    .from(eleveClassesTable)
    .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
    .where(eq(eleveClassesTable.eleve_id, s.eleve_id))
    .orderBy(desc(eleveClassesTable.created_at))
    .limit(1);
  const config = await db.select().from(fraisConfigTable).where(eq(fraisConfigTable.id, s.frais_config_id)).limit(1);
  return {
    ...s,
    eleve_nom: eleve?.nom ?? null,
    eleve_prenoms: eleve?.prenoms ?? null,
    eleve_matricule: eleve?.matricule ?? null,
    eleve_photo: eleve?.photo_url ?? null,
    classe_nom: ec?.nom ?? null,
    frais_config: config[0] ?? null,
  };
}

/* ═══════════════════════════════════════════════════════════════════
   FRAIS CONFIG
   ═══════════════════════════════════════════════════════════════════ */

/* POST /scolarite/frais/configurer */
router.post(
  "/scolarite/frais/configurer",
  authMiddleware, verifierLicence, requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const {
      annee_scolaire_id, niveau, filiere_id,
      frais_inscription, frais_scolarite_annuel,
      frais_tranche1, frais_tranche2, frais_tranche3,
      date_limite_tranche1, date_limite_tranche2, date_limite_tranche3,
      autres_frais,
    } = req.body as Record<string, unknown>;

    if (!annee_scolaire_id || !niveau || !frais_scolarite_annuel || !frais_tranche1 || !frais_tranche2 || !frais_tranche3) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }
    const t1 = toNum(frais_tranche1 as string);
    const t2 = toNum(frais_tranche2 as string);
    const t3 = toNum(frais_tranche3 as string);
    const total = toNum(frais_scolarite_annuel as string);
    if (Math.abs(t1 + t2 + t3 - total) > 0.01) {
      res.status(400).json({ message: "La somme des tranches doit être égale aux frais de scolarité annuels." });
      return;
    }

    const etablissementId = user.role === "dev" ? (req.body as Record<string, unknown>).etablissement_id as string : user.etablissement_id!;
    if (!etablissementId) { res.status(400).json({ message: "etablissement_id requis." }); return; }

    const existing = await db.select().from(fraisConfigTable).where(
      and(
        eq(fraisConfigTable.etablissement_id, etablissementId),
        eq(fraisConfigTable.annee_scolaire_id, annee_scolaire_id as string),
        sql`${fraisConfigTable.niveau} = ${niveau as string}`,
      )
    ).limit(1);

    let config;
    if (existing[0]) {
      [config] = await db.update(fraisConfigTable).set({
        frais_inscription: String(frais_inscription ?? 0),
        frais_scolarite_annuel: String(frais_scolarite_annuel),
        frais_tranche1: String(frais_tranche1),
        frais_tranche2: String(frais_tranche2),
        frais_tranche3: String(frais_tranche3),
        date_limite_tranche1: date_limite_tranche1 as string ?? null,
        date_limite_tranche2: date_limite_tranche2 as string ?? null,
        date_limite_tranche3: date_limite_tranche3 as string ?? null,
        autres_frais: autres_frais ?? null,
        filiere_id: filiere_id as string ?? null,
        updated_at: new Date(),
      }).where(eq(fraisConfigTable.id, existing[0].id)).returning();
    } else {
      [config] = await db.insert(fraisConfigTable).values({
        etablissement_id: etablissementId,
        annee_scolaire_id: annee_scolaire_id as string,
        niveau: niveau as "3eme" | "6eme" | "5eme" | "4eme" | "2nde" | "1ere" | "terminale",
        filiere_id: filiere_id as string ?? null,
        frais_inscription: String(frais_inscription ?? 0),
        frais_scolarite_annuel: String(frais_scolarite_annuel),
        frais_tranche1: String(frais_tranche1),
        frais_tranche2: String(frais_tranche2),
        frais_tranche3: String(frais_tranche3),
        date_limite_tranche1: date_limite_tranche1 as string ?? null,
        date_limite_tranche2: date_limite_tranche2 as string ?? null,
        date_limite_tranche3: date_limite_tranche3 as string ?? null,
        autres_frais: autres_frais ?? null,
      }).returning();
    }
    res.json({ success: true, message: "Configuration enregistrée.", data: config });
  },
);

/* GET /scolarite/frais/liste */
router.get(
  "/scolarite/frais/liste",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { annee_scolaire_id } = req.query as Record<string, string>;
    const etablissementId = user.role === "dev" ? (req.query["etablissement_id"] as string) ?? user.etablissement_id : user.etablissement_id!;

    const conditions = [eq(fraisConfigTable.etablissement_id, etablissementId!)];
    if (annee_scolaire_id) conditions.push(eq(fraisConfigTable.annee_scolaire_id, annee_scolaire_id));

    const configs = await db.select().from(fraisConfigTable).where(and(...conditions)).orderBy(fraisConfigTable.niveau);
    res.json({ success: true, data: configs });
  },
);

/* GET /scolarite/frais/:niveau */
router.get(
  "/scolarite/frais/:niveau",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { niveau } = req.params as Record<string, string>;
    const { annee_scolaire_id } = req.query as Record<string, string>;
    const etablissementId = user.role === "dev" ? (req.query["etablissement_id"] as string) ?? user.etablissement_id : user.etablissement_id!;

    let anneeScolaireId = annee_scolaire_id;
    if (!anneeScolaireId) {
      const as = await getAnneeScolaireActive(etablissementId!);
      anneeScolaireId = as?.id;
    }
    if (!anneeScolaireId) { res.status(404).json({ message: "Aucune année scolaire active." }); return; }

    const [config] = await db.select().from(fraisConfigTable).where(
      and(
        eq(fraisConfigTable.etablissement_id, etablissementId!),
        eq(fraisConfigTable.annee_scolaire_id, anneeScolaireId),
        sql`${fraisConfigTable.niveau} = ${niveau}`,
      )
    ).limit(1);
    if (!config) { res.status(404).json({ message: "Configuration non trouvée." }); return; }
    res.json({ success: true, data: config });
  },
);

/* PUT /scolarite/frais/:id */
router.put(
  "/scolarite/frais/:id",
  authMiddleware, verifierLicence, requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const { id } = req.params as Record<string, string>;
    const paiements = await db.select({ id: paiementsScolariteTable.id }).from(paiementsScolariteTable)
      .innerJoin(scolariteEleveTable, eq(paiementsScolariteTable.scolarite_id, scolariteEleveTable.id))
      .where(and(eq(scolariteEleveTable.frais_config_id, id), eq(paiementsScolariteTable.annule, false)))
      .limit(1);
    if (paiements.length > 0) {
      res.status(400).json({ message: "Impossible de modifier : des paiements ont déjà été enregistrés pour cette configuration." });
      return;
    }
    const {
      frais_inscription, frais_scolarite_annuel, frais_tranche1, frais_tranche2, frais_tranche3,
      date_limite_tranche1, date_limite_tranche2, date_limite_tranche3, autres_frais,
    } = req.body as Record<string, unknown>;

    if (frais_tranche1 && frais_tranche2 && frais_tranche3 && frais_scolarite_annuel) {
      const t1 = toNum(frais_tranche1 as string), t2 = toNum(frais_tranche2 as string), t3 = toNum(frais_tranche3 as string);
      if (Math.abs(t1 + t2 + t3 - toNum(frais_scolarite_annuel as string)) > 0.01) {
        res.status(400).json({ message: "La somme des tranches doit être égale aux frais de scolarité annuels." }); return;
      }
    }
    const [updated] = await db.update(fraisConfigTable).set({
      frais_inscription: frais_inscription ? String(frais_inscription) : undefined,
      frais_scolarite_annuel: frais_scolarite_annuel ? String(frais_scolarite_annuel) : undefined,
      frais_tranche1: frais_tranche1 ? String(frais_tranche1) : undefined,
      frais_tranche2: frais_tranche2 ? String(frais_tranche2) : undefined,
      frais_tranche3: frais_tranche3 ? String(frais_tranche3) : undefined,
      date_limite_tranche1: date_limite_tranche1 as string ?? undefined,
      date_limite_tranche2: date_limite_tranche2 as string ?? undefined,
      date_limite_tranche3: date_limite_tranche3 as string ?? undefined,
      autres_frais: autres_frais ?? undefined,
      updated_at: new Date(),
    }).where(eq(fraisConfigTable.id, id)).returning();
    if (!updated) { res.status(404).json({ message: "Configuration non trouvée." }); return; }
    res.json({ success: true, data: updated });
  },
);

/* ═══════════════════════════════════════════════════════════════════
   SCOLARITÉ ÉLÈVE
   ═══════════════════════════════════════════════════════════════════ */

/* POST /scolarite/initialiser */
router.post(
  "/scolarite/initialiser",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { eleve_id, annee_scolaire_id } = req.body as Record<string, string>;
    if (!eleve_id || !annee_scolaire_id) { res.status(400).json({ message: "eleve_id et annee_scolaire_id requis." }); return; }

    const etablissementId = user.role === "dev" ? (req.body as Record<string, unknown>).etablissement_id as string : user.etablissement_id!;

    const existing = await db.select().from(scolariteEleveTable)
      .where(and(eq(scolariteEleveTable.eleve_id, eleve_id), eq(scolariteEleveTable.annee_scolaire_id, annee_scolaire_id))).limit(1);
    if (existing[0]) { res.status(409).json({ message: "Scolarité déjà initialisée pour cet élève et cette année." }); return; }

    const niveauRaw = await getNiveauEleve(eleve_id);
    if (!niveauRaw) { res.status(400).json({ message: "Aucune classe trouvée pour cet élève." }); return; }

    const [config] = await db.select().from(fraisConfigTable).where(
      and(
        eq(fraisConfigTable.etablissement_id, etablissementId),
        eq(fraisConfigTable.annee_scolaire_id, annee_scolaire_id),
        sql`${fraisConfigTable.niveau} = ${niveauRaw}`,
      )
    ).limit(1);
    if (!config) { res.status(404).json({ message: `Aucune configuration de frais pour le niveau ${niveauRaw}.` }); return; }

    const autresFrais = Array.isArray(config.autres_frais)
      ? (config.autres_frais as Array<{ montant?: number }>).reduce((s, f) => s + toNum(String(f.montant ?? 0)), 0)
      : 0;
    const totalDu = toNum(config.frais_inscription) + toNum(config.frais_scolarite_annuel) + autresFrais;

    const [scol] = await db.insert(scolariteEleveTable).values({
      etablissement_id: etablissementId,
      eleve_id,
      annee_scolaire_id,
      frais_config_id: config.id,
      montant_total_du: String(totalDu),
      montant_total_paye: "0",
      montant_restant: String(totalDu),
      statut: "impaye",
    }).returning();
    res.json({ success: true, message: "Scolarité initialisée.", data: scol });
  },
);

/* POST /scolarite/initialiser-classe */
router.post(
  "/scolarite/initialiser-classe",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { classe_id, annee_scolaire_id } = req.body as Record<string, string>;
    if (!classe_id || !annee_scolaire_id) { res.status(400).json({ message: "classe_id et annee_scolaire_id requis." }); return; }
    const etablissementId = user.role === "dev" ? (req.body as Record<string, unknown>).etablissement_id as string : user.etablissement_id!;

    const [classe] = await db.select().from(classesTable).where(eq(classesTable.id, classe_id)).limit(1);
    if (!classe) { res.status(404).json({ message: "Classe non trouvée." }); return; }

    const niveauClasse = (classe as Record<string, unknown>).niveau as string;
    const [config] = await db.select().from(fraisConfigTable).where(
      and(
        eq(fraisConfigTable.etablissement_id, etablissementId),
        eq(fraisConfigTable.annee_scolaire_id, annee_scolaire_id),
        sql`${fraisConfigTable.niveau} = ${niveauClasse}`,
      )
    ).limit(1);
    if (!config) { res.status(404).json({ message: `Aucune configuration de frais pour le niveau ${niveauClasse}.` }); return; }

    const autresFrais = Array.isArray(config.autres_frais)
      ? (config.autres_frais as Array<{ montant?: number }>).reduce((s, f) => s + toNum(String(f.montant ?? 0)), 0)
      : 0;
    const totalDu = toNum(config.frais_inscription) + toNum(config.frais_scolarite_annuel) + autresFrais;

    const eleves = await db
      .select({ id: eleveClassesTable.eleve_id })
      .from(eleveClassesTable)
      .where(eq(eleveClassesTable.classe_id, classe_id));

    let initialises = 0;
    const erreurs: string[] = [];

    for (const { id: eleveId } of eleves) {
      try {
        const existing = await db.select({ id: scolariteEleveTable.id }).from(scolariteEleveTable)
          .where(and(eq(scolariteEleveTable.eleve_id, eleveId), eq(scolariteEleveTable.annee_scolaire_id, annee_scolaire_id))).limit(1);
        if (existing[0]) continue;

        await db.insert(scolariteEleveTable).values({
          etablissement_id: etablissementId,
          eleve_id: eleveId,
          annee_scolaire_id,
          frais_config_id: config.id,
          montant_total_du: String(totalDu),
          montant_total_paye: "0",
          montant_restant: String(totalDu),
          statut: "impaye",
        });
        initialises++;
      } catch (e) {
        erreurs.push(eleveId);
      }
    }
    res.json({ success: true, message: `${initialises} scolarité(s) initialisée(s).`, data: { initialises, erreurs } });
  },
);

/* GET /scolarite/statistiques */
router.get(
  "/scolarite/statistiques",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { annee_scolaire_id, classe_id } = req.query as Record<string, string>;
    const etablissementId = user.role === "dev" ? (req.query["etablissement_id"] as string) ?? user.etablissement_id : user.etablissement_id!;

    const conds = [eq(scolariteEleveTable.etablissement_id, etablissementId!)];
    if (annee_scolaire_id) conds.push(eq(scolariteEleveTable.annee_scolaire_id, annee_scolaire_id));

    let eleveIds: string[] | null = null;
    if (classe_id) {
      const rows = await db.select({ id: eleveClassesTable.eleve_id }).from(eleveClassesTable).where(eq(eleveClassesTable.classe_id, classe_id));
      eleveIds = rows.map(r => r.id);
      if (eleveIds.length > 0) conds.push(inArray(scolariteEleveTable.eleve_id, eleveIds));
    }

    const scolarites = await db.select().from(scolariteEleveTable).where(and(...conds));

    const totalDu = scolarites.reduce((s, r) => s + toNum(r.montant_total_du), 0);
    const totalPaye = scolarites.reduce((s, r) => s + toNum(r.montant_total_paye), 0);
    const totalRestant = scolarites.reduce((s, r) => s + toNum(r.montant_restant), 0);
    const enRegle = scolarites.filter(r => r.statut === "en_regle").length;
    const partiel = scolarites.filter(r => r.statut === "partiel").length;
    const impaye = scolarites.filter(r => r.statut === "impaye").length;
    const tauxRecouvrement = totalDu > 0 ? Math.round((totalPaye / totalDu) * 100) : 0;

    const pConds = [eq(paiementsScolariteTable.etablissement_id, etablissementId!), eq(paiementsScolariteTable.annule, false)];
    if (annee_scolaire_id) {
      const scolIds = scolarites.map(s => s.id);
      if (scolIds.length > 0) pConds.push(inArray(paiementsScolariteTable.scolarite_id, scolIds));
    }
    const paiements = await db.select().from(paiementsScolariteTable).where(and(...pConds));

    const parMode: Record<string, number> = {};
    const parMois: Record<string, number> = {};
    const parTranche: Record<string, number> = {};
    for (const p of paiements) {
      const m = toNum(p.montant);
      parMode[p.mode_paiement] = (parMode[p.mode_paiement] ?? 0) + m;
      const mois = p.date_paiement?.slice(0, 7) ?? "?";
      parMois[mois] = (parMois[mois] ?? 0) + m;
      parTranche[p.type_paiement] = (parTranche[p.type_paiement] ?? 0) + m;
    }

    res.json({
      success: true,
      data: {
        taux_recouvrement: tauxRecouvrement,
        montant_total_du: totalDu,
        montant_total_paye: totalPaye,
        montant_total_restant: totalRestant,
        nb_en_regle: enRegle,
        nb_partiel: partiel,
        nb_impaye: impaye,
        total_eleves: scolarites.length,
        par_mode_paiement: parMode,
        par_mois: Object.entries(parMois).sort(([a], [b]) => a.localeCompare(b)).map(([mois, montant]) => ({ mois, montant })),
        par_tranche: parTranche,
      },
    });
  },
);

/* GET /scolarite/impayes */
router.get(
  "/scolarite/impayes",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { classe_id, annee_scolaire_id } = req.query as Record<string, string>;
    const etablissementId = user.role === "dev" ? (req.query["etablissement_id"] as string) ?? user.etablissement_id : user.etablissement_id!;

    const conds = [
      eq(scolariteEleveTable.etablissement_id, etablissementId!),
      or(eq(scolariteEleveTable.statut, "impaye"), eq(scolariteEleveTable.statut, "partiel")),
    ];
    if (annee_scolaire_id) conds.push(eq(scolariteEleveTable.annee_scolaire_id, annee_scolaire_id));

    let eleveIds: string[] | null = null;
    if (classe_id) {
      const rows = await db.select({ id: eleveClassesTable.eleve_id }).from(eleveClassesTable).where(eq(eleveClassesTable.classe_id, classe_id));
      eleveIds = rows.map(r => r.id);
      if (eleveIds.length > 0) conds.push(inArray(scolariteEleveTable.eleve_id, eleveIds));
    }

    const scolarites = await db.select().from(scolariteEleveTable).where(and(...conds));
    const enriched = await Promise.all(scolarites.map(enrichirScolarite));
    enriched.sort((a, b) => toNum(b.montant_restant) - toNum(a.montant_restant));
    res.json({ success: true, data: enriched });
  },
);

/* GET /scolarite/classe/:classeId */
router.get(
  "/scolarite/classe/:classeId",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { classeId } = req.params as Record<string, string>;
    const { annee_scolaire_id, statut } = req.query as Record<string, string>;
    const etablissementId = user.role === "dev" ? (req.query["etablissement_id"] as string) ?? user.etablissement_id : user.etablissement_id!;

    const eleveRows = await db.select({ id: eleveClassesTable.eleve_id }).from(eleveClassesTable).where(eq(eleveClassesTable.classe_id, classeId));
    const eleveIds = eleveRows.map(r => r.id);
    if (eleveIds.length === 0) { res.json({ success: true, data: [] }); return; }

    const conds = [
      eq(scolariteEleveTable.etablissement_id, etablissementId!),
      inArray(scolariteEleveTable.eleve_id, eleveIds),
    ];
    if (annee_scolaire_id) conds.push(eq(scolariteEleveTable.annee_scolaire_id, annee_scolaire_id));
    if (statut) conds.push(eq(scolariteEleveTable.statut, statut as "en_regle" | "partiel" | "impaye"));

    const scolarites = await db.select().from(scolariteEleveTable).where(and(...conds));
    const enriched = await Promise.all(scolarites.map(enrichirScolarite));
    enriched.sort((a, b) => {
      const order = { impaye: 0, partiel: 1, en_regle: 2 };
      return (order[a.statut as keyof typeof order] ?? 3) - (order[b.statut as keyof typeof order] ?? 3);
    });
    res.json({ success: true, data: enriched, total: enriched.length });
  },
);

/* GET /scolarite/eleve/:eleveId */
router.get(
  "/scolarite/eleve/:eleveId",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { eleveId } = req.params as Record<string, string>;
    const { annee_scolaire_id } = req.query as Record<string, string>;

    if (user.role === "parent") {
      const link = await db.select({ id: parentsElevesTable.id }).from(parentsElevesTable)
        .where(and(eq(parentsElevesTable.utilisateur_id, user.id), eq(parentsElevesTable.eleve_id, eleveId))).limit(1);
      if (!link[0]) { res.status(403).json({ message: "Accès refusé." }); return; }
    } else if (user.role === "eleve") {
      const [eleve] = await db.select({ id: elevesTable.id }).from(elevesTable)
        .where(and(eq(elevesTable.id, eleveId))).limit(1);
      if (!eleve) { res.status(403).json({ message: "Accès refusé." }); return; }
    }

    const conds = [eq(scolariteEleveTable.eleve_id, eleveId)];
    if (annee_scolaire_id) conds.push(eq(scolariteEleveTable.annee_scolaire_id, annee_scolaire_id));

    const [scol] = await db.select().from(scolariteEleveTable).where(and(...conds))
      .orderBy(desc(scolariteEleveTable.created_at)).limit(1);
    if (!scol) { res.status(404).json({ message: "Scolarité non initialisée." }); return; }

    const paiements = await db.select().from(paiementsScolariteTable)
      .where(and(eq(paiementsScolariteTable.scolarite_id, scol.id), eq(paiementsScolariteTable.annule, false)))
      .orderBy(desc(paiementsScolariteTable.date_paiement));

    const enrichedPaiements = await Promise.all(paiements.map(async (p) => {
      const [enr] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, p.enregistre_par)).limit(1);
      return { ...p, enregistre_par_nom: enr?.nom ?? null };
    }));

    const config = scol.frais_config_id
      ? (await db.select().from(fraisConfigTable).where(eq(fraisConfigTable.id, scol.frais_config_id)).limit(1))[0]
      : null;

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, eleveId)).limit(1);

    res.json({
      success: true,
      data: {
        ...scol,
        eleve_nom: eleve?.nom ?? null,
        eleve_prenoms: eleve?.prenoms ?? null,
        eleve_matricule: eleve?.matricule ?? null,
        eleve_photo: eleve?.photo_url ?? null,
        frais_config: config ?? null,
        paiements: enrichedPaiements,
      },
    });
  },
);

/* PUT /scolarite/:id/observations */
router.put(
  "/scolarite/:id/observations",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const { id } = req.params as Record<string, string>;
    const { observations } = req.body as Record<string, string>;
    const [updated] = await db.update(scolariteEleveTable).set({ observations, updated_at: new Date() })
      .where(eq(scolariteEleveTable.id, id)).returning();
    if (!updated) { res.status(404).json({ message: "Scolarité non trouvée." }); return; }
    res.json({ success: true, data: updated });
  },
);

/* ═══════════════════════════════════════════════════════════════════
   PAIEMENTS
   ═══════════════════════════════════════════════════════════════════ */

/* POST /paiements/enregistrer */
router.post(
  "/paiements/enregistrer",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const {
      eleve_id, montant, mode_paiement, type_paiement,
      date_paiement, reference_paiement, observations, annee_scolaire_id,
    } = req.body as Record<string, string>;
    if (!eleve_id || !montant || !mode_paiement || !type_paiement || !date_paiement) {
      res.status(400).json({ message: "Champs obligatoires manquants." }); return;
    }
    const etablissementId = user.etablissement_id ?? (req.body as Record<string, unknown>).etablissement_id as string;

    const scolConds = [eq(scolariteEleveTable.eleve_id, eleve_id)];
    if (annee_scolaire_id) scolConds.push(eq(scolariteEleveTable.annee_scolaire_id, annee_scolaire_id));
    const [scol] = await db.select().from(scolariteEleveTable).where(and(...scolConds))
      .orderBy(desc(scolariteEleveTable.created_at)).limit(1);
    if (!scol) { res.status(404).json({ message: "Scolarité non initialisée pour cet élève." }); return; }

    const montantNum = toNum(montant);
    const nouveauPaye = toNum(scol.montant_total_paye) + montantNum;
    const nouveauRestant = Math.max(0, toNum(scol.montant_total_du) - nouveauPaye);
    const nouveauStatut = calculerStatut(nouveauPaye, nouveauRestant);

    const trancheUpdate: Partial<typeof scolariteEleveTable.$inferInsert> = {};
    if (type_paiement === "inscription") trancheUpdate.inscription_payee = true;
    if (type_paiement === "tranche1") trancheUpdate.tranche1_payee = true;
    if (type_paiement === "tranche2") trancheUpdate.tranche2_payee = true;
    if (type_paiement === "tranche3") trancheUpdate.tranche3_payee = true;

    const numeroRecu = await genererNumeroRecu(etablissementId);

    try {
      const [paiement] = await db.insert(paiementsScolariteTable).values({
        etablissement_id: etablissementId,
        eleve_id,
        scolarite_id: scol.id,
        enregistre_par: user.id,
        numero_recu: numeroRecu,
        montant: String(montantNum),
        mode_paiement: mode_paiement as "especes" | "cheque" | "virement" | "mobile_money" | "autre",
        reference_paiement: reference_paiement ?? null,
        type_paiement: type_paiement as "inscription" | "tranche1" | "tranche2" | "tranche3" | "autre",
        date_paiement,
        observations: observations ?? null,
      }).returning();

      const [updatedScol] = await db.update(scolariteEleveTable).set({
        montant_total_paye: String(nouveauPaye),
        montant_restant: String(nouveauRestant),
        statut: nouveauStatut,
        ...trancheUpdate,
        updated_at: new Date(),
      }).where(eq(scolariteEleveTable.id, scol.id)).returning();

      const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms }).from(elevesTable).where(eq(elevesTable.id, eleve_id)).limit(1);
      const nomEleve = eleve ? `${eleve.prenoms} ${eleve.nom}` : "Élève";
      const msg = `Paiement reçu : ${montantNum.toLocaleString("fr-FR")} FCFA (${type_paiement}) — Reçu N°${numeroRecu}. Restant : ${nouveauRestant.toLocaleString("fr-FR")} FCFA.`;
      await notifierParent(eleve_id, etablissementId, msg);

      res.json({ success: true, message: "Paiement enregistré.", data: { paiement, scolarite: updatedScol, numero_recu: numeroRecu } });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur lors de l'enregistrement du paiement." });
    }
  },
);

/* PUT /paiements/:id/annuler */
router.put(
  "/paiements/:id/annuler",
  authMiddleware, verifierLicence, requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const { id } = req.params as Record<string, string>;
    const [paiement] = await db.select().from(paiementsScolariteTable).where(eq(paiementsScolariteTable.id, id)).limit(1);
    if (!paiement) { res.status(404).json({ message: "Paiement non trouvé." }); return; }
    if (paiement.annule) { res.status(400).json({ message: "Paiement déjà annulé." }); return; }

    const [scol] = await db.select().from(scolariteEleveTable).where(eq(scolariteEleveTable.id, paiement.scolarite_id)).limit(1);
    if (!scol) { res.status(404).json({ message: "Scolarité non trouvée." }); return; }

    const montantNum = toNum(paiement.montant);
    const nouveauPaye = Math.max(0, toNum(scol.montant_total_paye) - montantNum);
    const nouveauRestant = toNum(scol.montant_total_du) - nouveauPaye;
    const nouveauStatut = calculerStatut(nouveauPaye, nouveauRestant);

    const trancheReset: Partial<typeof scolariteEleveTable.$inferInsert> = {};
    if (paiement.type_paiement === "inscription") trancheReset.inscription_payee = false;
    if (paiement.type_paiement === "tranche1") trancheReset.tranche1_payee = false;
    if (paiement.type_paiement === "tranche2") trancheReset.tranche2_payee = false;
    if (paiement.type_paiement === "tranche3") trancheReset.tranche3_payee = false;

    await db.update(paiementsScolariteTable).set({ annule: true, updated_at: new Date() }).where(eq(paiementsScolariteTable.id, id));
    const [updatedScol] = await db.update(scolariteEleveTable).set({
      montant_total_paye: String(nouveauPaye),
      montant_restant: String(nouveauRestant),
      statut: nouveauStatut,
      ...trancheReset,
      updated_at: new Date(),
    }).where(eq(scolariteEleveTable.id, scol.id)).returning();

    await notifierParent(paiement.eleve_id, paiement.etablissement_id, `Paiement N°${paiement.numero_recu} annulé. Nouveau restant : ${nouveauRestant.toLocaleString("fr-FR")} FCFA.`);

    res.json({ success: true, message: "Paiement annulé.", data: { scolarite: updatedScol } });
  },
);

/* GET /paiements/rapport-caisse */
router.get(
  "/paiements/rapport-caisse",
  authMiddleware, verifierLicence, requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { date_debut, date_fin } = req.query as Record<string, string>;
    const etablissementId = user.role === "dev" ? (req.query["etablissement_id"] as string) ?? user.etablissement_id : user.etablissement_id!;

    const conds = [eq(paiementsScolariteTable.etablissement_id, etablissementId!), eq(paiementsScolariteTable.annule, false)];
    if (date_debut) conds.push(gte(paiementsScolariteTable.date_paiement, date_debut));
    if (date_fin) conds.push(lte(paiementsScolariteTable.date_paiement, date_fin));

    const paiements = await db.select().from(paiementsScolariteTable).where(and(...conds)).orderBy(desc(paiementsScolariteTable.date_paiement));

    const total = paiements.reduce((s, p) => s + toNum(p.montant), 0);
    const parMode: Record<string, number> = {};
    const parType: Record<string, number> = {};
    for (const p of paiements) {
      parMode[p.mode_paiement] = (parMode[p.mode_paiement] ?? 0) + toNum(p.montant);
      parType[p.type_paiement] = (parType[p.type_paiement] ?? 0) + toNum(p.montant);
    }
    res.json({ success: true, data: { paiements, total, par_mode: parMode, par_type: parType, periode: { debut: date_debut, fin: date_fin } } });
  },
);

/* GET /paiements/liste */
router.get(
  "/paiements/liste",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { eleve_id, type_paiement, mode_paiement, date_debut, date_fin, page = "1", limit: lim = "20" } = req.query as Record<string, string>;
    const etablissementId = user.role === "dev" ? (req.query["etablissement_id"] as string) ?? user.etablissement_id : user.etablissement_id!;

    const conds = [eq(paiementsScolariteTable.etablissement_id, etablissementId!)];
    if (eleve_id) conds.push(eq(paiementsScolariteTable.eleve_id, eleve_id));
    if (type_paiement) conds.push(eq(paiementsScolariteTable.type_paiement, type_paiement as "inscription" | "tranche1" | "tranche2" | "tranche3" | "autre"));
    if (mode_paiement) conds.push(eq(paiementsScolariteTable.mode_paiement, mode_paiement as "especes" | "cheque" | "virement" | "mobile_money" | "autre"));
    if (date_debut) conds.push(gte(paiementsScolariteTable.date_paiement, date_debut));
    if (date_fin) conds.push(lte(paiementsScolariteTable.date_paiement, date_fin));

    const offset = (parseInt(page) - 1) * parseInt(lim);
    const paiements = await db.select().from(paiementsScolariteTable).where(and(...conds))
      .orderBy(desc(paiementsScolariteTable.date_paiement))
      .limit(parseInt(lim)).offset(offset);

    const enriched = await Promise.all(paiements.map(async (p) => {
      const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, matricule: elevesTable.matricule })
        .from(elevesTable).where(eq(elevesTable.id, p.eleve_id)).limit(1);
      const [enr] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, p.enregistre_par)).limit(1);
      return { ...p, eleve_nom: eleve?.nom, eleve_prenoms: eleve?.prenoms, eleve_matricule: eleve?.matricule, enregistre_par_nom: enr?.nom };
    }));

    res.json({ success: true, data: enriched, page: parseInt(page), limit: parseInt(lim) });
  },
);

/* GET /paiements/:id/recu */
router.get(
  "/paiements/:id/recu",
  authMiddleware, verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { id } = req.params as Record<string, string>;
    const [paiement] = await db.select().from(paiementsScolariteTable).where(eq(paiementsScolariteTable.id, id)).limit(1);
    if (!paiement) { res.status(404).json({ message: "Paiement non trouvé." }); return; }

    if (user.role === "parent") {
      const link = await db.select({ id: parentsElevesTable.id }).from(parentsElevesTable)
        .where(and(eq(parentsElevesTable.utilisateur_id, user.id), eq(parentsElevesTable.eleve_id, paiement.eleve_id))).limit(1);
      if (!link[0]) { res.status(403).json({ message: "Accès refusé." }); return; }
    }

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, paiement.eleve_id)).limit(1);
    const [scol] = await db.select().from(scolariteEleveTable).where(eq(scolariteEleveTable.id, paiement.scolarite_id)).limit(1);
    const [ec] = await db.select({ nom: classesTable.nom }).from(eleveClassesTable)
      .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
      .where(eq(eleveClassesTable.eleve_id, paiement.eleve_id))
      .orderBy(desc(eleveClassesTable.created_at)).limit(1);
    const [enr] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, paiement.enregistre_par)).limit(1);

    const TYPE_LABELS: Record<string, string> = {
      inscription: "Frais d'inscription", tranche1: "1ère tranche", tranche2: "2ème tranche",
      tranche3: "3ème tranche", autre: "Autre",
    };
    const MODE_LABELS: Record<string, string> = {
      especes: "Espèces", cheque: "Chèque", virement: "Virement bancaire", mobile_money: "Mobile Money", autre: "Autre",
    };

    const montantNum = toNum(paiement.montant);
    const totalDu = toNum(scol?.montant_total_du ?? "0");
    const totalPaye = toNum(scol?.montant_total_paye ?? "0");
    const restant = toNum(scol?.montant_restant ?? "0");

    res.json({
      success: true,
      data: {
        numero_recu: paiement.numero_recu,
        date_paiement: paiement.date_paiement,
        eleve: {
          nom: eleve?.nom, prenoms: eleve?.prenoms, matricule: eleve?.matricule,
          classe: ec?.nom ?? "—",
        },
        paiement: {
          type: TYPE_LABELS[paiement.type_paiement] ?? paiement.type_paiement,
          mode: MODE_LABELS[paiement.mode_paiement] ?? paiement.mode_paiement,
          montant: montantNum,
          reference: paiement.reference_paiement ?? null,
          observations: paiement.observations ?? null,
          annule: paiement.annule,
        },
        scolarite: { total_du: totalDu, total_paye: totalPaye, restant },
        enregistre_par: enr?.nom ?? "—",
      },
    });
  },
);

/* GET /paiements/:id */
router.get(
  "/paiements/:id",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const { id } = req.params as Record<string, string>;
    const [paiement] = await db.select().from(paiementsScolariteTable).where(eq(paiementsScolariteTable.id, id)).limit(1);
    if (!paiement) { res.status(404).json({ message: "Paiement non trouvé." }); return; }
    res.json({ success: true, data: paiement });
  },
);

/* POST /paiements/relancer */
router.post(
  "/paiements/relancer",
  authMiddleware, verifierLicence, requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { eleve_ids, type_relance, motif } = req.body as { eleve_ids: string[]; type_relance: string; motif?: string };
    if (!eleve_ids?.length || !type_relance) { res.status(400).json({ message: "eleve_ids et type_relance requis." }); return; }

    const etablissementId = user.etablissement_id ?? (req.body as Record<string, unknown>).etablissement_id as string;
    let envoyes = 0;
    const erreurs: string[] = [];

    for (const eleveId of eleve_ids) {
      try {
        const [scol] = await db.select().from(scolariteEleveTable)
          .where(and(eq(scolariteEleveTable.eleve_id, eleveId), eq(scolariteEleveTable.etablissement_id, etablissementId)))
          .orderBy(desc(scolariteEleveTable.created_at)).limit(1);
        if (!scol) continue;

        const [config] = await db.select().from(fraisConfigTable).where(eq(fraisConfigTable.id, scol.frais_config_id)).limit(1);

        const [{ count: nbPrecedentes }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(relancesScolariteTable)
          .where(eq(relancesScolariteTable.scolarite_id, scol.id));

        const baseCtx = await construireContexteRelance(eleveId, etablissementId, scol, config ?? null);
        const ctx: RelanceContext = { ...baseCtx, numeroRelance: niveauRelance(nbPrecedentes) };

        const titre = genererTitrePush(ctx);
        const msg = genererMessagePush(ctx) + (motif ? `\n\n${motif}` : "");

        if (type_relance === "notification" || type_relance === "les_deux") {
          await notifierParent(eleveId, etablissementId, msg, titre);
        }

        await db.insert(relancesScolariteTable).values({
          etablissement_id: etablissementId,
          eleve_id: eleveId,
          scolarite_id: scol.id,
          type_relance: type_relance as "notification" | "email" | "les_deux",
          motif: motif ?? null,
          envoye_par: user.id,
        });
        envoyes++;
      } catch (e) {
        erreurs.push(eleveId);
      }
    }
    res.json({ success: true, message: `${envoyes} relance(s) envoyée(s).`, data: { envoyes, erreurs } });
  },
);

/* POST /paiements/relancer-impayes */
router.post(
  "/paiements/relancer-impayes",
  authMiddleware, verifierLicence, requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { classe_id, annee_scolaire_id, type_relance, motif } = req.body as Record<string, string>;
    const etablissementId = user.etablissement_id ?? (req.body as Record<string, unknown>).etablissement_id as string;

    const eleveRows = await db.select({ id: eleveClassesTable.eleve_id }).from(eleveClassesTable).where(eq(eleveClassesTable.classe_id, classe_id));
    const eleveIds = eleveRows.map(r => r.id);
    if (eleveIds.length === 0) { res.json({ success: true, data: { envoyes: 0, erreurs: [] } }); return; }

    const conds = [
      inArray(scolariteEleveTable.eleve_id, eleveIds),
      or(eq(scolariteEleveTable.statut, "impaye"), eq(scolariteEleveTable.statut, "partiel")),
    ];
    if (annee_scolaire_id) conds.push(eq(scolariteEleveTable.annee_scolaire_id, annee_scolaire_id));

    const scolarites = await db.select().from(scolariteEleveTable).where(and(...conds));
    const idsToRelance = scolarites.map(s => s.eleve_id);

    let envoyes = 0;
    const erreurs: string[] = [];
    for (const eleveId of idsToRelance) {
      try {
        const scol = scolarites.find(s => s.eleve_id === eleveId)!;

        const [config] = await db.select().from(fraisConfigTable).where(eq(fraisConfigTable.id, scol.frais_config_id)).limit(1);

        const [{ count: nbPrecedentes }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(relancesScolariteTable)
          .where(eq(relancesScolariteTable.scolarite_id, scol.id));

        const baseCtx = await construireContexteRelance(eleveId, etablissementId, scol, config ?? null);
        const ctx: RelanceContext = { ...baseCtx, numeroRelance: niveauRelance(nbPrecedentes) };

        const titre = genererTitrePush(ctx);
        const msg = genererMessagePush(ctx) + (motif ? `\n\n${motif}` : "");

        if (type_relance === "notification" || type_relance === "les_deux") {
          await notifierParent(eleveId, etablissementId, msg, titre);
        }
        await db.insert(relancesScolariteTable).values({
          etablissement_id: etablissementId,
          eleve_id: eleveId,
          scolarite_id: scol.id,
          type_relance: type_relance as "notification" | "email" | "les_deux",
          motif: motif ?? null,
          envoye_par: user.id,
        });
        envoyes++;
      } catch { erreurs.push(eleveId); }
    }
    res.json({ success: true, message: `${envoyes} relance(s) envoyée(s).`, data: { envoyes, erreurs } });
  },
);

export default router;
