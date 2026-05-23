import { Router } from "express";
import { eq, and, desc, count, avg, sql, gte, lte, lt, inArray, isNull } from "drizzle-orm";
import {
  db,
  utilisateursTable,
  elevesTable,
  eleveClassesTable,
  classesTable,
  anneesScolairesTable,
  notesTable,
  absencesTable,
  messagesTable,
  professeurClassesTable,
  ressourcesTable,
  ressourceHistoriqueTable,
  consultationsInfirmerieTable,
  stocksInfirmerieTable,
  clubsTable,
  clubMembresTable,
  activitesClubTable,
  distinctionsClubTable,
  rapportsGeneresTable,
  snapshotsAnalyticsTable,
  appelsTable,
  appelDetailsTable,
  cahierTextesTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();
const ADMINS = ["dev", "directeur", "censeur"];

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0]! : v;
}

/* ── Helpers ──────────────────────────────────────────────── */

async function getActiveAnnee(etablissementId: string): Promise<string | null> {
  const [a] = await db
    .select({ id: anneesScolairesTable.id })
    .from(anneesScolairesTable)
    .where(and(
      eq(anneesScolairesTable.etablissement_id, etablissementId),
      eq(anneesScolairesTable.est_active, true),
    ))
    .limit(1);
  return a?.id ?? null;
}

/* ── 1. KPIs établissement ──────────────────────────────────── */

