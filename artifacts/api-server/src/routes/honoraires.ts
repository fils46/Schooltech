import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  typesProfesseursTable,
  contratsProfesseursTable,
  feuillesHeuresTable,
  utilisateursTable,
  anneesScolairesTable,
  notificationsTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { emitNotification } from "../socket/socketManager";

const router = Router();
const DIRS = ["dev", "directeur"] as const;
const ADMINS = ["dev", "directeur", "censeur"] as const;

function toNum(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

function getTauxForContrat(contrat: {
  taux_horaire_personnalise: string | null;
  taux: string | null;
}): number {
  return toNum(contrat.taux_horaire_personnalise ?? contrat.taux);
}

async function notifierUser(
  userId: string,
  titre: string,
  contenu: string,
  etablissementId: string,
): Promise<void> {
  try {
    const [notif] = await db.insert(notificationsTable).values({
      destinataire_id: userId,
      etablissement_id: etablissementId,
      titre,
      contenu,
      type: "message",
      lu: false,
    }).returning();
    if (notif) {
      await emitNotification(userId, {
        id: notif.id,
        titre: notif.titre,
        contenu: notif.contenu,
        type: notif.type,
        lien: notif.lien ?? undefined,
        created_at: notif.created_at,
      });
    }
  } catch (_) {
    // notifications non bloquantes
  }
}

/* ── Types de professeurs ────────────────────────────────────── */

/* GET /api/honoraires/types */
router.get(
  "/honoraires/types",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const etablissementId = req.user!.etablissement_id;
    const types = await db
      .select()
      .from(typesProfesseursTable)
      .where(
        etablissementId
          ? eq(typesProfesseursTable.etablissement_id, etablissementId)
          : sql`true`,
      )
      .orderBy(typesProfesseursTable.libelle);
    res.json({ success: true, data: types });
  },
);

/* POST /api/honoraires/types */
router.post(
  "/honoraires/types",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const { libelle, taux_horaire, description } = req.body;
    if (!libelle || taux_horaire === undefined) {
      res.status(400).json({ message: "libelle et taux_horaire requis." });
      return;
    }
    const etablissementId = req.user!.etablissement_id!;
    const [created] = await db
      .insert(typesProfesseursTable)
      .values({ etablissement_id: etablissementId, libelle, taux_horaire: String(taux_horaire), description })
      .returning();
    res.status(201).json({ success: true, message: "Type créé.", data: created });
  },
);

