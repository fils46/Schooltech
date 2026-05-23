import { Router } from "express";
import { eq, and, desc, count, gte, lte, sql } from "drizzle-orm";
import {
  db, incidentsTable, sanctionsTable, elevesTable, utilisateursTable,
  eleveClassesTable, parentsElevesTable, classesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { creerNotification } from "../lib/notificationService";

const router = Router();

/* ─── Helpers ──────────────────────────────────────────────────── */

async function getClasseNomEleve(eleveId: string): Promise<string> {
  const rows = await db
    .select({ nom: classesTable.nom })
    .from(eleveClassesTable)
    .innerJoin(classesTable, eq(classesTable.id, eleveClassesTable.classe_id))
    .where(eq(eleveClassesTable.eleve_id, eleveId))
    .orderBy(desc(eleveClassesTable.created_at))
    .limit(1);
  return rows[0]?.nom ?? "";
}

async function getParentEleve(eleveId: string): Promise<string | null> {
  const rows = await db
    .select({ parent_id: parentsElevesTable.utilisateur_id })
    .from(parentsElevesTable)
    .where(eq(parentsElevesTable.eleve_id, eleveId))
    .limit(1);
  return rows[0]?.parent_id ?? null;
}

async function getCenseurOuDirecteur(etabId: string): Promise<string | null> {
  const rows = await db
    .select({ id: utilisateursTable.id })
    .from(utilisateursTable)
    .where(
      and(
        eq(utilisateursTable.etablissement_id, etabId),
        sql`${utilisateursTable.role} IN ('censeur', 'directeur')`,
        eq(utilisateursTable.actif, true),
      )
    )
    .orderBy(sql`CASE WHEN ${utilisateursTable.role} = 'censeur' THEN 0 ELSE 1 END`)
    .limit(1);
  return rows[0]?.id ?? null;
}

async function enrichirIncident(inc: typeof incidentsTable.$inferSelect) {
  const [eleve] = await db
    .select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, matricule: elevesTable.matricule })
    .from(elevesTable).where(eq(elevesTable.id, inc.eleve_id)).limit(1);
  const [signaledBy] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms, role: utilisateursTable.role })
    .from(utilisateursTable).where(eq(utilisateursTable.id, inc.signale_par)).limit(1);
  const classeNom = await getClasseNomEleve(inc.eleve_id);
  const sanctions = await db
    .select()
    .from(sanctionsTable)
    .where(eq(sanctionsTable.incident_id, inc.id))
    .orderBy(desc(sanctionsTable.created_at));
  return {
    ...inc,
    eleve_nom: eleve?.nom ?? "",
    eleve_prenoms: eleve?.prenoms ?? "",
    eleve_matricule: eleve?.matricule ?? "",
    classe_nom: classeNom,
    signale_par_nom: signaledBy?.nom ?? "",
    signale_par_prenoms: signaledBy?.prenoms ?? "",
    signale_par_role: signaledBy?.role ?? "",
    sanctions,
  };
}

async function enrichirSanction(s: typeof sanctionsTable.$inferSelect) {
  const [eleve] = await db
    .select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, matricule: elevesTable.matricule })
    .from(elevesTable).where(eq(elevesTable.id, s.eleve_id)).limit(1);
  const [prononce] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms, role: utilisateursTable.role })
    .from(utilisateursTable).where(eq(utilisateursTable.id, s.prononce_par)).limit(1);
  const classeNom = await getClasseNomEleve(s.eleve_id);
  let incident = null;
  if (s.incident_id) {
    const [inc] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, s.incident_id)).limit(1);
    incident = inc ?? null;
  }
  return {
    ...s,
    eleve_nom: eleve?.nom ?? "",
    eleve_prenoms: eleve?.prenoms ?? "",
    eleve_matricule: eleve?.matricule ?? "",
    classe_nom: classeNom,
    prononce_par_nom: prononce?.nom ?? "",
    prononce_par_prenoms: prononce?.prenoms ?? "",
    prononce_par_role: prononce?.role ?? "",
    incident,
  };
}

/* ═══════════════════════ INCIDENTS ════════════════════════════ */

