import { db, notificationsTable, utilisateursTable, absencesTable, elevesTable, classesTable, parentsElevesTable } from "@workspace/db";
import { eq, and, count } from "drizzle-orm";
import { emitNotification } from "../socket/socketManager";

type NotifType = "absence" | "retard" | "alerte_seuil" | "justification_validee" | "justification_rejetee" | "bulletin_publie" | "message" | "annonce" | "rdv" | "incident_signale" | "sanction_en_attente" | "sanction_validee" | "sanction_refusee" | "incident_escalade" | "note_ajoutee";

const SEUIL_ABSENCES = parseInt(process.env["SEUIL_ABSENCES_ALERTE"] ?? "3", 10);

export { SEUIL_ABSENCES };

export async function creerNotification(data: {
  etablissement_id: string;
  destinataire_id: string;
  type: NotifType;
  titre: string;
  contenu: string;
  lien?: string | null;
  metadata?: unknown;
}) {
  const [notif] = await db
    .insert(notificationsTable)
    .values({
      etablissement_id: data.etablissement_id,
      destinataire_id: data.destinataire_id,
      type: data.type,
      titre: data.titre,
      contenu: data.contenu,
      lien: data.lien ?? null,
      metadata: data.metadata ?? null,
    })
    .returning();

  if (notif) {
    await emitNotification(data.destinataire_id, {
      id: notif.id,
      type: notif.type,
      titre: notif.titre,
      contenu: notif.contenu,
      lien: notif.lien,
      created_at: notif.created_at,
    });
  }

  return notif;
}

export async function envoyerNotificationAbsence(opts: {
  etablissement_id: string;
  parent_id: string;
  eleve_prenom: string;
  matiere: string;
  date_absence: string;
  type: "absence" | "retard";
}) {
  const label = opts.type === "retard" ? "en retard" : "absent(e)";
  await creerNotification({
    etablissement_id: opts.etablissement_id,
    destinataire_id: opts.parent_id,
    type: opts.type,
    titre: opts.type === "retard" ? "Retard signalé" : "Absence signalée",
    contenu: `${opts.eleve_prenom} a été marqué(e) ${label} en ${opts.matiere} le ${opts.date_absence}.`,
    lien: "/absences-parent",
  });
}

export async function envoyerAlerteSeuil(opts: {
  etablissement_id: string;
  parent_id: string;
  directeur_id: string;
  eleve_prenom: string;
  eleve_nom: string;
  classe_nom: string;
  nb_absences: number;
}) {
  await creerNotification({
    etablissement_id: opts.etablissement_id,
    destinataire_id: opts.parent_id,
    type: "alerte_seuil",
    titre: "Alerte absences répétées",
    contenu: `${opts.eleve_prenom} cumule ${opts.nb_absences} absences non justifiées.`,
    lien: "/absences-parent",
  });

  await creerNotification({
    etablissement_id: opts.etablissement_id,
    destinataire_id: opts.directeur_id,
    type: "alerte_seuil",
    titre: "Alerte : élève à risque",
    contenu: `${opts.eleve_prenom} ${opts.eleve_nom} (${opts.classe_nom}) — ${opts.nb_absences} absences non justifiées.`,
    lien: "/absences",
  });
}

export async function envoyerNotificationJustification(opts: {
  etablissement_id: string;
  parent_id: string;
  statut: "validee" | "rejetee";
  date_absence: string;
  commentaire?: string | null;
}) {
  const valide = opts.statut === "validee";
  await creerNotification({
    etablissement_id: opts.etablissement_id,
    destinataire_id: opts.parent_id,
    type: valide ? "justification_validee" : "justification_rejetee",
    titre: valide ? "Justification acceptée" : "Justification refusée",
    contenu: valide
      ? `Votre justification pour le ${opts.date_absence} a été acceptée.`
      : `Votre justification pour le ${opts.date_absence} a été refusée.${opts.commentaire ? ` Motif : ${opts.commentaire}` : ""}`,
    lien: "/absences-parent",
  });
}

