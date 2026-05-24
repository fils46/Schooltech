import { db, alertesAbsencesTable, absencesTable, absencesDemiJourneeTable, configAbsencesTable, elevesTable, parentsElevesTable, utilisateursTable, classesTable, eleveClassesTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { creerNotification } from "./notificationService";

async function getConfigEtab(etablissementId: string) {
  const [config] = await db.select().from(configAbsencesTable)
    .where(eq(configAbsencesTable.etablissement_id, etablissementId)).limit(1);
  return config ?? {
    seuil_alerte_1: 3,
    seuil_alerte_2: 6,
    seuil_alerte_3: 10,
    periode_calcul: "trimestre" as const,
    notifier_parent_seuil_1: true,
    notifier_parent_seuil_2: true,
    notifier_parent_seuil_3: true,
    notifier_censeur_seuil_1: false,
    notifier_censeur_seuil_2: true,
    notifier_censeur_seuil_3: true,
    notifier_directeur_seuil_3: true,
  };
}

async function compterAbsencesNJ(
  eleveId: string,
  anneeScolaireId: string,
  trimestre: number | null,
) {
  const conditions = [
    eq(absencesTable.eleve_id, eleveId),
    eq(absencesTable.annee_scolaire_id, anneeScolaireId),
    eq(absencesTable.statut, "non_justifiee"),
  ];

  const [{ total }] = await db.select({ total: count() }).from(absencesTable).where(and(...conditions));

  const demiConditions = [
    eq(absencesDemiJourneeTable.eleve_id, eleveId),
    eq(absencesDemiJourneeTable.annee_scolaire_id, anneeScolaireId),
    eq(absencesDemiJourneeTable.statut, "non_justifiee"),
  ];
  const [{ total: totalDemi }] = await db.select({ total: count() }).from(absencesDemiJourneeTable).where(and(...demiConditions));

  return total + totalDemi;
}

async function getParentsEleve(eleveId: string) {
  return db.select({ parent_id: parentsElevesTable.utilisateur_id })
    .from(parentsElevesTable)
    .where(eq(parentsElevesTable.eleve_id, eleveId));
}

async function getUtilisateursParRole(etablissementId: string, role: string) {
  return db.select({ id: utilisateursTable.id })
    .from(utilisateursTable)
    .where(and(
      eq(utilisateursTable.etablissement_id, etablissementId),
      eq(utilisateursTable.role, role),
      eq(utilisateursTable.actif, true),
    ));
}

async function envoyerNotificationsAlerte(
  niveau: 1 | 2 | 3,
  eleveId: string,
  etablissementId: string,
  nbAbsences: number,
  config: Awaited<ReturnType<typeof getConfigEtab>>,
) {
  const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
    .from(elevesTable).where(eq(elevesTable.id, eleveId)).limit(1);
  if (!eleve) return;

  const prenomEleve = eleve.prenoms?.split(" ")[0] ?? "L'élève";

  const messages: Record<1 | 2 | 3, { titre: string; contenu: string }> = {
    1: {
      titre: "Alerte absences — Niveau 1",
      contenu: `Votre enfant ${prenomEleve} totalise ${nbAbsences} absences non justifiées. Merci de régulariser la situation.`,
    },
    2: {
      titre: "Alerte absences — Niveau 2",
      contenu: `Votre enfant ${prenomEleve} totalise ${nbAbsences} absences non justifiées. Une convocation vous sera adressée.`,
    },
    3: {
      titre: "Alerte absences — Niveau 3",
      contenu: `Votre enfant ${prenomEleve} totalise ${nbAbsences} absences non justifiées. Un conseil disciplinaire est envisagé.`,
    },
  };

  const staffMsg = {
    titre: messages[niveau].titre,
    contenu: `${eleve.prenoms} ${eleve.nom} — ${nbAbsences} absences non justifiées`,
  };

  const notifParent = (config as Record<string, unknown>)[`notifier_parent_seuil_${niveau}`];
  const notifCenseur = (config as Record<string, unknown>)[`notifier_censeur_seuil_${niveau}`];

  if (notifParent) {
    const parents = await getParentsEleve(eleveId);
    for (const p of parents) {
      await creerNotification({
        etablissement_id: etablissementId,
        destinataire_id: p.parent_id,
        type: "alerte_seuil",
        titre: messages[niveau].titre,
        contenu: messages[niveau].contenu,
        lien: "/absences-parent",
      });
    }
  }

  if (notifCenseur) {
    const censeurs = await getUtilisateursParRole(etablissementId, "censeur");
    for (const c of censeurs) {
      await creerNotification({
        etablissement_id: etablissementId,
        destinataire_id: c.id,
        type: "alerte_seuil",
        titre: staffMsg.titre,
        contenu: staffMsg.contenu,
        lien: "/absences",
      });
    }
  }

  if (niveau === 3 && config.notifier_directeur_seuil_3) {
    const directeurs = await getUtilisateursParRole(etablissementId, "directeur");
    for (const d of directeurs) {
      await creerNotification({
        etablissement_id: etablissementId,
        destinataire_id: d.id,
        type: "alerte_seuil",
        titre: staffMsg.titre,
        contenu: `${staffMsg.contenu}. Action requise.`,
        lien: "/alertes-absences",
      });
    }
  }
}

export async function verifierSeuilsAlerte(
  eleveId: string,
  etablissementId: string,
  anneeScolaireId: string,
  trimestre: number | null = null,
) {
  try {
    const config = await getConfigEtab(etablissementId);
    const nbAbsencesNJ = await compterAbsencesNJ(eleveId, anneeScolaireId, trimestre);

    const seuils: Array<{ niveau: 1 | 2 | 3; seuil: number }> = [
      { niveau: 1, seuil: config.seuil_alerte_1 },
      { niveau: 2, seuil: config.seuil_alerte_2 },
      { niveau: 3, seuil: config.seuil_alerte_3 },
    ];

    for (const { niveau, seuil } of seuils) {
      if (nbAbsencesNJ >= seuil) {
        const existing = await db.select({ id: alertesAbsencesTable.id })
          .from(alertesAbsencesTable)
          .where(and(
            eq(alertesAbsencesTable.eleve_id, eleveId),
            eq(alertesAbsencesTable.annee_scolaire_id, anneeScolaireId),
            eq(alertesAbsencesTable.niveau_alerte, niveau),
            ...(trimestre !== null ? [eq(alertesAbsencesTable.trimestre, trimestre)] : []),
          )).limit(1);

        if (existing.length === 0) {
          await db.insert(alertesAbsencesTable).values({
            etablissement_id: etablissementId,
            eleve_id: eleveId,
            annee_scolaire_id: anneeScolaireId,
            trimestre,
            niveau_alerte: niveau,
            nb_absences_nj_atteint: nbAbsencesNJ,
            date_declenchement: new Date(),
          });

          await envoyerNotificationsAlerte(niveau, eleveId, etablissementId, nbAbsencesNJ, config);
        }
      }
    }
  } catch (err) {
    console.error("Erreur verifierSeuilsAlerte:", err);
  }
}