router.get(
  "/analytics/kpis",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;

    const anneeId = (req.query.annee_scolaire_id as string) || await getActiveAnnee(etabId);
    const trimestre = req.query.trimestre ? String(req.query.trimestre) : null;

    // Effectifs
    const [totalElevesRow] = await db
      .select({ count: count() })
      .from(eleveClassesTable)
      .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
      .where(and(
        eq(classesTable.etablissement_id, etabId),
        anneeId ? eq(eleveClassesTable.annee_scolaire_id, anneeId) : sql`true`,
        eq(eleveClassesTable.statut, "actif"),
      ));

    // Absences non justifiées
    const absConditions: Parameters<typeof and>[0][] = [
      eq(absencesTable.etablissement_id, etabId),
      eq(absencesTable.statut, "non_justifiee"),
    ];
    if (anneeId) absConditions.push(eq(absencesTable.annee_scolaire_id, anneeId));

    const [absNonJustifRow] = await db
      .select({ count: count() })
      .from(absencesTable)
      .where(and(...absConditions));

    // Total absences trimestre
    const absAllConditions: Parameters<typeof and>[0][] = [
      eq(absencesTable.etablissement_id, etabId),
    ];
    if (anneeId) absAllConditions.push(eq(absencesTable.annee_scolaire_id, anneeId));

    const [totalAbsRow] = await db
      .select({ count: count() })
      .from(absencesTable)
      .where(and(...absAllConditions));

    // Moyenne générale
    const notesConditions: Parameters<typeof and>[0][] = [
      eq(notesTable.etablissement_id, etabId),
    ];
    if (anneeId) notesConditions.push(eq(notesTable.annee_scolaire_id, anneeId));
    if (trimestre) notesConditions.push(sql`${notesTable.trimestre}::text = ${trimestre}`);

    const [moyenneRow] = await db
      .select({ moyenne: avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`) })
      .from(notesTable)
      .where(and(...notesConditions));

    // Taux de réussite (note/note_sur * 20 >= 10)
    const [totalNotesRow] = await db
      .select({ count: count() })
      .from(notesTable)
      .where(and(...notesConditions));

    const [notesReussiesRow] = await db
      .select({ count: count() })
      .from(notesTable)
      .where(and(
        ...notesConditions,
        sql`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20 >= 10`,
      ));

    // Messages non lus pour cet utilisateur
    const [messagesNonLusRow] = await db
      .select({ count: count() })
      .from(messagesTable)
      .where(and(
        eq(messagesTable.destinataire_id, user.id),
        eq(messagesTable.lu, false),
      ));

    // Stocks critiques
    const [stocksCritiquesRow] = await db
      .select({ count: count() })
      .from(stocksInfirmerieTable)
      .where(and(
        eq(stocksInfirmerieTable.etablissement_id, etabId),
        sql`${stocksInfirmerieTable.quantite} <= ${stocksInfirmerieTable.seuil_alerte}`,
      ));

    // Répartition par genre (from eleves)
    const repartitionGenre = await db
      .select({ sexe: elevesTable.sexe, count: count() })
      .from(elevesTable)
      .innerJoin(eleveClassesTable, eq(eleveClassesTable.eleve_id, elevesTable.id))
      .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
      .where(and(
        eq(classesTable.etablissement_id, etabId),
        anneeId ? eq(eleveClassesTable.annee_scolaire_id, anneeId) : sql`true`,
        eq(eleveClassesTable.statut, "actif"),
      ))
      .groupBy(elevesTable.sexe);

    const totalEleves = Number(totalElevesRow?.count ?? 0);
    const totalNotes = Number(totalNotesRow?.count ?? 0);

    res.json({
      success: true,
      data: {
        effectifs: {
          total_eleves: totalEleves,
          repartition_genre: repartitionGenre.map(r => ({
            sexe: r.sexe,
            count: Number(r.count),
          })),
        },
        presences: {
          absences_non_justifiees: Number(absNonJustifRow?.count ?? 0),
          total_absences_trimestre: Number(totalAbsRow?.count ?? 0),
        },
        performances: {
          moyenne_generale: moyenneRow?.moyenne ? Number(moyenneRow.moyenne).toFixed(2) : null,
          taux_reussite: totalNotes > 0 ? Math.round((Number(notesReussiesRow?.count ?? 0) / totalNotes) * 100) : null,
          total_evaluations: totalNotes,
        },
        activite: {
          messages_non_lus: Number(messagesNonLusRow?.count ?? 0),
          stocks_critiques: Number(stocksCritiquesRow?.count ?? 0),
        },
        annee_scolaire_id: anneeId,
      },
    });
  }
);

/* ── 2. Analyse pédagogique ─────────────────────────────────── */

router.get(
  "/analytics/pedagogique",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;
    const anneeId = (req.query.annee_scolaire_id as string) || await getActiveAnnee(etabId);
    const trimestre = req.query.trimestre ? String(req.query.trimestre) : null;
    const classeId = req.query.classe_id as string | undefined;

    const baseNotesWhere: Parameters<typeof and>[0][] = [
      eq(notesTable.etablissement_id, etabId),
    ];
    if (anneeId) baseNotesWhere.push(eq(notesTable.annee_scolaire_id, anneeId));
    if (trimestre) baseNotesWhere.push(sql`${notesTable.trimestre}::text = ${trimestre}`);
    if (classeId) baseNotesWhere.push(eq(notesTable.classe_id, classeId));

    // Performances par classe
    const perfParClasse = await db
      .select({
        classe_id: classesTable.id,
        nom_classe: classesTable.nom,
        effectif: count(eleveClassesTable.eleve_id),
        moyenne: avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`),
      })
      .from(classesTable)
      .leftJoin(eleveClassesTable, and(
        eq(eleveClassesTable.classe_id, classesTable.id),
        anneeId ? eq(eleveClassesTable.annee_scolaire_id, anneeId) : sql`true`,
        eq(eleveClassesTable.statut, "actif"),
      ))
      .leftJoin(notesTable, and(
        eq(notesTable.classe_id, classesTable.id),
        anneeId ? eq(notesTable.annee_scolaire_id, anneeId) : sql`true`,
        trimestre ? sql`${notesTable.trimestre}::text = ${trimestre}` : sql`true`,
      ))
      .where(eq(classesTable.etablissement_id, etabId))
      .groupBy(classesTable.id, classesTable.nom)
      .orderBy(classesTable.nom);

    // Performances par matière
    const perfParMatiere = await db
      .select({
        matiere: notesTable.matiere,
        moyenne: avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`),
        nb_evaluations: count(),
      })
      .from(notesTable)
      .where(and(...baseNotesWhere))
      .groupBy(notesTable.matiere)
      .orderBy(desc(avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`)));

    // Elèves en difficulté (moyenne < 8)
    const elevesEnDifficulte = await db
      .select({
        eleve_id: notesTable.eleve_id,
        nom: utilisateursTable.nom,
        prenoms: utilisateursTable.prenoms,
        classe_id: notesTable.classe_id,
        moyenne: avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`),
      })
      .from(notesTable)
      .innerJoin(elevesTable, eq(elevesTable.id, notesTable.eleve_id))
      .innerJoin(utilisateursTable, eq(utilisateursTable.id, elevesTable.utilisateur_id))
      .where(and(...baseNotesWhere))
      .groupBy(notesTable.eleve_id, utilisateursTable.nom, utilisateursTable.prenoms, notesTable.classe_id)
      .having(sql`AVG((${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20) < 8`)
      .orderBy(avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`))
      .limit(20);

    // Elèves excellents (moyenne >= 16)
    const elevesExcellents = await db
      .select({
        eleve_id: notesTable.eleve_id,
        nom: utilisateursTable.nom,
        prenoms: utilisateursTable.prenoms,
        classe_id: notesTable.classe_id,
        moyenne: avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`),
      })
      .from(notesTable)
      .innerJoin(elevesTable, eq(elevesTable.id, notesTable.eleve_id))
      .innerJoin(utilisateursTable, eq(utilisateursTable.id, elevesTable.utilisateur_id))
      .where(and(...baseNotesWhere))
      .groupBy(notesTable.eleve_id, utilisateursTable.nom, utilisateursTable.prenoms, notesTable.classe_id)
      .having(sql`AVG((${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20) >= 16`)
      .orderBy(desc(avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`)))
      .limit(20);

    // Performances par professeur
    const perfParProf = await db
      .select({
        professeur_id: notesTable.professeur_id,
        nom: utilisateursTable.nom,
        prenoms: utilisateursTable.prenoms,
        nb_evaluations: count(),
        moyenne: avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`),
      })
      .from(notesTable)
      .innerJoin(utilisateursTable, eq(utilisateursTable.id, notesTable.professeur_id))
      .where(and(...baseNotesWhere))
      .groupBy(notesTable.professeur_id, utilisateursTable.nom, utilisateursTable.prenoms)
      .orderBy(desc(avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`)));

    res.json({
      success: true,
      data: {
        par_classe: perfParClasse.map(c => ({
          classe_id: c.classe_id,
          nom_classe: c.nom_classe,
          effectif: Number(c.effectif),
          moyenne: c.moyenne ? Number(c.moyenne).toFixed(2) : null,
        })),
        par_matiere: perfParMatiere.map(m => ({
          matiere: m.matiere,
          moyenne: m.moyenne ? Number(m.moyenne).toFixed(2) : null,
          nb_evaluations: Number(m.nb_evaluations),
        })),
        eleves_en_difficulte: elevesEnDifficulte.map(e => ({
          eleve_id: e.eleve_id,
          nom: e.nom,
          prenoms: e.prenoms,
          classe_id: e.classe_id,
          moyenne: e.moyenne ? Number(e.moyenne).toFixed(2) : null,
        })),
        eleves_excellents: elevesExcellents.map(e => ({
          eleve_id: e.eleve_id,
          nom: e.nom,
          prenoms: e.prenoms,
          classe_id: e.classe_id,
          moyenne: e.moyenne ? Number(e.moyenne).toFixed(2) : null,
        })),
        par_professeur: user.role === "censeur"
          ? perfParProf.map(p => ({
            professeur_id: "anonyme",
            nb_evaluations: Number(p.nb_evaluations),
            moyenne: p.moyenne ? Number(p.moyenne).toFixed(2) : null,
          }))
          : perfParProf.map(p => ({
            professeur_id: p.professeur_id,
            nom: p.nom,
            prenoms: p.prenoms,
            nb_evaluations: Number(p.nb_evaluations),
            moyenne: p.moyenne ? Number(p.moyenne).toFixed(2) : null,
          })),
        annee_scolaire_id: anneeId,
        trimestre,
      },
    });
  }
);

