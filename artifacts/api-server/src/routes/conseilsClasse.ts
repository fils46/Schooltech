import { Router } from "express";
import { eq, and, inArray } from "drizzle-orm";
import path from "path";
import fs from "fs";
import {
  db, conseilsClasseTable, classesTable, utilisateursTable,
  bulletinsTable, matieresConfigTable, bulletinDetailsTable,
  anneesScolairesTable, conseilParticipantsTable,
  conseilDeliberationsTable, conseilInterventionsTable,
  etablissementsTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { emitToConseil, emitNotification } from "../socket/socketManager";
import { generatePV } from "../lib/generatePV";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

const ROLES_ADMIN = ["dev", "directeur", "censeur"];

/* ── Helpers ──────────────────────────────────────────────── */

async function enrichirConseil(c: typeof conseilsClasseTable.$inferSelect) {
  const [classe] = await db
    .select({ nom: classesTable.nom })
    .from(classesTable)
    .where(eq(classesTable.id, c.classe_id))
    .limit(1);
  const [president] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, c.president_id))
    .limit(1);
  return {
    ...c,
    classe_nom: classe?.nom ?? null,
    president_nom: president ? `${president.prenoms} ${president.nom}` : null,
  };
}

async function enrichirParticipant(p: typeof conseilParticipantsTable.$inferSelect) {
  const [u] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, p.utilisateur_id))
    .limit(1);
  return {
    ...p,
    utilisateur_nom: u?.nom ?? "",
    utilisateur_prenoms: u?.prenoms ?? "",
  };
}

async function enrichirDeliberation(d: typeof conseilDeliberationsTable.$inferSelect) {
  const [eleve] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, d.eleve_id))
    .limit(1);
  return {
    ...d,
    eleve_nom: eleve?.nom ?? "",
    eleve_prenoms: eleve?.prenoms ?? "",
  };
}

async function enrichirIntervention(i: typeof conseilInterventionsTable.$inferSelect) {
  const [auteur] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, i.auteur_id))
    .limit(1);
  return {
    ...i,
    auteur_nom: auteur ? `${auteur.prenoms} ${auteur.nom}` : "",
  };
}

/* ─── POST /api/conseils/planifier ──────────────────────────── */
router.post(
  "/api/conseils/planifier",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const {
      classe_id, annee_scolaire_id, trimestre, date_conseil, president_id,
      heure_debut, heure_fin, ordre_du_jour,
      participants: participantsInput,
    } = req.body as Record<string, unknown>;

    if (!classe_id || !annee_scolaire_id || !trimestre || !date_conseil || !president_id) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const etabId = user.etablissement_id ?? "";

    const [existing] = await db
      .select()
      .from(conseilsClasseTable)
      .where(
        and(
          eq(conseilsClasseTable.classe_id, String(classe_id)),
          eq(conseilsClasseTable.annee_scolaire_id, String(annee_scolaire_id)),
          eq(conseilsClasseTable.trimestre, String(trimestre) as "1" | "2" | "3"),
          eq(conseilsClasseTable.etablissement_id, etabId)
        )
      )
      .limit(1);

    if (existing) {
      res.status(409).json({ message: "Un conseil de classe existe déjà pour cette classe et ce trimestre." });
      return;
    }

    const [conseil] = await db
      .insert(conseilsClasseTable)
      .values({
        etablissement_id: etabId,
        classe_id: String(classe_id),
        annee_scolaire_id: String(annee_scolaire_id),
        trimestre: String(trimestre) as "1" | "2" | "3",
        date_conseil: String(date_conseil),
        heure_debut: heure_debut ? String(heure_debut) : null,
        heure_fin: heure_fin ? String(heure_fin) : null,
        ordre_du_jour: ordre_du_jour ? String(ordre_du_jour) : null,
        president_id: String(president_id),
        statut: "planifie",
      })
      .returning();

    /* Créer les participants */
    if (Array.isArray(participantsInput) && participantsInput.length > 0) {
      const rows = (participantsInput as Array<{ utilisateur_id: string; role_conseil: string }>).map(p => ({
        conseil_id: conseil.id,
        utilisateur_id: p.utilisateur_id,
        role_conseil: p.role_conseil as typeof conseilParticipantsTable.$inferInsert["role_conseil"],
        convoque: true,
      }));
      await db.insert(conseilParticipantsTable).values(rows).onConflictDoNothing();
    }

    const enriched = await enrichirConseil(conseil);
    res.json({ conseil: enriched });
  }
);