/* PUT /api/honoraires/types/:id */
router.put(
  "/honoraires/types/:id",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const id = req.params['id'] as string;
    const { libelle, taux_horaire, description, actif } = req.body;
    const [updated] = await db
      .update(typesProfesseursTable)
      .set({
        updated_at: new Date(),
        ...(libelle !== undefined ? { libelle } : {}),
        ...(taux_horaire !== undefined ? { taux_horaire: String(taux_horaire) } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(actif !== undefined ? { actif } : {}),
      })
      .where(eq(typesProfesseursTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Type non trouvé." });
      return;
    }
    res.json({ success: true, message: "Type mis à jour.", data: updated });
  },
);

/* ── Contrats ────────────────────────────────────────────────── */

/* GET /api/honoraires/contrats/mon-contrat */
router.get(
  "/honoraires/contrats/mon-contrat",
  authMiddleware,
  verifierLicence,
  requireRole("professeur"),
  async (req, res): Promise<void> => {
    const profId = req.user!.id;
    const [contrat] = await db
      .select({
        id: contratsProfesseursTable.id,
        professeur_id: contratsProfesseursTable.professeur_id,
        type_professeur_id: contratsProfesseursTable.type_professeur_id,
        annee_scolaire_id: contratsProfesseursTable.annee_scolaire_id,
        taux_horaire_personnalise: contratsProfesseursTable.taux_horaire_personnalise,
        nb_heures_contractuelles: contratsProfesseursTable.nb_heures_contractuelles,
        date_debut: contratsProfesseursTable.date_debut,
        date_fin: contratsProfesseursTable.date_fin,
        actif: contratsProfesseursTable.actif,
        notes: contratsProfesseursTable.notes,
        libelle: typesProfesseursTable.libelle,
        taux: typesProfesseursTable.taux_horaire,
      })
      .from(contratsProfesseursTable)
      .innerJoin(typesProfesseursTable, eq(contratsProfesseursTable.type_professeur_id, typesProfesseursTable.id))
      .where(and(eq(contratsProfesseursTable.professeur_id, profId), eq(contratsProfesseursTable.actif, true)))
      .orderBy(desc(contratsProfesseursTable.created_at))
      .limit(1);

    const feuilles = contrat
      ? await db
          .select()
          .from(feuillesHeuresTable)
          .where(eq(feuillesHeuresTable.professeur_id, profId))
          .orderBy(desc(feuillesHeuresTable.annee), desc(feuillesHeuresTable.mois))
      : [];

    res.json({ success: true, data: { contrat: contrat ?? null, feuilles } });
  },
);

/* GET /api/honoraires/contrats */
router.get(
  "/honoraires/contrats",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const etablissementId = req.user!.etablissement_id;
    const { annee_scolaire_id, type_professeur_id, actif } = req.query as Record<string, string>;

    const rows = await db
      .select({
        id: contratsProfesseursTable.id,
        professeur_id: contratsProfesseursTable.professeur_id,
        annee_scolaire_id: contratsProfesseursTable.annee_scolaire_id,
        taux_horaire_personnalise: contratsProfesseursTable.taux_horaire_personnalise,
        nb_heures_contractuelles: contratsProfesseursTable.nb_heures_contractuelles,
        date_debut: contratsProfesseursTable.date_debut,
        date_fin: contratsProfesseursTable.date_fin,
        actif: contratsProfesseursTable.actif,
        notes: contratsProfesseursTable.notes,
        prof_nom: utilisateursTable.nom,
        prof_prenoms: utilisateursTable.prenoms,
        type_libelle: typesProfesseursTable.libelle,
        taux: typesProfesseursTable.taux_horaire,
        type_professeur_id: contratsProfesseursTable.type_professeur_id,
      })
      .from(contratsProfesseursTable)
      .innerJoin(utilisateursTable, eq(contratsProfesseursTable.professeur_id, utilisateursTable.id))
      .innerJoin(typesProfesseursTable, eq(contratsProfesseursTable.type_professeur_id, typesProfesseursTable.id))
      .where(
        and(
          etablissementId ? eq(contratsProfesseursTable.etablissement_id, etablissementId) : sql`true`,
          annee_scolaire_id ? eq(contratsProfesseursTable.annee_scolaire_id, annee_scolaire_id) : sql`true`,
          type_professeur_id ? eq(contratsProfesseursTable.type_professeur_id, type_professeur_id) : sql`true`,
          actif !== undefined ? eq(contratsProfesseursTable.actif, actif === "true") : sql`true`,
        ),
      )
      .orderBy(desc(contratsProfesseursTable.created_at));

    res.json({ success: true, data: rows });
  },
);

/* POST /api/honoraires/contrats */
router.post(
  "/honoraires/contrats",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const {
      professeur_id, type_professeur_id, annee_scolaire_id,
      taux_horaire_personnalise, nb_heures_contractuelles,
      date_debut, date_fin, notes,
    } = req.body;

    if (!professeur_id || !type_professeur_id || !annee_scolaire_id || !date_debut) {
      res.status(400).json({ message: "Champs requis manquants." });
      return;
    }

    const etablissementId = req.user!.etablissement_id!;

    const [created] = await db
      .insert(contratsProfesseursTable)
      .values({
        etablissement_id: etablissementId,
        professeur_id,
        type_professeur_id,
        annee_scolaire_id,
        taux_horaire_personnalise: taux_horaire_personnalise ? String(taux_horaire_personnalise) : null,
        nb_heures_contractuelles: nb_heures_contractuelles ? String(nb_heures_contractuelles) : null,
        date_debut,
        date_fin: date_fin ?? null,
        notes: notes ?? null,
      })
      .returning();

    await notifierUser(
      professeur_id,
      "Contrat d'honoraires assigné",
      "Un contrat d'honoraires vous a été attribué. Consultez vos honoraires pour les détails.",
      etablissementId,
    );

    res.status(201).json({ success: true, message: "Contrat créé.", data: created });
  },
);

/* ── Feuilles d'heures ───────────────────────────────────────── */

/* GET /api/honoraires/feuilles/mes-feuilles */
router.get(
  "/honoraires/feuilles/mes-feuilles",
  authMiddleware,
  verifierLicence,
  requireRole("professeur"),
  async (req, res): Promise<void> => {
    const profId = req.user!.id;
    const feuilles = await db
      .select()
      .from(feuillesHeuresTable)
      .where(eq(feuillesHeuresTable.professeur_id, profId))
      .orderBy(desc(feuillesHeuresTable.annee), desc(feuillesHeuresTable.mois));
    res.json({ success: true, data: feuilles });
  },
);