/* ── 3. Analyse présences ─────────────────────────────────────── */

router.get(
  "/analytics/presences",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;
    const anneeId = (req.query.annee_scolaire_id as string) || await getActiveAnnee(etabId);
    const trimestre = req.query.trimestre ? String(req.query.trimestre) : null;
    const classeId = req.query.classe_id as string | undefined;

    const baseWhere: Parameters<typeof and>[0][] = [
      eq(absencesTable.etablissement_id, etabId),
    ];
    if (anneeId) baseWhere.push(eq(absencesTable.annee_scolaire_id, anneeId));
    if (classeId) baseWhere.push(eq(absencesTable.classe_id, classeId));

    // Stats globales
    const [totalRow] = await db.select({ count: count() }).from(absencesTable).where(and(...baseWhere));
    const [nonJustifRow] = await db
      .select({ count: count() })
      .from(absencesTable)
      .where(and(...baseWhere, eq(absencesTable.statut, "non_justifiee")));
    const [justifRow] = await db
      .select({ count: count() })
      .from(absencesTable)
      .where(and(...baseWhere, eq(absencesTable.statut, "justifiee")));

    // Top 10 élèves les plus absents
    const topAbsents = await db
      .select({
        eleve_id: absencesTable.eleve_id,
        nom: utilisateursTable.nom,
        prenoms: utilisateursTable.prenoms,
        classe_id: absencesTable.classe_id,
        total: count(),
        non_justifie: count(sql`CASE WHEN ${absencesTable.statut} = 'non_justifiee' THEN 1 END`),
        justifie: count(sql`CASE WHEN ${absencesTable.statut} = 'justifiee' THEN 1 END`),
      })
      .from(absencesTable)
      .innerJoin(elevesTable, eq(elevesTable.id, absencesTable.eleve_id))
      .innerJoin(utilisateursTable, eq(utilisateursTable.id, elevesTable.utilisateur_id))
      .where(and(...baseWhere))
      .groupBy(absencesTable.eleve_id, utilisateursTable.nom, utilisateursTable.prenoms, absencesTable.classe_id)
      .orderBy(desc(count()))
      .limit(10);

    // Absences par matière
    const parMatiere = await db
      .select({ matiere: absencesTable.matiere, count: count() })
      .from(absencesTable)
      .where(and(...baseWhere))
      .groupBy(absencesTable.matiere)
      .orderBy(desc(count()))
      .limit(10);

    // Evolution par semaine (30 dernières semaines)
    const evolutionSemaine = await db
      .select({
        semaine: sql<string>`TO_CHAR(DATE_TRUNC('week', ${absencesTable.date_absence}::date), 'YYYY-MM-DD')`,
        total: count(),
        non_justifiee: count(sql`CASE WHEN ${absencesTable.statut} = 'non_justifiee' THEN 1 END`),
        justifiee: count(sql`CASE WHEN ${absencesTable.statut} = 'justifiee' THEN 1 END`),
      })
      .from(absencesTable)
      .where(and(
        eq(absencesTable.etablissement_id, etabId),
        sql`${absencesTable.date_absence}::date >= NOW() - INTERVAL '30 weeks'`,
      ))
      .groupBy(sql`DATE_TRUNC('week', ${absencesTable.date_absence}::date)`)
      .orderBy(sql`DATE_TRUNC('week', ${absencesTable.date_absence}::date)`);

    // Par jour de semaine
    const parJour = await db
      .select({
        jour: sql<number>`EXTRACT(DOW FROM ${absencesTable.date_absence}::date)`,
        count: count(),
      })
      .from(absencesTable)
      .where(and(...baseWhere))
      .groupBy(sql`EXTRACT(DOW FROM ${absencesTable.date_absence}::date)`)
      .orderBy(sql`EXTRACT(DOW FROM ${absencesTable.date_absence}::date)`);

    const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

    res.json({
      success: true,
      data: {
        stats_globales: {
          total_absences: Number(totalRow?.count ?? 0),
          non_justifiees: Number(nonJustifRow?.count ?? 0),
          justifiees: Number(justifRow?.count ?? 0),
          taux_justification: Number(totalRow?.count ?? 0) > 0
            ? Math.round((Number(justifRow?.count ?? 0) / Number(totalRow?.count)) * 100)
            : 0,
        },
        top_absents: topAbsents.map(e => ({
          eleve_id: e.eleve_id,
          nom: e.nom,
          prenoms: e.prenoms,
          classe_id: e.classe_id,
          total: Number(e.total),
          non_justifie: Number(e.non_justifie),
          justifie: Number(e.justifie),
        })),
        par_matiere: parMatiere.map(m => ({
          matiere: m.matiere,
          count: Number(m.count),
        })),
        evolution_semaine: evolutionSemaine.map(s => ({
          semaine: s.semaine,
          total: Number(s.total),
          non_justifiee: Number(s.non_justifiee),
          justifiee: Number(s.justifiee),
        })),
        par_jour_semaine: parJour.map(j => ({
          jour: JOURS[Number(j.jour)] ?? `Jour ${j.jour}`,
          count: Number(j.count),
        })),
      },
    });
  }
);