/* POST /api/incidents/signaler */
router.post("/incidents/signaler", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur", "educateur"].includes(user.role)) {
    res.status(403).json({ message: "Accès refusé." }); return;
  }
  const { eleve_id, type_incident, description, lieu, date_incident, heure_incident } =
    req.body as Record<string, string>;
  if (!eleve_id || !type_incident || !description || !date_incident) {
    res.status(400).json({ message: "Champs obligatoires : eleve_id, type_incident, description, date_incident." }); return;
  }
  const [eleve] = await db
    .select()
    .from(elevesTable)
    .where(and(eq(elevesTable.id, eleve_id), eq(elevesTable.etablissement_id, user.etablissement_id ?? "")))
    .limit(1);
  if (!eleve) { res.status(404).json({ message: "Élève introuvable dans cet établissement." }); return; }

  const [incident] = await db
    .insert(incidentsTable)
    .values({
      etablissement_id: user.etablissement_id ?? "",
      eleve_id,
      signale_par: user.id,
      type_incident: type_incident as "retard" | "insolence" | "bagarre" | "fraude" | "vandalisme" | "absenteisme" | "autre",
      description,
      lieu: lieu ?? null,
      date_incident,
      heure_incident: heure_incident ?? null,
      statut: "en_attente",
    })
    .returning();

  const adminId = await getCenseurOuDirecteur(user.etablissement_id ?? "");
  if (adminId && adminId !== user.id) {
    await creerNotification({
      etablissement_id: user.etablissement_id ?? "",
      destinataire_id: adminId,
      type: "incident_signale",
      titre: "Nouvel incident signalé",
      contenu: `${user.nom} a signalé un incident (${type_incident}) pour ${eleve.prenoms} ${eleve.nom}.`,
      lien: `/discipline/incidents/${incident.id}`,
    });
  }
  res.status(201).json({ success: true, message: "Incident signalé avec succès.", data: { incident } });
});

/* GET /api/incidents/statistiques */
router.get("/incidents/statistiques", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur"].includes(user.role)) {
    res.status(403).json({ message: "Accès refusé." }); return;
  }
  const isDev = user.role === "dev";
  const incidents = await db.select().from(incidentsTable)
    .where(isDev ? undefined : eq(incidentsTable.etablissement_id, user.etablissement_id!));

  const par_type: Record<string, number> = {};
  const par_mois: Record<string, number> = {};
  const eleveMap: Record<string, number> = {};
  for (const inc of incidents) {
    par_type[inc.type_incident] = (par_type[inc.type_incident] ?? 0) + 1;
    const mois = inc.date_incident.slice(0, 7);
    par_mois[mois] = (par_mois[mois] ?? 0) + 1;
    eleveMap[inc.eleve_id] = (eleveMap[inc.eleve_id] ?? 0) + 1;
  }

  const top10Ids = Object.entries(eleveMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const top_eleves = await Promise.all(top10Ids.map(async ([eleve_id, nb]) => {
    const [e] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, matricule: elevesTable.matricule })
      .from(elevesTable).where(eq(elevesTable.id, eleve_id)).limit(1);
    const classe_nom = await getClasseNomEleve(eleve_id);
    return { eleve_id, nom: e?.nom ?? "", prenoms: e?.prenoms ?? "", matricule: e?.matricule ?? "", classe_nom, nb_incidents: nb };
  }));

  const sanctions = await db.select().from(sanctionsTable)
    .where(isDev ? undefined : eq(sanctionsTable.etablissement_id, user.etablissement_id!));
  const sanctions_par_type: Record<string, number> = {};
  for (const s of sanctions) {
    sanctions_par_type[s.type_sanction] = (sanctions_par_type[s.type_sanction] ?? 0) + 1;
  }

  res.json({
    success: true,
    data: {
      total_incidents: incidents.length,
      par_type: Object.entries(par_type).map(([type, nb]) => ({ type, nb })),
      par_mois: Object.entries(par_mois).sort().map(([mois, nb]) => ({ mois, nb })),
      top_eleves,
      sanctions_par_type: Object.entries(sanctions_par_type).map(([type, nb]) => ({ type, nb })),
      sanctions_en_attente: sanctions.filter(s => s.statut === "en_attente").length,
    },
  });
});