/* GET /api/honoraires/feuilles */
router.get(
  "/honoraires/feuilles",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const etablissementId = req.user!.etablissement_id;
    const { professeur_id, mois, annee, annee_scolaire_id, statut } = req.query as Record<string, string>;

    const rows = await db
      .select({
        id: feuillesHeuresTable.id,
        professeur_id: feuillesHeuresTable.professeur_id,
        contrat_id: feuillesHeuresTable.contrat_id,
        annee_scolaire_id: feuillesHeuresTable.annee_scolaire_id,
        mois: feuillesHeuresTable.mois,
        annee: feuillesHeuresTable.annee,
        nb_heures_effectuees: feuillesHeuresTable.nb_heures_effectuees,
        nb_heures_validees: feuillesHeuresTable.nb_heures_validees,
        montant_brut: feuillesHeuresTable.montant_brut,
        montant_net: feuillesHeuresTable.montant_net,
        statut: feuillesHeuresTable.statut,
        date_soumission: feuillesHeuresTable.date_soumission,
        date_validation: feuillesHeuresTable.date_validation,
        date_paiement: feuillesHeuresTable.date_paiement,
        mode_paiement: feuillesHeuresTable.mode_paiement,
        reference_paiement: feuillesHeuresTable.reference_paiement,
        notes_professeur: feuillesHeuresTable.notes_professeur,
        notes_admin: feuillesHeuresTable.notes_admin,
        prof_nom: utilisateursTable.nom,
        prof_prenoms: utilisateursTable.prenoms,
      })
      .from(feuillesHeuresTable)
      .innerJoin(utilisateursTable, eq(feuillesHeuresTable.professeur_id, utilisateursTable.id))
      .where(
        and(
          etablissementId ? eq(feuillesHeuresTable.etablissement_id, etablissementId) : sql`true`,
          professeur_id ? eq(feuillesHeuresTable.professeur_id, professeur_id) : sql`true`,
          mois ? eq(feuillesHeuresTable.mois, parseInt(mois)) : sql`true`,
          annee ? eq(feuillesHeuresTable.annee, parseInt(annee)) : sql`true`,
          annee_scolaire_id ? eq(feuillesHeuresTable.annee_scolaire_id, annee_scolaire_id) : sql`true`,
          statut ? eq(feuillesHeuresTable.statut, statut as "brouillon" | "soumise" | "validee" | "payee" | "rejetee") : sql`true`,
        ),
      )
      .orderBy(desc(feuillesHeuresTable.annee), desc(feuillesHeuresTable.mois));

    res.json({ success: true, data: rows });
  },
);

/* POST /api/honoraires/feuilles */
router.post(
  "/honoraires/feuilles",
  authMiddleware,
  verifierLicence,
  requireRole("professeur"),
  async (req, res): Promise<void> => {
    const { mois, annee, nb_heures_effectuees, notes_professeur } = req.body;
    if (!mois || !annee || nb_heures_effectuees === undefined) {
      res.status(400).json({ message: "mois, annee et nb_heures_effectuees requis." });
      return;
    }

    const profId = req.user!.id;
    const etablissementId = req.user!.etablissement_id!;

    // Récupérer le contrat actif
    const [contrat] = await db
      .select({
        id: contratsProfesseursTable.id,
        annee_scolaire_id: contratsProfesseursTable.annee_scolaire_id,
        taux_horaire_personnalise: contratsProfesseursTable.taux_horaire_personnalise,
        taux: typesProfesseursTable.taux_horaire,
      })
      .from(contratsProfesseursTable)
      .innerJoin(typesProfesseursTable, eq(contratsProfesseursTable.type_professeur_id, typesProfesseursTable.id))
      .where(and(eq(contratsProfesseursTable.professeur_id, profId), eq(contratsProfesseursTable.actif, true)))
      .limit(1);

    if (!contrat) {
      res.status(400).json({ message: "Aucun contrat actif trouvé pour ce professeur." });
      return;
    }

    const taux = getTauxForContrat(contrat);
    const heures = toNum(String(nb_heures_effectuees));
    const montantBrut = heures * taux;

    const [feuille] = await db
      .insert(feuillesHeuresTable)
      .values({
        etablissement_id: etablissementId,
        professeur_id: profId,
        contrat_id: contrat.id,
        annee_scolaire_id: contrat.annee_scolaire_id,
        mois: parseInt(String(mois)),
        annee: parseInt(String(annee)),
        nb_heures_effectuees: String(nb_heures_effectuees),
        montant_brut: String(montantBrut),
        statut: "soumise",
        date_soumission: new Date().toISOString().split("T")[0],
        notes_professeur: notes_professeur ?? null,
      })
      .returning();

    // Notifier les admins de l'établissement
    const admins = await db
      .select({ id: utilisateursTable.id })
      .from(utilisateursTable)
      .where(
        and(
          eq(utilisateursTable.etablissement_id, etablissementId),
          sql`role IN ('directeur','censeur')`,
        ),
      );

    const profUser = await db.select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
      .from(utilisateursTable).where(eq(utilisateursTable.id, profId)).limit(1);

    const profNom = profUser[0] ? `${profUser[0].prenoms ?? ""} ${profUser[0].nom}` : "Un professeur";
    for (const admin of admins) {
      await notifierUser(
        admin.id,
        "Feuille d'heures soumise",
        `${profNom} a soumis sa feuille d'heures pour ${mois}/${annee}. Montant brut estimé : ${montantBrut.toLocaleString("fr-CI")} FCFA.`,
        etablissementId,
      );
    }

    res.status(201).json({ success: true, message: "Feuille soumise.", data: feuille });
  },
);