/* ── 4. Analyse infirmerie ─────────────────────────────────────── */

router.get(
  "/analytics/infirmerie",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;

    // Consultations par mois (12 derniers mois)
    const parMois = await db
      .select({
        mois: sql<string>`TO_CHAR(DATE_TRUNC('month', ${consultationsInfirmerieTable.created_at}), 'YYYY-MM')`,
        count: count(),
      })
      .from(consultationsInfirmerieTable)
      .where(and(
        eq(consultationsInfirmerieTable.etablissement_id, etabId),
        sql`${consultationsInfirmerieTable.created_at} >= NOW() - INTERVAL '12 months'`,
      ))
      .groupBy(sql`DATE_TRUNC('month', ${consultationsInfirmerieTable.created_at})`)
      .orderBy(sql`DATE_TRUNC('month', ${consultationsInfirmerieTable.created_at})`);

    // Top motifs
    const topMotifs = await db
      .select({ motif: consultationsInfirmerieTable.motif, count: count() })
      .from(consultationsInfirmerieTable)
      .where(eq(consultationsInfirmerieTable.etablissement_id, etabId))
      .groupBy(consultationsInfirmerieTable.motif)
      .orderBy(desc(count()))
      .limit(10);

    // Stocks critiques
    const stocksCritiques = await db
      .select({
        id: stocksInfirmerieTable.id,
        nom: stocksInfirmerieTable.nom,
        quantite: stocksInfirmerieTable.quantite,
        seuil_alerte: stocksInfirmerieTable.seuil_alerte,
        unite: stocksInfirmerieTable.unite,
      })
      .from(stocksInfirmerieTable)
      .where(and(
        eq(stocksInfirmerieTable.etablissement_id, etabId),
        sql`${stocksInfirmerieTable.quantite} <= ${stocksInfirmerieTable.seuil_alerte}`,
      ))
      .orderBy(stocksInfirmerieTable.quantite);

    // Total consultations
    const [totalRow] = await db
      .select({ count: count() })
      .from(consultationsInfirmerieTable)
      .where(eq(consultationsInfirmerieTable.etablissement_id, etabId));

    res.json({
      success: true,
      data: {
        total_consultations: Number(totalRow?.count ?? 0),
        par_mois: parMois.map(m => ({ mois: m.mois, count: Number(m.count) })),
        top_motifs: topMotifs.map(m => ({ motif: m.motif, count: Number(m.count) })),
        stocks_critiques: stocksCritiques,
      },
    });
  }
);