/* GET /api/incidents/eleve/:eleveId/historique */
router.get("/incidents/eleve/:eleveId/historique", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur", "educateur"].includes(user.role)) {
    res.status(403).json({ message: "Accès refusé." }); return;
  }
  const eleveId = req.params["eleveId"] as string;
  const etabId = user.etablissement_id ?? "";

  const [eleve] = await db
    .select()
    .from(elevesTable)
    .where(and(eq(elevesTable.id, eleveId), eq(elevesTable.etablissement_id, etabId)))
    .limit(1);
  if (!eleve) { res.status(404).json({ message: "Élève introuvable." }); return; }

  const incidents = await db
    .select()
    .from(incidentsTable)
    .where(and(eq(incidentsTable.eleve_id, eleveId), eq(incidentsTable.etablissement_id, etabId)))
    .orderBy(desc(incidentsTable.date_incident));

  const sanctions = await db
    .select()
    .from(sanctionsTable)
    .where(and(eq(sanctionsTable.eleve_id, eleveId), eq(sanctionsTable.etablissement_id, etabId)))
    .orderBy(desc(sanctionsTable.date_sanction));

  const par_type: Record<string, number> = {};
  for (const inc of incidents) {
    par_type[inc.type_incident] = (par_type[inc.type_incident] ?? 0) + 1;
  }

  res.json({
    success: true,
    data: {
      eleve,
      incidents,
      sanctions,
      resume: {
        total_incidents: incidents.length,
        par_type: Object.entries(par_type).map(([type, nb]) => ({ type, nb })),
        total_sanctions: sanctions.length,
        sanctions_actives: sanctions.filter(s => s.statut !== "annulee").length,
      },
    },
  });
});

/* GET /api/incidents/liste */
router.get("/incidents/liste", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur", "educateur"].includes(user.role)) {
    res.status(403).json({ message: "Accès refusé." }); return;
  }
  const { eleve_id, type_incident, statut, date_debut, date_fin } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt((req.query["page"] as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query["limit"] as string) ?? "20", 10)));

  const conditions: ReturnType<typeof eq>[] = [];
  if (user.role !== "dev") {
    conditions.push(eq(incidentsTable.etablissement_id, user.etablissement_id ?? ""));
    if (user.role === "educateur") conditions.push(eq(incidentsTable.signale_par, user.id));
  }
  if (eleve_id) conditions.push(eq(incidentsTable.eleve_id, eleve_id));
  if (type_incident) conditions.push(eq(incidentsTable.type_incident, type_incident as "retard" | "insolence" | "bagarre" | "fraude" | "vandalisme" | "absenteisme" | "autre"));
  if (statut) conditions.push(eq(incidentsTable.statut, statut as "en_attente" | "traite" | "escalade"));
  if (date_debut) conditions.push(gte(incidentsTable.date_incident, date_debut));
  if (date_fin) conditions.push(lte(incidentsTable.date_incident, date_fin));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(incidentsTable).where(where);
  const rows = await db.select().from(incidentsTable).where(where)
    .orderBy(desc(incidentsTable.date_incident)).limit(limit).offset((page - 1) * limit);

  const incidents = await Promise.all(rows.map(enrichirIncident));
  res.json({ success: true, data: { incidents, total, page, limit } });
});

/* GET /api/incidents/:id */
router.get("/incidents/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = req.params["id"] as string;
  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, id)).limit(1);
  if (!incident) { res.status(404).json({ message: "Incident introuvable." }); return; }

  const allowed = ["dev", "directeur", "censeur"];
  const isAuthor = incident.signale_par === user.id;
  if (!allowed.includes(user.role) && !(user.role === "educateur" && isAuthor)) {
    res.status(403).json({ message: "Accès refusé." }); return;
  }
  res.json({ success: true, data: { incident: await enrichirIncident(incident) } });
});

/* PUT /api/incidents/:id/modifier */
router.put("/incidents/:id/modifier", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = req.params["id"] as string;
  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, id)).limit(1);
  if (!incident) { res.status(404).json({ message: "Incident introuvable." }); return; }
  if (incident.signale_par !== user.id) { res.status(403).json({ message: "Vous ne pouvez modifier que vos propres incidents." }); return; }
  if (incident.statut !== "en_attente") { res.status(400).json({ message: "Impossible de modifier un incident traité ou escaladé." }); return; }

  const { type_incident, description, lieu, date_incident, heure_incident } = req.body as Record<string, string>;
  const [updated] = await db
    .update(incidentsTable)
    .set({
      ...(type_incident ? { type_incident: type_incident as "retard" | "insolence" | "bagarre" | "fraude" | "vandalisme" | "absenteisme" | "autre" } : {}),
      ...(description ? { description } : {}),
      ...(lieu !== undefined ? { lieu } : {}),
      ...(date_incident ? { date_incident } : {}),
      ...(heure_incident !== undefined ? { heure_incident } : {}),
      updated_at: new Date(),
    })
    .where(eq(incidentsTable.id, id))
    .returning();
  res.json({ success: true, message: "Incident modifié.", data: { incident: updated } });
});

