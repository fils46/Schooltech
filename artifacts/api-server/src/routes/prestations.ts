import { Router } from "express";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  db,
  prestationsServicesTable,
  facturesPrestationsTable,
  elevesTable,
  utilisateursTable,
  eleveClassesTable,
  classesTable,
  parentsElevesTable,
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

/* ── Types de prestations ────────────────────────────────────── */

/* GET /api/prestations/types */
router.get(
  "/prestations/types",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const etablissementId = req.user!.etablissement_id;
    const { categorie, actif } = req.query as Record<string, string>;

    const rows = await db
      .select()
      .from(prestationsServicesTable)
      .where(
        and(
          etablissementId ? eq(prestationsServicesTable.etablissement_id, etablissementId) : sql`true`,
          categorie ? eq(prestationsServicesTable.categorie, categorie as "sortie" | "document" | "club" | "autre") : sql`true`,
          actif !== undefined ? eq(prestationsServicesTable.actif, actif === "true") : sql`true`,
        ),
      )
      .orderBy(prestationsServicesTable.libelle);

    res.json({ success: true, data: rows });
  },
);

/* POST /api/prestations/types */
router.post(
  "/prestations/types",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const { libelle, categorie, montant, description } = req.body;
    if (!libelle || !categorie || montant === undefined) {
      res.status(400).json({ message: "libelle, categorie et montant requis." });
      return;
    }
    const etablissementId = req.user!.etablissement_id!;
    const [created] = await db
      .insert(prestationsServicesTable)
      .values({ etablissement_id: etablissementId, libelle, categorie, montant: String(montant), description })
      .returning();
    res.status(201).json({ success: true, message: "Prestation créée.", data: created });
  },
);

/* PUT /api/prestations/types/:id */
router.put(
  "/prestations/types/:id",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const id = req.params['id'] as string;
    const { libelle, categorie, montant, description, actif } = req.body;
    const [updated] = await db
      .update(prestationsServicesTable)
      .set({
        updated_at: new Date(),
        ...(libelle !== undefined ? { libelle } : {}),
        ...(categorie !== undefined ? { categorie } : {}),
        ...(montant !== undefined ? { montant: String(montant) } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(actif !== undefined ? { actif } : {}),
      })
      .where(eq(prestationsServicesTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Prestation non trouvée." });
      return;
    }
    res.json({ success: true, message: "Prestation mise à jour.", data: updated });
  },
);

/* ── Factures ────────────────────────────────────────────────── */

/* GET /api/prestations/factures/eleve/:eleveId */
router.get(
  "/prestations/factures/eleve/:eleveId",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "parent"),
  async (req, res): Promise<void> => {
    const eleveId = req.params['eleveId'] as string;

    // Vérification parent : peut voir uniquement ses enfants
    if (req.user!.role === "parent") {
      const [lien] = await db
        .select({ id: parentsElevesTable.id })
        .from(parentsElevesTable)
        .where(and(eq(parentsElevesTable.utilisateur_id, req.user!.id), eq(parentsElevesTable.eleve_id, eleveId)))
        .limit(1);
      if (!lien) {
        res.status(403).json({ message: "Accès non autorisé." });
        return;
      }
    }

    const factures = await db
      .select({
        id: facturesPrestationsTable.id,
        montant: facturesPrestationsTable.montant,
        statut: facturesPrestationsTable.statut,
        date_emission: facturesPrestationsTable.date_emission,
        date_paiement: facturesPrestationsTable.date_paiement,
        mode_paiement: facturesPrestationsTable.mode_paiement,
        reference_paiement: facturesPrestationsTable.reference_paiement,
        note: facturesPrestationsTable.note,
        libelle: prestationsServicesTable.libelle,
        categorie: prestationsServicesTable.categorie,
      })
      .from(facturesPrestationsTable)
      .innerJoin(prestationsServicesTable, eq(facturesPrestationsTable.prestation_id, prestationsServicesTable.id))
      .where(eq(facturesPrestationsTable.eleve_id, eleveId))
      .orderBy(desc(facturesPrestationsTable.date_emission));

    const totalPaye = factures.filter(f => f.statut === "paye").reduce((s, f) => s + toNum(f.montant), 0);
    const totalEnAttente = factures.filter(f => f.statut === "en_attente").reduce((s, f) => s + toNum(f.montant), 0);

    res.json({ success: true, data: { factures, total_paye: totalPaye, total_en_attente: totalEnAttente } });
  },
);