/* ── 5. Analyse clubs ─────────────────────────────────────────── */

router.get(
  "/analytics/clubs",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;

    // Total clubs
    const [totalClubsRow] = await db
      .select({ count: count() })
      .from(clubsTable)
      .where(and(eq(clubsTable.etablissement_id, etabId), eq(clubsTable.actif, true)));

    // Total membres actifs
    const [totalMembresRow] = await db
      .select({ count: count() })
      .from(clubMembresTable)
      .innerJoin(clubsTable, eq(clubsTable.id, clubMembresTable.club_id))
      .where(and(
        eq(clubsTable.etablissement_id, etabId),
        eq(clubMembresTable.statut, "accepte"),
      ));

    // Total élèves inscrits cette année
    const activeAnnee = await getActiveAnnee(etabId);
    const [totalElevesRow] = await db
      .select({ count: count() })
      .from(eleveClassesTable)
      .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
      .where(and(
        eq(classesTable.etablissement_id, etabId),
        activeAnnee ? eq(eleveClassesTable.annee_scolaire_id, activeAnnee) : sql`true`,
        eq(eleveClassesTable.statut, "actif"),
      ));

    // Par catégorie
    const parCategorie = await db
      .select({ categorie: clubsTable.categorie, count: count() })
      .from(clubsTable)
      .where(and(eq(clubsTable.etablissement_id, etabId), eq(clubsTable.actif, true)))
      .groupBy(clubsTable.categorie)
      .orderBy(desc(count()));

    // Clubs les plus actifs (par nb activités)
    const clubsActifs = await db
      .select({
        club_id: activitesClubTable.club_id,
        nom: clubsTable.nom,
        nb_activites: count(),
      })
      .from(activitesClubTable)
      .innerJoin(clubsTable, eq(clubsTable.id, activitesClubTable.club_id))
      .where(eq(clubsTable.etablissement_id, etabId))
      .groupBy(activitesClubTable.club_id, clubsTable.nom)
      .orderBy(desc(count()))
      .limit(5);

    // Distinctions ce trimestre
    const dateDebutTrimestre = new Date();
    dateDebutTrimestre.setMonth(dateDebutTrimestre.getMonth() - 4);
    const [distinctionsRow] = await db
      .select({ count: count() })
      .from(distinctionsClubTable)
      .innerJoin(clubsTable, eq(clubsTable.id, distinctionsClubTable.club_id))
      .where(and(
        eq(clubsTable.etablissement_id, etabId),
        sql`${distinctionsClubTable.date_obtention}::date >= ${dateDebutTrimestre.toISOString().split("T")[0]}`,
      ));

    const totalEleves = Number(totalElevesRow?.count ?? 0);
    const totalMembres = Number(totalMembresRow?.count ?? 0);

    res.json({
      success: true,
      data: {
        total_clubs: Number(totalClubsRow?.count ?? 0),
        total_membres: totalMembres,
        taux_participation: totalEleves > 0 ? Math.round((totalMembres / totalEleves) * 100) : 0,
        par_categorie: parCategorie.map(c => ({ categorie: c.categorie, count: Number(c.count) })),
        clubs_les_plus_actifs: clubsActifs.map(c => ({
          club_id: c.club_id,
          nom: c.nom,
          nb_activites: Number(c.nb_activites),
        })),
        distinctions_trimestre: Number(distinctionsRow?.count ?? 0),
      },
    });
  }
);