/* PUT /api/incidents/:id/escalader */
router.put("/incidents/:id/escalader", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["educateur", "censeur"].includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }

  const id = req.params["id"] as string;
  const { escalade_vers, motif_escalade } = req.body as Record<string, string>;
  if (!escalade_vers || !motif_escalade) { res.status(400).json({ message: "escalade_vers et motif_escalade requis." }); return; }

  const [dest] = await db.select().from(utilisateursTable).where(eq(utilisateursTable.id, escalade_vers)).limit(1);
  if (!dest || !["censeur", "directeur"].includes(dest.role)) {
    res.status(400).json({ message: "La personne ciblée doit être censeur ou directeur." }); return;
  }
  const [incident] = await db.select().from(incidentsTable).where(eq(incidentsTable.id, id)).limit(1);
  if (!incident) { res.status(404).json({ message: "Incident introuvable." }); return; }

  const [updated] = await db
    .update(incidentsTable)
    .set({ statut: "escalade", escalade_vers, motif_escalade, updated_at: new Date() })
    .where(eq(incidentsTable.id, id))
    .returning();

  const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
    .from(elevesTable).where(eq(elevesTable.id, incident.eleve_id)).limit(1);
  await creerNotification({
    etablissement_id: incident.etablissement_id,
    destinataire_id: escalade_vers,
    type: "incident_escalade",
    titre: "Incident escaladé",
    contenu: `Un incident (${incident.type_incident}) pour ${eleve?.prenoms} ${eleve?.nom} vous a été escaladé. Motif : ${motif_escalade}`,
    lien: `/discipline/incidents/${id}`,
  });
  res.json({ success: true, message: "Incident escaladé.", data: { incident: updated } });
});

/* PUT /api/incidents/:id/cloturer */
router.put("/incidents/:id/cloturer", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur"].includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }
  const id = req.params["id"] as string;
  const [updated] = await db
    .update(incidentsTable)
    .set({ statut: "traite", updated_at: new Date() })
    .where(and(eq(incidentsTable.id, id), eq(incidentsTable.etablissement_id, user.etablissement_id ?? "")))
    .returning();
  if (!updated) { res.status(404).json({ message: "Incident introuvable." }); return; }
  res.json({ success: true, message: "Incident clôturé.", data: { incident: updated } });
});

/* ═══════════════════════ SANCTIONS ════════════════════════════ */

/* POST /api/sanctions/prononcer */
router.post("/sanctions/prononcer", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur", "educateur"].includes(user.role)) {
    res.status(403).json({ message: "Accès refusé." }); return;
  }
  const {
    eleve_id, incident_id, type_sanction, description, date_sanction,
    duree_heures, date_execution, notifier_parent, observations,
  } = req.body as Record<string, string | boolean>;

  if (!eleve_id || !type_sanction || !date_sanction) {
    res.status(400).json({ message: "eleve_id, type_sanction et date_sanction requis." }); return;
  }
  const [eleve] = await db
    .select()
    .from(elevesTable)
    .where(and(eq(elevesTable.id, String(eleve_id)), eq(elevesTable.etablissement_id, user.etablissement_id ?? "")))
    .limit(1);
  if (!eleve) { res.status(404).json({ message: "Élève introuvable dans cet établissement." }); return; }

  const sanctionLourde = ["exclusion_temp", "exclusion_def", "convocation_parent"].includes(String(type_sanction));
  const demandeValidation = user.role === "educateur" && sanctionLourde;
  const statut = demandeValidation ? "en_attente" : "validee";

  const [sanction] = await db
    .insert(sanctionsTable)
    .values({
      etablissement_id: user.etablissement_id ?? "",
      incident_id: incident_id ? String(incident_id) : null,
      eleve_id: String(eleve_id),
      prononce_par: user.id,
      type_sanction: type_sanction as "avertissement_oral" | "avertissement_ecrit" | "retenue" | "exclusion_temp" | "exclusion_def" | "convocation_parent",
      description: description ? String(description) : null,
      date_sanction: String(date_sanction),
      duree_heures: duree_heures ? parseInt(String(duree_heures), 10) : null,
      date_execution: date_execution ? String(date_execution) : null,
      notifier_parent: notifier_parent !== false && notifier_parent !== "false",
      statut,
      observations: observations ? String(observations) : null,
    })
    .returning();

  if (demandeValidation) {
    const adminId = await getCenseurOuDirecteur(user.etablissement_id ?? "");
    if (adminId) {
      await creerNotification({
        etablissement_id: user.etablissement_id ?? "",
        destinataire_id: adminId,
        type: "sanction_en_attente",
        titre: "Sanction en attente de validation",
        contenu: `${user.nom} a prononcé une sanction (${type_sanction}) pour ${eleve.prenoms} ${eleve.nom}. Validation requise.`,
        lien: `/discipline/sanctions`,
      });
    }
  } else if (sanction.notifier_parent) {
    const parentId = await getParentEleve(String(eleve_id));
    if (parentId) {
      await creerNotification({
        etablissement_id: user.etablissement_id ?? "",
        destinataire_id: parentId,
        type: "sanction_validee",
        titre: "Sanction prononcée",
        contenu: `Une sanction (${type_sanction}) a été prononcée pour votre enfant ${eleve.prenoms} ${eleve.nom}.`,
        lien: `/absences-parent`,
      });
    }
  }
  res.status(201).json({ success: true, message: "Sanction prononcée.", data: { sanction } });
});