/* ─── GET /api/conseils/liste ────────────────────────────────── */
router.get(
  "/api/conseils/liste",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const { classe_id, trimestre, statut, annee_scolaire_id } = req.query as Record<string, string>;

    const conditions = [];
    if (user.role !== "dev") {
      conditions.push(eq(conseilsClasseTable.etablissement_id, user.etablissement_id ?? ""));
    }
    if (classe_id)         conditions.push(eq(conseilsClasseTable.classe_id, classe_id));
    if (trimestre)         conditions.push(eq(conseilsClasseTable.trimestre, trimestre as "1" | "2" | "3"));
    if (statut)            conditions.push(eq(conseilsClasseTable.statut, statut as "planifie" | "en_cours" | "termine"));
    if (annee_scolaire_id) conditions.push(eq(conseilsClasseTable.annee_scolaire_id, annee_scolaire_id));

    const rows = await db
      .select()
      .from(conseilsClasseTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(conseilsClasseTable.date_conseil);

    const enriched = await Promise.all(rows.map(enrichirConseil));
    res.json({ conseils: enriched });
  }
);

/* ─── GET /api/conseils/:id ──────────────────────────────────── */
router.get(
  "/api/conseils/:id",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const [conseil] = await db
      .select()
      .from(conseilsClasseTable)
      .where(eq(conseilsClasseTable.id, id))
      .limit(1);

    if (!conseil) { res.status(404).json({ message: "Conseil introuvable." }); return; }
    res.json({ conseil: await enrichirConseil(conseil) });
  }
);

/* ─── PUT /api/conseils/:id/modifier ──────────────────────────── */
router.put(
  "/api/conseils/:id/modifier",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

    const id = normalizeId(req.params.id);
    const { date_conseil, heure_debut, heure_fin, ordre_du_jour, participants: participantsInput } =
      req.body as Record<string, unknown>;

    const [existing] = await db.select().from(conseilsClasseTable).where(eq(conseilsClasseTable.id, id)).limit(1);
    if (!existing) { res.status(404).json({ message: "Conseil introuvable." }); return; }
    if (existing.statut !== "planifie") { res.status(400).json({ message: "Seul un conseil planifié peut être modifié." }); return; }

    const updates: Partial<typeof conseilsClasseTable.$inferInsert> = { updated_at: new Date() };
    if (date_conseil)  updates.date_conseil  = String(date_conseil);
    if (heure_debut)   updates.heure_debut   = String(heure_debut);
    if (heure_fin)     updates.heure_fin     = String(heure_fin);
    if (ordre_du_jour !== undefined) updates.ordre_du_jour = String(ordre_du_jour);

    const [updated] = await db.update(conseilsClasseTable).set(updates).where(eq(conseilsClasseTable.id, id)).returning();

    if (Array.isArray(participantsInput)) {
      await db.delete(conseilParticipantsTable).where(eq(conseilParticipantsTable.conseil_id, id));
      if (participantsInput.length > 0) {
        const rows = (participantsInput as Array<{ utilisateur_id: string; role_conseil: string }>).map(p => ({
          conseil_id: id,
          utilisateur_id: p.utilisateur_id,
          role_conseil: p.role_conseil as typeof conseilParticipantsTable.$inferInsert["role_conseil"],
          convoque: true,
        }));
        await db.insert(conseilParticipantsTable).values(rows);
      }
    }

    res.json({ conseil: await enrichirConseil(updated) });
  }
);