/* ── 6. Analyse bibliothèque ──────────────────────────────────── */

router.get(
  "/analytics/bibliotheque",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;

    // Ressources les plus consultées
    const topRessources = await db
      .select({
        id: ressourcesTable.id,
        titre: ressourcesTable.titre,
        matiere_id: ressourcesTable.matiere_id,
        nb_consultations: ressourcesTable.nb_consultations,
        nb_telechargements: ressourcesTable.nb_telechargements,
      })
      .from(ressourcesTable)
      .where(and(
        eq(ressourcesTable.etablissement_id, etabId),
        eq(ressourcesTable.valide, true),
      ))
      .orderBy(desc(ressourcesTable.nb_consultations))
      .limit(10);

    // Statistiques globales
    const [statsRow] = await db
      .select({
        total_ressources: count(),
        total_consultations: sql<number>`COALESCE(SUM(${ressourcesTable.nb_consultations}), 0)`,
        total_telechargements: sql<number>`COALESCE(SUM(${ressourcesTable.nb_telechargements}), 0)`,
      })
      .from(ressourcesTable)
      .where(and(eq(ressourcesTable.etablissement_id, etabId), eq(ressourcesTable.valide, true)));

    // En attente de validation
    const [enAttenteRow] = await db
      .select({ count: count() })
      .from(ressourcesTable)
      .where(and(
        eq(ressourcesTable.etablissement_id, etabId),
        eq(ressourcesTable.valide, false),
        eq(ressourcesTable.publie, false),
      ));

    // Répartition par type
    const parType = await db
      .select({ type: ressourcesTable.type, count: count() })
      .from(ressourcesTable)
      .where(and(eq(ressourcesTable.etablissement_id, etabId), eq(ressourcesTable.valide, true)))
      .groupBy(ressourcesTable.type)
      .orderBy(desc(count()));

    res.json({
      success: true,
      data: {
        total_ressources: Number(statsRow?.total_ressources ?? 0),
        total_consultations: Number(statsRow?.total_consultations ?? 0),
        total_telechargements: Number(statsRow?.total_telechargements ?? 0),
        en_attente_validation: Number(enAttenteRow?.count ?? 0),
        top_ressources: topRessources,
        par_type: parType.map(t => ({ type: t.type, count: Number(t.count) })),
      },
    });
  }
);

/* ── 7. Dashboard analytique professeur ────────────────────────── */