/* GET /api/sanctions/en-attente */
router.get("/sanctions/en-attente", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur"].includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }
  const rows = await db
    .select()
    .from(sanctionsTable)
    .where(user.role === "dev"
      ? eq(sanctionsTable.statut, "en_attente")
      : and(
          eq(sanctionsTable.etablissement_id, user.etablissement_id!),
          eq(sanctionsTable.statut, "en_attente"),
        )
    )
    .orderBy(sanctionsTable.date_sanction);
  const sanctions = await Promise.all(rows.map(enrichirSanction));
  res.json({ success: true, data: { sanctions, total: sanctions.length } });
});

/* GET /api/sanctions/liste */
router.get("/sanctions/liste", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur", "educateur"].includes(user.role)) {
    res.status(403).json({ message: "Accès refusé." }); return;
  }
  const { eleve_id, type_sanction, statut, date_debut, date_fin } = req.query as Record<string, string>;
  const page = Math.max(1, parseInt((req.query["page"] as string) ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query["limit"] as string) ?? "20", 10)));

  const conditions: ReturnType<typeof eq>[] = [];
  if (user.role !== "dev") {
    conditions.push(eq(sanctionsTable.etablissement_id, user.etablissement_id ?? ""));
    if (user.role === "educateur") conditions.push(eq(sanctionsTable.prononce_par, user.id));
  }
  if (eleve_id) conditions.push(eq(sanctionsTable.eleve_id, eleve_id));
  if (type_sanction) conditions.push(eq(sanctionsTable.type_sanction, type_sanction as "avertissement_oral" | "avertissement_ecrit" | "retenue" | "exclusion_temp" | "exclusion_def" | "convocation_parent"));
  if (statut) conditions.push(eq(sanctionsTable.statut, statut as "en_attente" | "validee" | "executee" | "annulee"));
  if (date_debut) conditions.push(gte(sanctionsTable.date_sanction, date_debut));
  if (date_fin) conditions.push(lte(sanctionsTable.date_sanction, date_fin));

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(sanctionsTable).where(where);
  const rows = await db.select().from(sanctionsTable).where(where)
    .orderBy(desc(sanctionsTable.date_sanction)).limit(limit).offset((page - 1) * limit);
  const sanctions = await Promise.all(rows.map(enrichirSanction));
  res.json({ success: true, data: { sanctions, total, page, limit } });
});