/* ─── POST /api/conseils/:id/convoquer ─────────────────────── */
router.post(
  "/api/conseils/:id/convoquer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

    const id = normalizeId(req.params.id);
    const [conseil] = await db.select().from(conseilsClasseTable).where(eq(conseilsClasseTable.id, id)).limit(1);
    if (!conseil) { res.status(404).json({ message: "Conseil introuvable." }); return; }

    const [classeRow] = await db.select({ nom: classesTable.nom }).from(classesTable).where(eq(classesTable.id, conseil.classe_id)).limit(1);
    const participants = await db.select().from(conseilParticipantsTable).where(eq(conseilParticipantsTable.conseil_id, id));

    let envoyes = 0;
    for (const p of participants) {
      await emitNotification(p.utilisateur_id, {
        id: `convoc_${id}_${p.utilisateur_id}`,
        type: "convocation_conseil",
        titre: "Convocation — Conseil de classe",
        contenu: `Vous êtes convoqué(e) au conseil de classe de ${classeRow?.nom ?? "la classe"} le ${conseil.date_conseil}${conseil.heure_debut ? ` à ${conseil.heure_debut}` : ""}.`,
        lien: `/conseils-classe/salle/${id}`,
        created_at: new Date(),
      });
      envoyes++;
    }

    await db.update(conseilParticipantsTable)
      .set({ convocation_envoyee: true })
      .where(eq(conseilParticipantsTable.conseil_id, id));

    await db.update(conseilsClasseTable)
      .set({ convocations_envoyees: true, updated_at: new Date() })
      .where(eq(conseilsClasseTable.id, id));

    res.json({ message: "Convocations envoyées.", envoyes });
  }
);

/* ─── PUT /api/conseils/:id/presence ───────────────────────── */
router.put(
  "/api/conseils/:id/presence",
  authMiddleware,
  async (req, res) => {
    const user = req.user!;
    const id = normalizeId(req.params.id);

    const [participant] = await db
      .select()
      .from(conseilParticipantsTable)
      .where(and(eq(conseilParticipantsTable.conseil_id, id), eq(conseilParticipantsTable.utilisateur_id, user.id)))
      .limit(1);

    if (!participant) { res.status(404).json({ message: "Vous n'êtes pas participant de ce conseil." }); return; }

    const now = new Date();
    const heure = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    await db.update(conseilParticipantsTable)
      .set({ present: true, heure_arrivee: heure, updated_at: new Date() })
      .where(eq(conseilParticipantsTable.id, participant.id));

    emitToConseil(id, "presence_confirmee", { utilisateur_id: user.id, heure_arrivee: heure });
    res.json({ message: "Présence confirmée." });
  }
);

/* ─── GET /api/conseils/:id/en-cours ───────────────────────── */
router.get(
  "/api/conseils/:id/en-cours",
  authMiddleware,
  async (req, res) => {
    const id = normalizeId(req.params.id);

    const [conseil] = await db.select().from(conseilsClasseTable).where(eq(conseilsClasseTable.id, id)).limit(1);
    if (!conseil) { res.status(404).json({ message: "Conseil introuvable." }); return; }

    const [participants, deliberations, interventions] = await Promise.all([
      db.select().from(conseilParticipantsTable).where(eq(conseilParticipantsTable.conseil_id, id)),
      db.select().from(conseilDeliberationsTable).where(eq(conseilDeliberationsTable.conseil_id, id)),
      db.select().from(conseilInterventionsTable).where(eq(conseilInterventionsTable.conseil_id, id)).orderBy(conseilInterventionsTable.created_at),
    ]);

    const [enrichedConseil, enrichedParticipants, enrichedDelibs, enrichedInterventions] = await Promise.all([
      enrichirConseil(conseil),
      Promise.all(participants.map(enrichirParticipant)),
      Promise.all(deliberations.map(enrichirDeliberation)),
      Promise.all(interventions.map(enrichirIntervention)),
    ]);

    res.json({ conseil: enrichedConseil, participants: enrichedParticipants, deliberations: enrichedDelibs, interventions: enrichedInterventions });
  }
);