/* GET /api/prestations/factures */
router.get(
  "/prestations/factures",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const etablissementId = req.user!.etablissement_id;
    const { eleve_id, prestation_id, statut, categorie, date_debut, date_fin } = req.query as Record<string, string>;

    const rows = await db
      .select({
        id: facturesPrestationsTable.id,
        eleve_id: facturesPrestationsTable.eleve_id,
        prestation_id: facturesPrestationsTable.prestation_id,
        annee_scolaire_id: facturesPrestationsTable.annee_scolaire_id,
        montant: facturesPrestationsTable.montant,
        statut: facturesPrestationsTable.statut,
        date_emission: facturesPrestationsTable.date_emission,
        date_paiement: facturesPrestationsTable.date_paiement,
        mode_paiement: facturesPrestationsTable.mode_paiement,
        reference_paiement: facturesPrestationsTable.reference_paiement,
        note: facturesPrestationsTable.note,
        eleve_nom: elevesTable.nom,
        eleve_prenoms: elevesTable.prenoms,
        prestation_libelle: prestationsServicesTable.libelle,
        prestation_categorie: prestationsServicesTable.categorie,
      })
      .from(facturesPrestationsTable)
      .innerJoin(elevesTable, eq(facturesPrestationsTable.eleve_id, elevesTable.id))
      .innerJoin(prestationsServicesTable, eq(facturesPrestationsTable.prestation_id, prestationsServicesTable.id))
      .where(
        and(
          etablissementId ? eq(facturesPrestationsTable.etablissement_id, etablissementId) : sql`true`,
          eleve_id ? eq(facturesPrestationsTable.eleve_id, eleve_id) : sql`true`,
          prestation_id ? eq(facturesPrestationsTable.prestation_id, prestation_id) : sql`true`,
          statut ? eq(facturesPrestationsTable.statut, statut as "en_attente" | "paye" | "annule") : sql`true`,
          categorie ? eq(prestationsServicesTable.categorie, categorie as "sortie" | "document" | "club" | "autre") : sql`true`,
          date_debut ? sql`${facturesPrestationsTable.date_emission} >= ${date_debut}` : sql`true`,
          date_fin ? sql`${facturesPrestationsTable.date_emission} <= ${date_fin}` : sql`true`,
        ),
      )
      .orderBy(desc(facturesPrestationsTable.date_emission));

    res.json({ success: true, data: rows });
  },
);

/* POST /api/prestations/factures */
router.post(
  "/prestations/factures",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const { prestation_id, eleve_id, annee_scolaire_id, note } = req.body;
    if (!prestation_id || !eleve_id || !annee_scolaire_id) {
      res.status(400).json({ message: "prestation_id, eleve_id et annee_scolaire_id requis." });
      return;
    }

    const etablissementId = req.user!.etablissement_id!;

    const [prestation] = await db
      .select()
      .from(prestationsServicesTable)
      .where(and(eq(prestationsServicesTable.id, prestation_id), eq(prestationsServicesTable.actif, true)))
      .limit(1);

    if (!prestation) {
      res.status(404).json({ message: "Prestation non trouvée ou inactive." });
      return;
    }

    const [facture] = await db
      .insert(facturesPrestationsTable)
      .values({
        etablissement_id: etablissementId,
        prestation_id,
        eleve_id,
        annee_scolaire_id,
        montant: prestation.montant,
        statut: "en_attente",
        date_emission: new Date().toISOString().split("T")[0],
        note: note ?? null,
        enregistre_par: req.user!.id,
      })
      .returning();

    // Notifier les parents de l'élève
    const parents = await db
      .select({ parent_id: parentsElevesTable.utilisateur_id })
      .from(parentsElevesTable)
      .where(eq(parentsElevesTable.eleve_id, eleve_id));

    const eleve = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
      .from(elevesTable).where(eq(elevesTable.id, eleve_id)).limit(1);
    const eleveNom = eleve[0] ? `${eleve[0].prenoms ?? ""} ${eleve[0].nom}` : "votre enfant";

    for (const p of parents) {
      await notifierUser(
        p.parent_id,
        "Nouvelle facture",
        `Une facture de ${toNum(prestation.montant).toLocaleString("fr-CI")} FCFA a été émise pour ${eleveNom} — ${prestation.libelle}.`,
        etablissementId,
      );
    }

    res.status(201).json({ success: true, message: "Facture émise.", data: facture });
  },
);