/* PUT /api/honoraires/feuilles/:id/valider */
router.put(
  "/honoraires/feuilles/:id/valider",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const id = req.params['id'] as string;
    const { nb_heures_validees, montant_net, notes_admin } = req.body;

    if (nb_heures_validees === undefined) {
      res.status(400).json({ message: "nb_heures_validees requis." });
      return;
    }

    const [feuille] = await db
      .select({
        id: feuillesHeuresTable.id,
        professeur_id: feuillesHeuresTable.professeur_id,
        etablissement_id: feuillesHeuresTable.etablissement_id,
        contrat_id: feuillesHeuresTable.contrat_id,
      })
      .from(feuillesHeuresTable)
      .where(eq(feuillesHeuresTable.id, id))
      .limit(1);

    if (!feuille) {
      res.status(404).json({ message: "Feuille non trouvée." });
      return;
    }

    const [contrat] = await db
      .select({
        taux_horaire_personnalise: contratsProfesseursTable.taux_horaire_personnalise,
        taux: typesProfesseursTable.taux_horaire,
      })
      .from(contratsProfesseursTable)
      .innerJoin(typesProfesseursTable, eq(contratsProfesseursTable.type_professeur_id, typesProfesseursTable.id))
      .where(eq(contratsProfesseursTable.id, feuille.contrat_id))
      .limit(1);

    const taux = contrat ? getTauxForContrat(contrat) : 0;
    const heures = toNum(String(nb_heures_validees));
    const montantBrut = heures * taux;

    const [updated] = await db
      .update(feuillesHeuresTable)
      .set({
        nb_heures_validees: String(nb_heures_validees),
        montant_brut: String(montantBrut),
        montant_net: montant_net ? String(montant_net) : String(montantBrut),
        statut: "validee",
        date_validation: new Date().toISOString().split("T")[0],
        valide_par: req.user!.id,
        notes_admin: notes_admin ?? null,
        updated_at: new Date(),
      })
      .where(eq(feuillesHeuresTable.id, id))
      .returning();

    const net = toNum(updated?.montant_net ?? null);
    await notifierUser(
      feuille.professeur_id,
      "Feuille d'heures validée",
      `Votre feuille d'heures a été validée. Montant net : ${net.toLocaleString("fr-CI")} FCFA.`,
      feuille.etablissement_id,
    );

    res.json({ success: true, message: "Feuille validée.", data: updated });
  },
);

/* PUT /api/honoraires/feuilles/:id/rejeter */
router.put(
  "/honoraires/feuilles/:id/rejeter",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const id = req.params['id'] as string;
    const { notes_admin } = req.body;

    if (!notes_admin) {
      res.status(400).json({ message: "Le motif de rejet (notes_admin) est requis." });
      return;
    }

    const [feuille] = await db
      .select({ professeur_id: feuillesHeuresTable.professeur_id, etablissement_id: feuillesHeuresTable.etablissement_id })
      .from(feuillesHeuresTable)
      .where(eq(feuillesHeuresTable.id, id))
      .limit(1);

    if (!feuille) {
      res.status(404).json({ message: "Feuille non trouvée." });
      return;
    }

    const [updated] = await db
      .update(feuillesHeuresTable)
      .set({ statut: "rejetee", notes_admin, updated_at: new Date() })
      .where(eq(feuillesHeuresTable.id, id))
      .returning();

    await notifierUser(
      feuille.professeur_id,
      "Feuille d'heures rejetée",
      `Votre feuille d'heures a été rejetée. Motif : ${notes_admin}`,
      feuille.etablissement_id,
    );

    res.json({ success: true, message: "Feuille rejetée.", data: updated });
  },
);