router.get(
  "/analytics/professeur",
  authMiddleware,
  verifierLicence,
  requireRole("professeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;
    const trimestre = req.query.trimestre ? String(req.query.trimestre) : null;
    const activeAnnee = await getActiveAnnee(etabId);

    // Classes du professeur
    const mesClasses = await db
      .select({
        classe_id: professeurClassesTable.classe_id,
        matiere: professeurClassesTable.matiere,
        nom_classe: classesTable.nom,
      })
      .from(professeurClassesTable)
      .innerJoin(classesTable, eq(classesTable.id, professeurClassesTable.classe_id))
      .where(and(
        eq(professeurClassesTable.professeur_id, user.id),
        activeAnnee ? eq(professeurClassesTable.annee_scolaire_id, activeAnnee) : sql`true`,
      ));

    const classeIds = [...new Set(mesClasses.map(c => c.classe_id))];

    // Nb élèves total
    let totalEleves = 0;
    if (classeIds.length > 0) {
      const [totalRow] = await db
        .select({ count: count() })
        .from(eleveClassesTable)
        .where(and(
          inArray(eleveClassesTable.classe_id, classeIds),
          activeAnnee ? eq(eleveClassesTable.annee_scolaire_id, activeAnnee) : sql`true`,
          eq(eleveClassesTable.statut, "actif"),
        ));
      totalEleves = Number(totalRow?.count ?? 0);
    }

    // Notes conditions
    const notesWhere: Parameters<typeof and>[0][] = [
      eq(notesTable.professeur_id, user.id),
      eq(notesTable.etablissement_id, etabId),
    ];
    if (activeAnnee) notesWhere.push(eq(notesTable.annee_scolaire_id, activeAnnee));
    if (trimestre) notesWhere.push(sql`${notesTable.trimestre}::text = ${trimestre}`);

    // Nb évaluations ce trimestre
    const [nbEvalsRow] = await db.select({ count: count() }).from(notesTable).where(and(...notesWhere));

    // Moyenne par classe
    const moyennesParClasse = classeIds.length > 0 ? await db
      .select({
        classe_id: notesTable.classe_id,
        moyenne: avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`),
        nb_evals: count(),
      })
      .from(notesTable)
      .where(and(...notesWhere, inArray(notesTable.classe_id, classeIds)))
      .groupBy(notesTable.classe_id) : [];

    // Messages non lus
    const [messagesRow] = await db
      .select({ count: count() })
      .from(messagesTable)
      .where(and(eq(messagesTable.destinataire_id, user.id), eq(messagesTable.lu, false)));

    // Absences dans mes cours (appels sans présence)
    let absencesTotal = 0;
    if (classeIds.length > 0) {
      const [absRow] = await db
        .select({ count: count() })
        .from(absencesTable)
        .where(and(
          eq(absencesTable.professeur_id, user.id),
          eq(absencesTable.etablissement_id, etabId),
          activeAnnee ? eq(absencesTable.annee_scolaire_id, activeAnnee) : sql`true`,
          sql`true`,
        ));
      absencesTotal = Number(absRow?.count ?? 0);
    }

    res.json({
      success: true,
      data: {
        mes_classes: mesClasses,
        total_eleves: totalEleves,
        nb_evaluations_trimestre: Number(nbEvalsRow?.count ?? 0),
        messages_non_lus: Number(messagesRow?.count ?? 0),
        total_absences_mes_cours: absencesTotal,
        moyennes_par_classe: moyennesParClasse.map(m => ({
          classe_id: m.classe_id,
          moyenne: m.moyenne ? Number(m.moyenne).toFixed(2) : null,
          nb_evaluations: Number(m.nb_evals),
        })),
        annee_scolaire_id: activeAnnee,
        trimestre,
      },
    });
  }
);

/* ── 8. Dashboard analytique censeur ──────────────────────────── */

router.get(
  "/analytics/censeur",
  authMiddleware,
  verifierLicence,
  requireRole("censeur", "directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;
    const activeAnnee = await getActiveAnnee(etabId);

    // Résumé synthétique
    const [totalClassesRow] = await db
      .select({ count: count() })
      .from(classesTable)
      .where(eq(classesTable.etablissement_id, etabId));

    const [totalElevesRow] = await db
      .select({ count: count() })
      .from(eleveClassesTable)
      .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
      .where(and(
        eq(classesTable.etablissement_id, etabId),
        activeAnnee ? eq(eleveClassesTable.annee_scolaire_id, activeAnnee) : sql`true`,
        eq(eleveClassesTable.statut, "actif"),
      ));

    const [absNonJustifRow] = await db
      .select({ count: count() })
      .from(absencesTable)
      .where(and(
        eq(absencesTable.etablissement_id, etabId),
        eq(absencesTable.statut, "non_justifiee"),
        activeAnnee ? eq(absencesTable.annee_scolaire_id, activeAnnee) : sql`true`,
      ));

    const [moyenneRow] = await db
      .select({ moyenne: avg(sql<number>`(${notesTable.note}::numeric / ${notesTable.note_sur}::numeric) * 20`) })
      .from(notesTable)
      .where(and(
        eq(notesTable.etablissement_id, etabId),
        activeAnnee ? eq(notesTable.annee_scolaire_id, activeAnnee) : sql`true`,
      ));

    const [messagesRow] = await db
      .select({ count: count() })
      .from(messagesTable)
      .where(and(eq(messagesTable.destinataire_id, user.id), eq(messagesTable.lu, false)));

    res.json({
      success: true,
      data: {
        total_classes: Number(totalClassesRow?.count ?? 0),
        total_eleves: Number(totalElevesRow?.count ?? 0),
        absences_non_justifiees: Number(absNonJustifRow?.count ?? 0),
        moyenne_generale: moyenneRow?.moyenne ? Number(moyenneRow.moyenne).toFixed(2) : null,
        messages_non_lus: Number(messagesRow?.count ?? 0),
        annee_scolaire_id: activeAnnee,
      },
    });
  }
);

/* ── 9. Générer un rapport ──────────────────────────────────────── */

router.post(
  "/analytics/rapports/generer",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;
    const { titre, type, format, parametres } = req.body as {
      titre: string;
      type: string;
      format: string;
      parametres?: Record<string, unknown>;
    };

    if (!titre || !type || !format) {
      res.status(400).json({ success: false, message: "titre, type et format sont requis." });
      return;
    }

    const validTypes = ["resultats", "absences", "effectifs", "activite_plateforme", "finances", "personnalise"];
    const validFormats = ["pdf", "excel"];

    if (!validTypes.includes(type) || !validFormats.includes(format)) {
      res.status(400).json({ success: false, message: "Type ou format invalide." });
      return;
    }

    const [rapport] = await db
      .insert(rapportsGeneresTable)
      .values({
        etablissement_id: etabId,
        genere_par: user.id,
        titre,
        type: type as any,
        format: format as any,
        parametres: parametres ?? null,
        statut: "en_cours",
      })
      .returning();

    // Simule la génération en arrière-plan (marque immédiatement comme terminé avec URL fictive)
    setTimeout(async () => {
      await db
        .update(rapportsGeneresTable)
        .set({
          statut: "termine",
          fichier_url: `/api/analytics/rapports/${rapport!.id}/fichier`,
          fichier_nom: `${titre.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.${format}`,
          updated_at: new Date(),
        })
        .where(eq(rapportsGeneresTable.id, rapport!.id));
    }, 2000);

    res.status(201).json({
      success: true,
      message: "Rapport en cours de génération.",
      data: { rapport_id: rapport!.id },
    });
  }
);

/* ── 10. Lister les rapports ──────────────────────────────────── */

router.get(
  "/analytics/rapports",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.etablissement_id!;

    const rapports = await db
      .select({
        id: rapportsGeneresTable.id,
        titre: rapportsGeneresTable.titre,
        type: rapportsGeneresTable.type,
        format: rapportsGeneresTable.format,
        statut: rapportsGeneresTable.statut,
        fichier_url: rapportsGeneresTable.fichier_url,
        fichier_nom: rapportsGeneresTable.fichier_nom,
        parametres: rapportsGeneresTable.parametres,
        genere_par: rapportsGeneresTable.genere_par,
        created_at: rapportsGeneresTable.created_at,
        nom_generateur: utilisateursTable.nom,
        prenoms_generateur: utilisateursTable.prenoms,
      })
      .from(rapportsGeneresTable)
      .innerJoin(utilisateursTable, eq(utilisateursTable.id, rapportsGeneresTable.genere_par))
      .where(eq(rapportsGeneresTable.etablissement_id, etabId))
      .orderBy(desc(rapportsGeneresTable.created_at))
      .limit(50);

    res.json({ success: true, data: rapports });
  }
);

/* ── 11. Télécharger un rapport ──────────────────────────────── */

router.get(
  "/analytics/rapports/:id/telecharger",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const id = normalizeId(req.params.id);

    const [rapport] = await db
      .select()
      .from(rapportsGeneresTable)
      .where(and(
        eq(rapportsGeneresTable.id, id),
        eq(rapportsGeneresTable.etablissement_id, user.etablissement_id!),
      ))
      .limit(1);

    if (!rapport) {
      res.status(404).json({ success: false, message: "Rapport introuvable." });
      return;
    }

    res.json({
      success: true,
      data: {
        fichier_url: rapport.fichier_url,
        fichier_nom: rapport.fichier_nom,
        statut: rapport.statut,
      },
    });
  }
);

/* ── 12. Créer un snapshot (dev uniquement) ───────────────────── */

router.post(
  "/analytics/snapshots",
  authMiddleware,
  verifierLicence,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { annee_scolaire_id, trimestre, date_snapshot, donnees } = req.body as {
      annee_scolaire_id: string;
      trimestre?: number;
      date_snapshot: string;
      donnees: Record<string, unknown>;
    };

    if (!annee_scolaire_id || !date_snapshot || !donnees) {
      res.status(400).json({ success: false, message: "Paramètres manquants." });
      return;
    }

    // Récupérer l'établissement lié à l'année scolaire
    const [annee] = await db
      .select({ etablissement_id: anneesScolairesTable.etablissement_id })
      .from(anneesScolairesTable)
      .where(eq(anneesScolairesTable.id, annee_scolaire_id))
      .limit(1);

    if (!annee) {
      res.status(404).json({ success: false, message: "Année scolaire introuvable." });
      return;
    }

    const [snapshot] = await db
      .insert(snapshotsAnalyticsTable)
      .values({
        etablissement_id: annee.etablissement_id,
        annee_scolaire_id,
        trimestre: trimestre ?? null,
        date_snapshot,
        donnees,
      })
      .returning();

    res.status(201).json({
      success: true,
      message: "Snapshot créé.",
      data: snapshot,
    });
  }
);

export default router;