/* ─── PUT /api/conseils/:id/demarrer ────────────────────────── */
router.put(
  "/api/conseils/:id/demarrer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

    const id = normalizeId(req.params.id);
    const [existing] = await db.select().from(conseilsClasseTable).where(eq(conseilsClasseTable.id, id)).limit(1);
    if (!existing)                       { res.status(404).json({ message: "Conseil introuvable." }); return; }
    if (existing.statut !== "planifie")  { res.status(400).json({ message: "Le conseil doit être planifié pour être démarré." }); return; }

    const [updated] = await db
      .update(conseilsClasseTable)
      .set({ statut: "en_cours", updated_at: new Date() })
      .where(eq(conseilsClasseTable.id, id))
      .returning();

    emitToConseil(id, "conseil_demarre", { conseil_id: id });

    /* Notifier les participants */
    const participants = await db.select().from(conseilParticipantsTable).where(eq(conseilParticipantsTable.conseil_id, id));
    for (const p of participants) {
      await emitNotification(p.utilisateur_id, {
        id: `demarre_${id}_${p.utilisateur_id}`,
        type: "conseil_demarre",
        titre: "Conseil de classe démarré",
        contenu: "La séance du conseil de classe vient de commencer.",
        lien: `/conseils-classe/salle/${id}`,
        created_at: new Date(),
      });
    }

    res.json({ conseil: await enrichirConseil(updated) });
  }
);

/* ─── PUT /api/conseils/:id/terminer ────────────────────────── */
router.put(
  "/api/conseils/:id/terminer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

    const id = normalizeId(req.params.id);
    const { observations_generales } = req.body as { observations_generales?: string };

    const [existing] = await db.select().from(conseilsClasseTable).where(eq(conseilsClasseTable.id, id)).limit(1);
    if (!existing)                      { res.status(404).json({ message: "Conseil introuvable." }); return; }
    if (existing.statut === "termine")  { res.status(400).json({ message: "Le conseil est déjà terminé." }); return; }

    const [updated] = await db
      .update(conseilsClasseTable)
      .set({ statut: "termine", observations_generales: observations_generales ?? existing.observations_generales, updated_at: new Date() })
      .where(eq(conseilsClasseTable.id, id))
      .returning();

    /* Synchroniser décisions → bulletins */
    const deliberations = await db.select().from(conseilDeliberationsTable).where(eq(conseilDeliberationsTable.conseil_id, id));
    for (const d of deliberations) {
      const DECISIONS_BULLETIN = ["passage","redoublement","exclusion","orientation"];
      const decision = d.decision && DECISIONS_BULLETIN.includes(d.decision)
        ? (d.decision as "passage" | "redoublement" | "exclusion" | "orientation")
        : null;
      await db.update(bulletinsTable)
        .set({
          decision_conseil: decision,
          appreciation_conseil: d.appreciation_generale ?? undefined,
          updated_at: new Date(),
        })
        .where(and(
          eq(bulletinsTable.eleve_id, d.eleve_id),
          eq(bulletinsTable.classe_id, existing.classe_id),
          eq(bulletinsTable.annee_scolaire_id, existing.annee_scolaire_id),
          eq(bulletinsTable.trimestre, existing.trimestre),
        ));
    }

    /* Recalcul rangs bulletins */
    const bulletins = await db.select().from(bulletinsTable).where(
      and(
        eq(bulletinsTable.classe_id, existing.classe_id),
        eq(bulletinsTable.annee_scolaire_id, existing.annee_scolaire_id),
        eq(bulletinsTable.trimestre, existing.trimestre),
      )
    );
    if (bulletins.length > 0) {
      const sorted = [...bulletins].filter(b => b.moyenne_generale !== null)
        .sort((a, b) => Number(b.moyenne_generale) - Number(a.moyenne_generale));
      let rang = 1;
      for (let i = 0; i < sorted.length; i++) {
        const moy = Number(sorted[i].moyenne_generale);
        if (i > 0 && moy < Number(sorted[i - 1].moyenne_generale)) rang = i + 1;
        await db.update(bulletinsTable).set({ rang, effectif_classe: bulletins.length, updated_at: new Date() }).where(eq(bulletinsTable.id, sorted[i].id));
      }
    }

    emitToConseil(id, "conseil_termine", { conseil_id: id });
    res.json({ conseil: await enrichirConseil(updated) });
  }
);