/* PUT /api/honoraires/feuilles/:id/payer */
router.put(
  "/honoraires/feuilles/:id/payer",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const id = req.params['id'] as string;
    const { date_paiement, mode_paiement, reference_paiement } = req.body;

    if (!date_paiement || !mode_paiement) {
      res.status(400).json({ message: "date_paiement et mode_paiement requis." });
      return;
    }

    const [feuille] = await db
      .select({
        professeur_id: feuillesHeuresTable.professeur_id,
        etablissement_id: feuillesHeuresTable.etablissement_id,
        montant_net: feuillesHeuresTable.montant_net,
      })
      .from(feuillesHeuresTable)
      .where(eq(feuillesHeuresTable.id, id))
      .limit(1);

    if (!feuille) {
      res.status(404).json({ message: "Feuille non trouvée." });
      return;
    }

    const [updated] = await db
      .update(feuillesHeuresTable)
      .set({
        statut: "payee",
        date_paiement,
        mode_paiement: mode_paiement as "virement" | "mobile_money" | "especes" | "cheque",
        reference_paiement: reference_paiement ?? null,
        updated_at: new Date(),
      })
      .where(eq(feuillesHeuresTable.id, id))
      .returning();

    const net = toNum(feuille.montant_net ?? null);
    await notifierUser(
      feuille.professeur_id,
      "Honoraires payés",
      `Vos honoraires de ${net.toLocaleString("fr-CI")} FCFA ont été versés. Référence : ${reference_paiement ?? "—"}.`,
      feuille.etablissement_id,
    );

    res.json({ success: true, message: "Paiement enregistré.", data: updated });
  },
);

/* GET /api/honoraires/recap */
router.get(
  "/honoraires/recap",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const etablissementId = req.user!.etablissement_id;
    const { mois, annee, annee_scolaire_id } = req.query as Record<string, string>;

    const rows = await db
      .select({
        prof_nom: utilisateursTable.nom,
        prof_prenoms: utilisateursTable.prenoms,
        type_libelle: typesProfesseursTable.libelle,
        nb_heures_validees: feuillesHeuresTable.nb_heures_validees,
        montant_brut: feuillesHeuresTable.montant_brut,
        montant_net: feuillesHeuresTable.montant_net,
        statut: feuillesHeuresTable.statut,
        mois: feuillesHeuresTable.mois,
        annee: feuillesHeuresTable.annee,
      })
      .from(feuillesHeuresTable)
      .innerJoin(utilisateursTable, eq(feuillesHeuresTable.professeur_id, utilisateursTable.id))
      .innerJoin(contratsProfesseursTable, eq(feuillesHeuresTable.contrat_id, contratsProfesseursTable.id))
      .innerJoin(typesProfesseursTable, eq(contratsProfesseursTable.type_professeur_id, typesProfesseursTable.id))
      .where(
        and(
          etablissementId ? eq(feuillesHeuresTable.etablissement_id, etablissementId) : sql`true`,
          mois ? eq(feuillesHeuresTable.mois, parseInt(mois)) : sql`true`,
          annee ? eq(feuillesHeuresTable.annee, parseInt(annee)) : sql`true`,
          annee_scolaire_id ? eq(feuillesHeuresTable.annee_scolaire_id, annee_scolaire_id) : sql`true`,
        ),
      )
      .orderBy(utilisateursTable.nom);

    const totalAVerser = rows
      .filter(r => r.statut === "validee")
      .reduce((s, r) => s + toNum(r.montant_net), 0);
    const totalVerse = rows
      .filter(r => r.statut === "payee")
      .reduce((s, r) => s + toNum(r.montant_net), 0);

    res.json({
      success: true,
      data: {
        lignes: rows,
        total_a_verser: totalAVerser,
        total_verse: totalVerse,
        restant: totalAVerser,
      },
    });
  },
);

export default router;