/* PUT /api/prestations/factures/:id/payer */
router.put(
  "/prestations/factures/:id/payer",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const id = req.params['id'] as string;
    const { date_paiement, mode_paiement, reference_paiement } = req.body;

    if (!date_paiement || !mode_paiement) {
      res.status(400).json({ message: "date_paiement et mode_paiement requis." });
      return;
    }

    const [facture] = await db
      .select({
        eleve_id: facturesPrestationsTable.eleve_id,
        etablissement_id: facturesPrestationsTable.etablissement_id,
        montant: facturesPrestationsTable.montant,
        prestation_id: facturesPrestationsTable.prestation_id,
      })
      .from(facturesPrestationsTable)
      .where(eq(facturesPrestationsTable.id, id))
      .limit(1);

    if (!facture) {
      res.status(404).json({ message: "Facture non trouvée." });
      return;
    }

    const [updated] = await db
      .update(facturesPrestationsTable)
      .set({
        statut: "paye",
        date_paiement,
        mode_paiement: mode_paiement as "especes" | "mobile_money" | "virement" | "cheque",
        reference_paiement: reference_paiement ?? null,
        updated_at: new Date(),
      })
      .where(eq(facturesPrestationsTable.id, id))
      .returning();

    const parents = await db
      .select({ parent_id: parentsElevesTable.utilisateur_id })
      .from(parentsElevesTable)
      .where(eq(parentsElevesTable.eleve_id, facture.eleve_id));

    const [presta] = await db.select({ libelle: prestationsServicesTable.libelle })
      .from(prestationsServicesTable).where(eq(prestationsServicesTable.id, facture.prestation_id)).limit(1);

    for (const p of parents) {
      await notifierUser(
        p.parent_id,
        "Paiement confirmé",
        `Le paiement de ${toNum(facture.montant).toLocaleString("fr-CI")} FCFA pour « ${presta?.libelle ?? "prestation"} » a été enregistré.`,
        facture.etablissement_id,
      );
    }

    res.json({ success: true, message: "Paiement enregistré.", data: updated });
  },
);

/* PUT /api/prestations/factures/:id/annuler */
router.put(
  "/prestations/factures/:id/annuler",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const id = req.params['id'] as string;
    const [updated] = await db
      .update(facturesPrestationsTable)
      .set({ statut: "annule", updated_at: new Date() })
      .where(eq(facturesPrestationsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Facture non trouvée." });
      return;
    }
    res.json({ success: true, message: "Facture annulée.", data: updated });
  },
);

/* GET /api/prestations/recap */
router.get(
  "/prestations/recap",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const etablissementId = req.user!.etablissement_id;
    const { mois, annee, annee_scolaire_id } = req.query as Record<string, string>;

    const rows = await db
      .select({
        categorie: prestationsServicesTable.categorie,
        libelle: prestationsServicesTable.libelle,
        montant: facturesPrestationsTable.montant,
        statut: facturesPrestationsTable.statut,
        date_emission: facturesPrestationsTable.date_emission,
      })
      .from(facturesPrestationsTable)
      .innerJoin(prestationsServicesTable, eq(facturesPrestationsTable.prestation_id, prestationsServicesTable.id))
      .where(
        and(
          etablissementId ? eq(facturesPrestationsTable.etablissement_id, etablissementId) : sql`true`,
          mois && annee
            ? sql`EXTRACT(MONTH FROM ${facturesPrestationsTable.date_emission}::date) = ${parseInt(mois)} AND EXTRACT(YEAR FROM ${facturesPrestationsTable.date_emission}::date) = ${parseInt(annee)}`
            : sql`true`,
          annee_scolaire_id ? eq(facturesPrestationsTable.annee_scolaire_id, annee_scolaire_id) : sql`true`,
        ),
      );

    const categories = ["sortie", "document", "club", "autre"] as const;
    const recap = categories.map(cat => {
      const lignes = rows.filter(r => r.categorie === cat);
      return {
        categorie: cat,
        nb_factures: lignes.length,
        montant_paye: lignes.filter(l => l.statut === "paye").reduce((s, l) => s + toNum(l.montant), 0),
        montant_en_attente: lignes.filter(l => l.statut === "en_attente").reduce((s, l) => s + toNum(l.montant), 0),
        montant_total: lignes.filter(l => l.statut !== "annule").reduce((s, l) => s + toNum(l.montant), 0),
      };
    });

    const totalEncaisse = rows.filter(r => r.statut === "paye").reduce((s, r) => s + toNum(r.montant), 0);

    res.json({ success: true, data: { recap, total_encaisse: totalEncaisse } });
  },
);

export default router;