/* ─── PUT /api/conseils/:id/deliberation ───────────────────── */
router.put(
  "/api/conseils/:id/deliberation",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

    const id = normalizeId(req.params.id);
    const { eleve_id, appreciation_generale, decision, mention_honneur, observations } =
      req.body as {
        eleve_id: string;
        appreciation_generale?: string;
        decision?: string;
        mention_honneur?: boolean;
        observations?: string;
      };

    if (!eleve_id) { res.status(400).json({ message: "eleve_id requis." }); return; }

    const [conseil] = await db.select().from(conseilsClasseTable).where(eq(conseilsClasseTable.id, id)).limit(1);
    if (!conseil || conseil.statut !== "en_cours") { res.status(400).json({ message: "Le conseil doit être en cours." }); return; }

    /* Récupérer la moyenne depuis le bulletin */
    const [bulletin] = await db.select().from(bulletinsTable).where(
      and(
        eq(bulletinsTable.eleve_id, eleve_id),
        eq(bulletinsTable.classe_id, conseil.classe_id),
        eq(bulletinsTable.annee_scolaire_id, conseil.annee_scolaire_id),
        eq(bulletinsTable.trimestre, conseil.trimestre),
      )
    ).limit(1);

    const validDecisions = ["passage","redoublement","exclusion","orientation","felicitations","encouragements","avertissement","blame"];
    const cleanDecision = decision && validDecisions.includes(decision)
      ? (decision as typeof conseilDeliberationsTable.$inferInsert["decision"])
      : null;

    const values = {
      conseil_id: id,
      eleve_id,
      moyenne_generale: bulletin?.moyenne_generale ?? null,
      rang: bulletin?.rang ?? null,
      appreciation_generale: appreciation_generale ?? null,
      decision: cleanDecision,
      mention_honneur: mention_honneur ?? false,
      observations: observations ?? null,
      saisi_par: user.id,
      updated_at: new Date(),
    };

    const [delib] = await db
      .insert(conseilDeliberationsTable)
      .values({ ...values, created_at: new Date() })
      .onConflictDoUpdate({
        target: [conseilDeliberationsTable.conseil_id, conseilDeliberationsTable.eleve_id],
        set: values,
      })
      .returning();

    const enriched = await enrichirDeliberation(delib);
    emitToConseil(id, "deliberation_maj", { deliberation: enriched });
    res.json({ deliberation: enriched });
  }
);

/* ─── POST /api/conseils/:id/intervention ──────────────────── */
router.post(
  "/api/conseils/:id/intervention",
  authMiddleware,
  async (req, res) => {
    const user = req.user!;
    const id = normalizeId(req.params.id);
    const { eleve_id, contenu, type } = req.body as { eleve_id?: string; contenu: string; type: string };

    if (!contenu?.trim() || !type) { res.status(400).json({ message: "Contenu et type requis." }); return; }

    const validTypes = ["observation","decision","question","reponse","general"];
    if (!validTypes.includes(type)) { res.status(400).json({ message: "Type invalide." }); return; }

    const [intervention] = await db
      .insert(conseilInterventionsTable)
      .values({
        conseil_id: id,
        eleve_id: eleve_id ?? null,
        auteur_id: user.id,
        contenu: contenu.trim(),
        type: type as typeof conseilInterventionsTable.$inferInsert["type"],
      })
      .returning();

    const enriched = await enrichirIntervention(intervention);
    emitToConseil(id, "intervention_ajoutee", { intervention: enriched });
    res.status(201).json({ intervention: enriched });
  }
);

/* ─── GET /api/conseils/:id/deliberations ──────────────────── */
router.get(
  "/api/conseils/:id/deliberations",
  authMiddleware,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const rows = await db.select().from(conseilDeliberationsTable).where(eq(conseilDeliberationsTable.conseil_id, id));
    const enriched = await Promise.all(rows.map(enrichirDeliberation));
    res.json({ deliberations: enriched });
  }
);

/* ─── GET /api/conseils/:id/participants ───────────────────── */
router.get(
  "/api/conseils/:id/participants",
  authMiddleware,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const rows = await db.select().from(conseilParticipantsTable).where(eq(conseilParticipantsTable.conseil_id, id));
    const enriched = await Promise.all(rows.map(enrichirParticipant));
    res.json({ participants: enriched });
  }
);

