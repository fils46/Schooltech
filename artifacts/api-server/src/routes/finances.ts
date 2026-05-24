import { Router } from "express";
import { eq, and, sql } from "drizzle-orm";
import {
  db,
  feuillesHeuresTable,
  facturesPrestationsTable,
  utilisateursTable,
  contratsProfesseursTable,
  typesProfesseursTable,
  prestationsServicesTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();
const DIRS = ["dev", "directeur"] as const;

function toNum(v: string | null | undefined): number {
  return parseFloat(v ?? "0") || 0;
}

/* GET /api/finances/dashboard */
router.get(
  "/finances/dashboard",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const etablissementId = req.user!.etablissement_id;
    const { mois, annee } = req.query as Record<string, string>;

    const now = new Date();
    const m = mois ? parseInt(mois) : now.getMonth() + 1;
    const a = annee ? parseInt(annee) : now.getFullYear();

    const etabCondition = etablissementId
      ? eq(feuillesHeuresTable.etablissement_id, etablissementId)
      : sql`true`;
    const etabCondFact = etablissementId
      ? eq(facturesPrestationsTable.etablissement_id, etablissementId)
      : sql`true`;

    // Feuilles du mois
    const feuilles = await db
      .select({
        statut: feuillesHeuresTable.statut,
        montant_brut: feuillesHeuresTable.montant_brut,
        montant_net: feuillesHeuresTable.montant_net,
        prof_nom: utilisateursTable.nom,
        prof_prenoms: utilisateursTable.prenoms,
        type_libelle: typesProfesseursTable.libelle,
        nb_heures_validees: feuillesHeuresTable.nb_heures_validees,
      })
      .from(feuillesHeuresTable)
      .innerJoin(utilisateursTable, eq(feuillesHeuresTable.professeur_id, utilisateursTable.id))
      .innerJoin(contratsProfesseursTable, eq(feuillesHeuresTable.contrat_id, contratsProfesseursTable.id))
      .innerJoin(typesProfesseursTable, eq(contratsProfesseursTable.type_professeur_id, typesProfesseursTable.id))
      .where(
        and(
          etabCondition,
          eq(feuillesHeuresTable.mois, m),
          eq(feuillesHeuresTable.annee, a),
        ),
      );

    const honorairesAVerser = feuilles.filter(f => f.statut === "validee").reduce((s, f) => s + toNum(f.montant_net), 0);
    const honorairesVerses = feuilles.filter(f => f.statut === "payee").reduce((s, f) => s + toNum(f.montant_net), 0);
    const feuillesEnAttente = feuilles.filter(f => f.statut === "soumise").length;

    // Factures du mois
    const factures = await db
      .select({
        statut: facturesPrestationsTable.statut,
        montant: facturesPrestationsTable.montant,
      })
      .from(facturesPrestationsTable)
      .where(
        and(
          etabCondFact,
          sql`EXTRACT(MONTH FROM ${facturesPrestationsTable.date_emission}::date) = ${m}`,
          sql`EXTRACT(YEAR FROM ${facturesPrestationsTable.date_emission}::date) = ${a}`,
        ),
      );

    const prestationsEncaissees = factures.filter(f => f.statut === "paye").reduce((s, f) => s + toNum(f.montant), 0);
    const facturesEnAttente = factures.filter(f => f.statut === "en_attente").length;
    const montantImpayes = factures.filter(f => f.statut === "en_attente").reduce((s, f) => s + toNum(f.montant), 0);

    const balanceNette = prestationsEncaissees - honorairesVerses;

    res.json({
      success: true,
      data: {
        mois: m,
        annee: a,
        honoraires: {
          a_verser: honorairesAVerser,
          verses: honorairesVerses,
          en_attente_validation: feuillesEnAttente,
          lignes: feuilles,
        },
        prestations: {
          encaissees: prestationsEncaissees,
          factures_en_attente: facturesEnAttente,
          montant_impayes: montantImpayes,
        },
        balance: {
          recettes: prestationsEncaissees,
          charges: honorairesVerses,
          nette: balanceNette,
        },
      },
    });
  },
);

/* GET /api/finances/evolution */
router.get(
  "/finances/evolution",
  authMiddleware,
  verifierLicence,
  requireRole(...DIRS),
  async (req, res): Promise<void> => {
    const etablissementId = req.user!.etablissement_id;

    const now = new Date();
    const points: Array<{
      mois: number;
      annee: number;
      honoraires: number;
      prestations: number;
      balance: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = date.getMonth() + 1;
      const a = date.getFullYear();

      const etabFeuilles = etablissementId ? eq(feuillesHeuresTable.etablissement_id, etablissementId) : sql`true`;
      const etabFact = etablissementId ? eq(facturesPrestationsTable.etablissement_id, etablissementId) : sql`true`;

      const [fRes] = await db
        .select({ total: sql<string>`COALESCE(SUM(CASE WHEN statut = 'payee' THEN COALESCE(montant_net::numeric,0) ELSE 0 END),0)` })
        .from(feuillesHeuresTable)
        .where(and(etabFeuilles, eq(feuillesHeuresTable.mois, m), eq(feuillesHeuresTable.annee, a)));

      const [pRes] = await db
        .select({ total: sql<string>`COALESCE(SUM(CASE WHEN statut = 'paye' THEN COALESCE(montant::numeric,0) ELSE 0 END),0)` })
        .from(facturesPrestationsTable)
        .where(
          and(
            etabFact,
            sql`EXTRACT(MONTH FROM date_emission::date) = ${m}`,
            sql`EXTRACT(YEAR FROM date_emission::date) = ${a}`,
          ),
        );

      const honoraires = toNum(fRes?.total);
      const prestations = toNum(pRes?.total);

      points.push({ mois: m, annee: a, honoraires, prestations, balance: prestations - honoraires });
    }

    res.json({ success: true, data: points });
  },
);

export default router;