/* PUT /api/sanctions/:id/valider */
router.put("/sanctions/:id/valider", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur"].includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }
  const id = req.params["id"] as string;
  const [sanction] = await db.select().from(sanctionsTable)
    .where(and(eq(sanctionsTable.id, id), eq(sanctionsTable.etablissement_id, user.etablissement_id ?? ""))).limit(1);
  if (!sanction) { res.status(404).json({ message: "Sanction introuvable." }); return; }

  const [updated] = await db
    .update(sanctionsTable)
    .set({ statut: "validee", validee_par: user.id, date_validation: new Date(), updated_at: new Date() })
    .where(eq(sanctionsTable.id, id))
    .returning();

  if (sanction.prononce_par !== user.id) {
    await creerNotification({
      etablissement_id: sanction.etablissement_id,
      destinataire_id: sanction.prononce_par,
      type: "sanction_validee",
      titre: "Sanction validée",
      contenu: `Votre sanction (${sanction.type_sanction}) a été validée par l'administration.`,
      lien: `/discipline/sanctions`,
    });
  }
  if (sanction.notifier_parent) {
    const parentId = await getParentEleve(sanction.eleve_id);
    if (parentId) {
      const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
        .from(elevesTable).where(eq(elevesTable.id, sanction.eleve_id)).limit(1);
      await creerNotification({
        etablissement_id: sanction.etablissement_id,
        destinataire_id: parentId,
        type: "sanction_validee",
        titre: "Sanction prononcée pour votre enfant",
        contenu: `Une sanction (${sanction.type_sanction}) a été prononcée pour ${eleve?.prenoms} ${eleve?.nom}.`,
        lien: `/absences-parent`,
      });
    }
  }
  res.json({ success: true, message: "Sanction validée.", data: { sanction: updated } });
});

/* PUT /api/sanctions/:id/refuser */
router.put("/sanctions/:id/refuser", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur"].includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }
  const id = req.params["id"] as string;
  const [sanction] = await db.select().from(sanctionsTable)
    .where(and(eq(sanctionsTable.id, id), eq(sanctionsTable.etablissement_id, user.etablissement_id ?? ""))).limit(1);
  if (!sanction) { res.status(404).json({ message: "Sanction introuvable." }); return; }

  await db.update(sanctionsTable).set({ statut: "annulee", updated_at: new Date() }).where(eq(sanctionsTable.id, id));
  if (sanction.prononce_par !== user.id) {
    await creerNotification({
      etablissement_id: sanction.etablissement_id,
      destinataire_id: sanction.prononce_par,
      type: "sanction_refusee",
      titre: "Sanction refusée",
      contenu: `Votre sanction (${sanction.type_sanction}) a été refusée par l'administration.`,
      lien: `/discipline/sanctions`,
    });
  }
  res.json({ success: true, message: "Sanction refusée." });
});

/* PUT /api/sanctions/:id/executer */
router.put("/sanctions/:id/executer", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur", "censeur", "educateur"].includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }
  const id = req.params["id"] as string;
  const [updated] = await db
    .update(sanctionsTable)
    .set({ statut: "executee", updated_at: new Date() })
    .where(and(eq(sanctionsTable.id, id), eq(sanctionsTable.etablissement_id, user.etablissement_id ?? "")))
    .returning();
  if (!updated) { res.status(404).json({ message: "Sanction introuvable." }); return; }
  res.json({ success: true, message: "Sanction marquée comme exécutée.", data: { sanction: updated } });
});

/* PUT /api/sanctions/:id/annuler */
router.put("/sanctions/:id/annuler", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!["dev", "directeur"].includes(user.role)) { res.status(403).json({ message: "Accès refusé." }); return; }
  const id = req.params["id"] as string;
  const [sanction] = await db.select().from(sanctionsTable)
    .where(and(eq(sanctionsTable.id, id), eq(sanctionsTable.etablissement_id, user.etablissement_id ?? ""))).limit(1);
  if (!sanction) { res.status(404).json({ message: "Sanction introuvable." }); return; }

  await db.update(sanctionsTable).set({ statut: "annulee", updated_at: new Date() }).where(eq(sanctionsTable.id, id));
  if (sanction.notifier_parent) {
    const parentId = await getParentEleve(sanction.eleve_id);
    if (parentId) {
      const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
        .from(elevesTable).where(eq(elevesTable.id, sanction.eleve_id)).limit(1);
      await creerNotification({
        etablissement_id: sanction.etablissement_id,
        destinataire_id: parentId,
        type: "sanction_refusee",
        titre: "Sanction annulée",
        contenu: `La sanction (${sanction.type_sanction}) prononcée pour ${eleve?.prenoms} ${eleve?.nom} a été annulée.`,
        lien: `/absences-parent`,
      });
    }
  }
  res.json({ success: true, message: "Sanction annulée." });
});

export default router;