export async function envoyerNotificationsNote(opts: {
  etablissement_id: string;
  eleve_id: string;
  matiere: string;
  intitule: string;
  note: number;
  note_sur: number;
  trimestre: string;
}) {
  const [eleve] = await db
    .select({
      utilisateur_id: elevesTable.utilisateur_id,
      prenoms: elevesTable.prenoms,
      nom: elevesTable.nom,
    })
    .from(elevesTable)
    .where(eq(elevesTable.id, opts.eleve_id))
    .limit(1);

  if (!eleve) return;

  const note20 = opts.note_sur > 0
    ? Math.round((opts.note / opts.note_sur) * 20 * 100) / 100
    : opts.note;
  const noteLabel = `${note20.toFixed(2)}/20`;
  const lienEleve = "/notes";
  const lienParent = "/suivi-scolaire";

  if (eleve.utilisateur_id) {
    await creerNotification({
      etablissement_id: opts.etablissement_id,
      destinataire_id: eleve.utilisateur_id,
      type: "note_ajoutee",
      titre: "Nouvelle note",
      contenu: `${opts.matiere} — ${opts.intitule} : ${noteLabel} (Trim. ${opts.trimestre})`,
      lien: lienEleve,
    });
  }

  const parents = await db
    .select({ parent_id: parentsElevesTable.utilisateur_id })
    .from(parentsElevesTable)
    .where(eq(parentsElevesTable.eleve_id, opts.eleve_id));

  const prenom = eleve.prenoms?.split(" ")[0] ?? "Votre enfant";
  for (const p of parents) {
    await creerNotification({
      etablissement_id: opts.etablissement_id,
      destinataire_id: p.parent_id,
      type: "note_ajoutee",
      titre: `Nouvelle note — ${prenom}`,
      contenu: `${prenom} a reçu une note en ${opts.matiere} — ${opts.intitule} : ${noteLabel} (Trim. ${opts.trimestre})`,
      lien: lienParent,
    });
  }
}

export async function getDirecteurEtablissement(etablissement_id: string) {
  const [dir] = await db
    .select({ id: utilisateursTable.id })
    .from(utilisateursTable)
    .where(
      and(
        eq(utilisateursTable.etablissement_id, etablissement_id),
        eq(utilisateursTable.role, "directeur"),
        eq(utilisateursTable.actif, true)
      )
    )
    .limit(1);
  return dir ?? null;
}

export async function declencherNotificationsAbsence(absence: {
  id: string;
  etablissement_id: string;
  eleve_id: string;
  classe_id: string;
  annee_scolaire_id: string;
  matiere: string;
  type: "absence" | "retard";
  date_absence: string;
}) {
  const [pe] = await db.select({ parent_id: parentsElevesTable.utilisateur_id })
    .from(parentsElevesTable).where(eq(parentsElevesTable.eleve_id, absence.eleve_id)).limit(1);
  const parentId = pe?.parent_id ?? null;
  if (!parentId) return;

  const [eleve] = await db.select({ prenoms: elevesTable.prenoms, nom: elevesTable.nom })
    .from(elevesTable).where(eq(elevesTable.id, absence.eleve_id)).limit(1);

  await envoyerNotificationAbsence({
    etablissement_id: absence.etablissement_id,
    parent_id: parentId,
    eleve_prenom: eleve?.prenoms?.split(" ")[0] ?? "L'élève",
    matiere: absence.matiere,
    date_absence: absence.date_absence,
    type: absence.type,
  });

  await db.update(absencesTable).set({ notif_parent_envoyee: true }).where(eq(absencesTable.id, absence.id));

  const [{ total }] = await db.select({ total: count() }).from(absencesTable)
    .where(and(
      eq(absencesTable.eleve_id, absence.eleve_id),
      eq(absencesTable.annee_scolaire_id, absence.annee_scolaire_id),
      eq(absencesTable.statut, "non_justifiee"),
    ));

  if (total >= SEUIL_ABSENCES) {
    const directeur = await getDirecteurEtablissement(absence.etablissement_id);
    if (directeur) {
      const [cls] = await db.select({ nom: classesTable.nom }).from(classesTable)
        .where(eq(classesTable.id, absence.classe_id)).limit(1);
      await envoyerAlerteSeuil({
        etablissement_id: absence.etablissement_id,
        parent_id: parentId,
        directeur_id: directeur.id,
        eleve_prenom: eleve?.prenoms?.split(" ")[0] ?? "L'élève",
        eleve_nom: eleve?.nom ?? "",
        classe_nom: cls?.nom ?? "",
        nb_absences: total,
      });
    }
  }
}