/* ─── POST /api/conseils/:id/generer-pv ────────────────────── */
router.post(
  "/api/conseils/:id/generer-pv",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

    const id = normalizeId(req.params.id);
    const [conseil] = await db.select().from(conseilsClasseTable).where(eq(conseilsClasseTable.id, id)).limit(1);
    if (!conseil) { res.status(404).json({ message: "Conseil introuvable." }); return; }

    const [participants, deliberations] = await Promise.all([
      db.select().from(conseilParticipantsTable).where(eq(conseilParticipantsTable.conseil_id, id)),
      db.select().from(conseilDeliberationsTable).where(eq(conseilDeliberationsTable.conseil_id, id)),
    ]);

    const [enrichedConseil, enrichedParticipants, enrichedDelibs] = await Promise.all([
      enrichirConseil(conseil),
      Promise.all(participants.map(enrichirParticipant)),
      Promise.all(deliberations.map(enrichirDeliberation)),
    ]);

    let etablissementNom = "Établissement";
    let etablissementInfo = null;
    try {
      const [etab] = await db.select({
        nom: etablissementsTable.nom,
        type: etablissementsTable.type,
        ville: etablissementsTable.ville,
        telephone: etablissementsTable.telephone,
        email: etablissementsTable.email,
        adresse: etablissementsTable.adresse,
        email_contact: etablissementsTable.email_contact,
        bp: etablissementsTable.bp,
        site_web: etablissementsTable.site_web,
        devise: etablissementsTable.devise,
        logo_path: etablissementsTable.logo_path,
        cachet_path: etablissementsTable.cachet_path,
        signature_directeur_path: etablissementsTable.signature_directeur_path,
      }).from(etablissementsTable).where(eq(etablissementsTable.id, conseil.etablissement_id)).limit(1);
      if (etab) {
        etablissementNom = etab.nom;
        etablissementInfo = etab;
      }
    } catch {}

    const pdfBuffer = await generatePV({
      conseil: { ...enrichedConseil, etablissement_nom: etablissementNom },
      etablissement: etablissementInfo,
      deliberations: enrichedDelibs.map(d => ({
        eleve_nom:    d.eleve_nom,
        eleve_prenoms: d.eleve_prenoms,
        rang:         d.rang,
        moyenne_generale: d.moyenne_generale ?? null,
        nb_absences:  d.nb_absences,
        decision:     d.decision,
        mention_honneur: d.mention_honneur,
        observations: d.observations,
        appreciation_generale: d.appreciation_generale,
      })),
      participants: enrichedParticipants.map(p => ({
        utilisateur_nom:    p.utilisateur_nom,
        utilisateur_prenoms: p.utilisateur_prenoms,
        role_conseil: p.role_conseil,
        present: p.present,
      })),
    });

    /* Sauvegarder le PDF */
    const pvDir = path.join(process.cwd(), "public", "pvs");
    fs.mkdirSync(pvDir, { recursive: true });
    const filename = `pv_${id}.pdf`;
    fs.writeFileSync(path.join(pvDir, filename), pdfBuffer);

    const pv_url = `/api/pvs/${filename}`;

    const [updated] = await db
      .update(conseilsClasseTable)
      .set({ pv_genere: true, pv_url, updated_at: new Date() })
      .where(eq(conseilsClasseTable.id, id))
      .returning();

    emitToConseil(id, "pv_genere", { pv_url });
    res.json({ pv_url, conseil: await enrichirConseil(updated) });
  }
);

/* ─── PUT /api/conseils/:id/signer-pv ──────────────────────── */
router.put(
  "/api/conseils/:id/signer-pv",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

    const id = normalizeId(req.params.id);
    const [existing] = await db.select().from(conseilsClasseTable).where(eq(conseilsClasseTable.id, id)).limit(1);
    if (!existing)           { res.status(404).json({ message: "Conseil introuvable." }); return; }
    if (!existing.pv_genere) { res.status(400).json({ message: "Le PV doit d'abord être généré." }); return; }

    const now = new Date();
    const dateSignature = now.toLocaleDateString("fr-FR");

    const [updated] = await db
      .update(conseilsClasseTable)
      .set({ pv_signe_par: user.id, pv_date_signature: dateSignature, updated_at: new Date() })
      .where(eq(conseilsClasseTable.id, id))
      .returning();

    res.json({ conseil: await enrichirConseil(updated) });
  }
);

export default router;
