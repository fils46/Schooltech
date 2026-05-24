import { Router } from "express";
import { eq, and, desc, count, sql, gte, lte, or } from "drizzle-orm";
import {
  db,
  dossiersMedicauxTable,
  consultationsInfirmerieTable,
  stocksInfirmerieTable,
  mouvementsStocksTable,
  utilisateursTable,
  elevesTable,
  parentsElevesTable,
  eleveClassesTable,
  classesTable,
  notificationsTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { emitNotification } from "../socket/socketManager";

const router = Router();
const INFIRMERIE = ["dev", "directeur", "censeur", "infirmier"];
const ADMINS = ["dev", "directeur", "censeur"];
const INFIRMIER_ONLY = ["dev", "infirmier"];
const STOCKS_ACCESS = ["dev", "directeur", "infirmier"];

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0]! : v;
}

/* ── Helpers ─────────────────────────────────────────────────────── */
async function getClasseNomForEleve(eleveId: string): Promise<string | null> {
  const [ec] = await db
    .select({ nom: classesTable.nom })
    .from(eleveClassesTable)
    .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
    .where(eq(eleveClassesTable.eleve_id, eleveId))
    .orderBy(desc(eleveClassesTable.created_at))
    .limit(1);
  return ec?.nom ?? null;
}

async function enrichConsultation(c: typeof consultationsInfirmerieTable.$inferSelect) {
  const [eleve] = await db
    .select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, photo_url: elevesTable.photo_url })
    .from(elevesTable)
    .where(eq(elevesTable.id, c.eleve_id))
    .limit(1);
  const [infirmier] = await db
    .select({ nom: utilisateursTable.nom })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, c.infirmier_id))
    .limit(1);
  const classeNom = await getClasseNomForEleve(c.eleve_id);
  return {
    ...c,
    eleve_nom: eleve?.nom ?? null,
    eleve_prenoms: eleve?.prenoms ?? null,
    eleve_photo: eleve?.photo_url ?? null,
    classe_nom: classeNom,
    infirmier_nom: infirmier?.nom ?? null,
  };
}

function getStatutStock(quantite: number, seuil: number): string {
  if (quantite === 0) return "rupture";
  if (quantite <= seuil) return "alerte";
  return "ok";
}

/* ═══════════════════════════════════════════════════════════════════
   DOSSIERS MÉDICAUX
   ═══════════════════════════════════════════════════════════════════ */

/* GET /infirmerie/dossier/:eleveId */
router.get(
  "/infirmerie/dossier/:eleveId",
  authMiddleware,
  verifierLicence,
  requireRole(...INFIRMERIE),
  async (req, res) => {
    const user = req.user!;
    const eleveId = normalizeId(req.params["eleveId"]!);

    const [eleve] = await db
      .select()
      .from(elevesTable)
      .where(
        and(
          eq(elevesTable.id, eleveId),
          user.role !== "dev" ? eq(elevesTable.etablissement_id, user.etablissement_id!) : undefined,
        ),
      )
      .limit(1);

    if (!eleve) {
      res.status(404).json({ message: "Élève introuvable." });
      return;
    }

    let [dossier] = await db
      .select()
      .from(dossiersMedicauxTable)
      .where(eq(dossiersMedicauxTable.eleve_id, eleveId))
      .limit(1);

    if (!dossier) {
      [dossier] = await db
        .insert(dossiersMedicauxTable)
        .values({
          eleve_id: eleveId,
          etablissement_id: eleve.etablissement_id,
          allergies: [],
        })
        .returning();
    }

    const classeNom = await getClasseNomForEleve(eleveId);

    res.json({
      dossier,
      eleve: {
        id: eleve.id,
        nom: eleve.nom,
        prenoms: eleve.prenoms,
        matricule: eleve.matricule,
        photo_url: eleve.photo_url,
        classe_nom: classeNom,
      },
    });
  },
);

/* PUT /infirmerie/dossier/:eleveId */
router.put(
  "/infirmerie/dossier/:eleveId",
  authMiddleware,
  verifierLicence,
  requireRole(...INFIRMIER_ONLY),
  async (req, res) => {
    const user = req.user!;
    const eleveId = normalizeId(req.params["eleveId"]!);

    const [eleve] = await db
      .select()
      .from(elevesTable)
      .where(
        and(
          eq(elevesTable.id, eleveId),
          user.role !== "dev" ? eq(elevesTable.etablissement_id, user.etablissement_id!) : undefined,
        ),
      )
      .limit(1);

    if (!eleve) {
      res.status(404).json({ message: "Élève introuvable." });
      return;
    }

    const {
      groupe_sanguin,
      allergies,
      antecedents,
      medicaments_autorises,
      medicaments_interdits,
      medecin_nom,
      medecin_contact,
      assurance_nom,
      assurance_numero,
      contact_urgence_nom,
      contact_urgence_tel,
      contact_urgence_lien,
      observations_generales,
    } = req.body as Record<string, unknown>;

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };
    if (groupe_sanguin !== undefined) updateData["groupe_sanguin"] = groupe_sanguin;
    if (allergies !== undefined) updateData["allergies"] = allergies;
    if (antecedents !== undefined) updateData["antecedents"] = antecedents;
    if (medicaments_autorises !== undefined) updateData["medicaments_autorises"] = medicaments_autorises;
    if (medicaments_interdits !== undefined) updateData["medicaments_interdits"] = medicaments_interdits;
    if (medecin_nom !== undefined) updateData["medecin_nom"] = medecin_nom;
    if (medecin_contact !== undefined) updateData["medecin_contact"] = medecin_contact;
    if (assurance_nom !== undefined) updateData["assurance_nom"] = assurance_nom;
    if (assurance_numero !== undefined) updateData["assurance_numero"] = assurance_numero;
    if (contact_urgence_nom !== undefined) updateData["contact_urgence_nom"] = contact_urgence_nom;
    if (contact_urgence_tel !== undefined) updateData["contact_urgence_tel"] = contact_urgence_tel;
    if (contact_urgence_lien !== undefined) updateData["contact_urgence_lien"] = contact_urgence_lien;
    if (observations_generales !== undefined) updateData["observations_generales"] = observations_generales;

    let [dossier] = await db
      .select({ id: dossiersMedicauxTable.id })
      .from(dossiersMedicauxTable)
      .where(eq(dossiersMedicauxTable.eleve_id, eleveId))
      .limit(1);

    if (!dossier) {
      [dossier] = await db
        .insert(dossiersMedicauxTable)
        .values({
          eleve_id: eleveId,
          etablissement_id: eleve.etablissement_id,
          allergies: [],
          ...updateData,
        })
        .returning({ id: dossiersMedicauxTable.id });
    } else {
      await db
        .update(dossiersMedicauxTable)
        .set(updateData)
        .where(eq(dossiersMedicauxTable.id, dossier.id));
    }

    const [updated] = await db
      .select()
      .from(dossiersMedicauxTable)
      .where(eq(dossiersMedicauxTable.eleve_id, eleveId))
      .limit(1);

    const classeNom = await getClasseNomForEleve(eleveId);

    res.json({
      dossier: updated,
      eleve: {
        id: eleve.id,
        nom: eleve.nom,
        prenoms: eleve.prenoms,
        matricule: eleve.matricule,
        photo_url: eleve.photo_url,
        classe_nom: classeNom,
      },
    });
  },
);

/* ═══════════════════════════════════════════════════════════════════
   CONSULTATIONS
   ═══════════════════════════════════════════════════════════════════ */

/* GET /infirmerie/consultations */
router.get(
  "/infirmerie/consultations",
  authMiddleware,
  verifierLicence,
  requireRole(...INFIRMERIE),
  async (req, res) => {
    const user = req.user!;
    const {
      eleve_id,
      statut,
      date_debut,
      date_fin,
    } = req.query as Record<string, string>;

    const page = Math.max(1, parseInt((req.query["page"] as string) || "1", 10));
    const limit = Math.min(50, parseInt((req.query["limit"] as string) || "20", 10));
    const offset = (page - 1) * limit;

    const conditions = [];
    if (user.role !== "dev") {
      conditions.push(eq(consultationsInfirmerieTable.etablissement_id, user.etablissement_id!));
    }
    if (eleve_id) conditions.push(eq(consultationsInfirmerieTable.eleve_id, eleve_id));
    if (statut && statut !== "tous") {
      conditions.push(eq(consultationsInfirmerieTable.statut, statut as "en_cours" | "termine" | "renvoye_domicile" | "hospitalise"));
    }
    if (date_debut) conditions.push(gte(consultationsInfirmerieTable.heure_entree, new Date(date_debut)));
    if (date_fin) conditions.push(lte(consultationsInfirmerieTable.heure_entree, new Date(date_fin)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalRow] = await db
      .select({ n: count() })
      .from(consultationsInfirmerieTable)
      .where(where);

    const rows = await db
      .select()
      .from(consultationsInfirmerieTable)
      .where(where)
      .orderBy(desc(consultationsInfirmerieTable.heure_entree))
      .limit(limit)
      .offset(offset);

    const consultations = await Promise.all(rows.map(enrichConsultation));

    res.json({
      consultations,
      total: totalRow?.n ?? 0,
      page,
      totalPages: Math.ceil((totalRow?.n ?? 0) / limit),
    });
  },
);

/* POST /infirmerie/consultations */
router.post(
  "/infirmerie/consultations",
  authMiddleware,
  verifierLicence,
  requireRole(...INFIRMIER_ONLY),
  async (req, res) => {
    const user = req.user!;
    const { eleve_id, motif, symptomes, heure_entree } = req.body as {
      eleve_id: string;
      motif: string;
      symptomes?: string;
      heure_entree: string;
    };

    if (!eleve_id || !motif || !heure_entree) {
      res.status(400).json({ message: "Champs obligatoires : eleve_id, motif, heure_entree." });
      return;
    }

    const [eleve] = await db
      .select()
      .from(elevesTable)
      .where(
        and(
          eq(elevesTable.id, eleve_id),
          user.role !== "dev" ? eq(elevesTable.etablissement_id, user.etablissement_id!) : undefined,
        ),
      )
      .limit(1);

    if (!eleve) {
      res.status(404).json({ message: "Élève introuvable." });
      return;
    }

    const [consultationEnCours] = await db
      .select({ id: consultationsInfirmerieTable.id })
      .from(consultationsInfirmerieTable)
      .where(
        and(
          eq(consultationsInfirmerieTable.eleve_id, eleve_id),
          eq(consultationsInfirmerieTable.statut, "en_cours"),
        ),
      )
      .limit(1);

    if (consultationEnCours) {
      res.status(409).json({ message: "Cet élève a déjà une consultation en cours." });
      return;
    }

    const etabId = user.role === "dev" ? eleve.etablissement_id : user.etablissement_id!;

    const [consultation] = await db
      .insert(consultationsInfirmerieTable)
      .values({
        etablissement_id: etabId,
        eleve_id,
        infirmier_id: user.id,
        motif,
        symptomes: symptomes ?? null,
        heure_entree: new Date(heure_entree),
        statut: "en_cours",
        parent_notifie: false,
      })
      .returning();

    const parents = await db
      .select({ utilisateur_id: parentsElevesTable.utilisateur_id })
      .from(parentsElevesTable)
      .where(eq(parentsElevesTable.eleve_id, eleve_id));

    let parentNotifie = false;
    for (const parent of parents) {
      try {
        const [notif] = await db
          .insert(notificationsTable)
          .values({
            etablissement_id: etabId,
            destinataire_id: parent.utilisateur_id,
            titre: "Consultation infirmerie ouverte",
            contenu: `Votre enfant ${eleve.nom} ${eleve.prenoms} est actuellement pris(e) en charge à l'infirmerie. Motif : ${motif}.`,
            type: "message",
            lu: false,
          })
          .returning();
        await emitNotification(parent.utilisateur_id, {
          id: notif!.id,
          titre: notif!.titre,
          contenu: notif!.contenu,
          type: notif!.type,
          lien: notif!.lien ?? undefined,
          created_at: notif!.created_at,
        });
        parentNotifie = true;
      } catch {
        req.log.warn({ parentId: parent.utilisateur_id }, "Erreur notification parent à l'ouverture consultation");
      }
    }

    if (parentNotifie) {
      await db
        .update(consultationsInfirmerieTable)
        .set({ parent_notifie: true })
        .where(eq(consultationsInfirmerieTable.id, consultation!.id));
      consultation!.parent_notifie = true;
    }

    const enriched = await enrichConsultation(consultation!);
    const dossierResume = await buildDossierResume(eleve_id);

    res.status(201).json({ consultation: enriched, dossier_resume: dossierResume });
  },
);

/* GET /infirmerie/consultations/:id */
router.get(
  "/infirmerie/consultations/:id",
  authMiddleware,
  verifierLicence,
  requireRole(...INFIRMERIE), 
  async (req, res) => {
    const user = req.user!;
    const id = normalizeId(req.params["id"]!);

    const conditions = [eq(consultationsInfirmerieTable.id, id)];
    if (user.role !== "dev") {
      conditions.push(eq(consultationsInfirmerieTable.etablissement_id, user.etablissement_id!));
    }

    const [consultation] = await db
      .select()
      .from(consultationsInfirmerieTable)
      .where(and(...conditions))
      .limit(1);

    if (!consultation) {
      res.status(404).json({ message: "Consultation introuvable." });
      return;
    }

    const enriched = await enrichConsultation(consultation);
    const dossierResume = await buildDossierResume(consultation.eleve_id);

    res.json({ consultation: enriched, dossier_resume: dossierResume });
  },
);

/* PUT /infirmerie/consultations/:id */
router.put(
  "/infirmerie/consultations/:id",
  authMiddleware,
  verifierLicence,
  requireRole(...INFIRMIER_ONLY),
  async (req, res) => {
    const user = req.user!;
    const id = normalizeId(req.params["id"]!);

    const conditions = [eq(consultationsInfirmerieTable.id, id)];
    if (user.role !== "dev") {
      conditions.push(eq(consultationsInfirmerieTable.etablissement_id, user.etablissement_id!));
    }

    const [existing] = await db
      .select()
      .from(consultationsInfirmerieTable)
      .where(and(...conditions))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Consultation introuvable." });
      return;
    }

    const {
      symptomes,
      traitement_administre,
      medicaments_donnes,
      observations,
      statut,
      heure_sortie,
    } = req.body as Record<string, string>;

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (symptomes !== undefined) updateData["symptomes"] = symptomes;
    if (traitement_administre !== undefined) updateData["traitement_administre"] = traitement_administre;
    if (medicaments_donnes !== undefined) updateData["medicaments_donnes"] = medicaments_donnes;
    if (observations !== undefined) updateData["observations"] = observations;
    if (statut !== undefined) updateData["statut"] = statut;
    if (heure_sortie !== undefined) updateData["heure_sortie"] = new Date(heure_sortie);

    await db
      .update(consultationsInfirmerieTable)
      .set(updateData)
      .where(eq(consultationsInfirmerieTable.id, id));

    const [updated] = await db
      .select()
      .from(consultationsInfirmerieTable)
      .where(eq(consultationsInfirmerieTable.id, id))
      .limit(1);

    const enriched = await enrichConsultation(updated!);
    const dossierResume = await buildDossierResume(updated!.eleve_id);

    res.json({ consultation: enriched, dossier_resume: dossierResume });
  },
);

/* PUT /infirmerie/consultations/:id/cloturer */
router.put(
  "/infirmerie/consultations/:id/cloturer",
  authMiddleware,
  verifierLicence,
  requireRole(...INFIRMIER_ONLY),
  async (req, res) => {
    const user = req.user!;
    const id = normalizeId(req.params["id"]!);

    const conditions = [eq(consultationsInfirmerieTable.id, id)];
    if (user.role !== "dev") {
      conditions.push(eq(consultationsInfirmerieTable.etablissement_id, user.etablissement_id!));
    }

    const [existing] = await db
      .select()
      .from(consultationsInfirmerieTable)
      .where(and(...conditions))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Consultation introuvable." });
      return;
    }

    if (existing.statut !== "en_cours") {
      res.status(400).json({ message: "Cette consultation est déjà clôturée." });
      return;
    }

    const heureSortie = new Date();

    await db
      .update(consultationsInfirmerieTable)
      .set({
        statut: "termine",
        heure_sortie: heureSortie,
        updated_at: new Date(),
      })
      .where(eq(consultationsInfirmerieTable.id, id));

    const [updated] = await db
      .select()
      .from(consultationsInfirmerieTable)
      .where(eq(consultationsInfirmerieTable.id, id))
      .limit(1);

    const enriched = await enrichConsultation(updated!);

    const parents = await db
      .select({ utilisateur_id: parentsElevesTable.utilisateur_id })
      .from(parentsElevesTable)
      .where(eq(parentsElevesTable.eleve_id, existing.eleve_id));

    const [eleve] = await db
      .select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms })
      .from(elevesTable)
      .where(eq(elevesTable.id, existing.eleve_id))
      .limit(1);

    for (const parent of parents) {
      try {
        const [notif] = await db
          .insert(notificationsTable)
          .values({
            etablissement_id: existing.etablissement_id,
            destinataire_id: parent.utilisateur_id,
            titre: "Consultation infirmerie terminée",
            contenu: `La consultation de ${eleve?.nom ?? ""} ${eleve?.prenoms ?? ""} à l'infirmerie est terminée. Motif : ${existing.motif}.`,
            type: "message",
            lu: false,
          })
          .returning();
        await emitNotification(parent.utilisateur_id, {
          id: notif!.id,
          titre: notif!.titre,
          contenu: notif!.contenu,
          type: notif!.type,
          lien: notif!.lien ?? undefined,
          created_at: notif!.created_at,
        });
      } catch {
        req.log.warn({ parentId: parent.utilisateur_id }, "Erreur notification parent infirmerie");
      }
    }

    await db
      .update(consultationsInfirmerieTable)
      .set({ parent_notifie: parents.length > 0 })
      .where(eq(consultationsInfirmerieTable.id, id));

    enriched.parent_notifie = parents.length > 0;

    const dossierResume = await buildDossierResume(updated!.eleve_id);

    res.json({ consultation: enriched, dossier_resume: dossierResume });
  },
);

/* GET /infirmerie/eleve/:eleveId/consultations */
router.get(
  "/infirmerie/eleve/:eleveId/consultations",
  authMiddleware,
  verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const eleveId = normalizeId(req.params["eleveId"]!);

    if (!["dev", "directeur", "censeur", "infirmier", "parent"].includes(user.role)) {
      res.status(403).json({ message: "Accès refusé." });
      return;
    }

    if (user.role === "parent") {
      const [lien] = await db
        .select()
        .from(parentsElevesTable)
        .where(
          and(
            eq(parentsElevesTable.utilisateur_id, user.id),
            eq(parentsElevesTable.eleve_id, eleveId),
          ),
        )
        .limit(1);
      if (!lien) {
        res.status(403).json({ message: "Cet élève n'est pas votre enfant." });
        return;
      }
    }

    const conditions = [eq(consultationsInfirmerieTable.eleve_id, eleveId)];
    if (user.role !== "dev") {
      conditions.push(eq(consultationsInfirmerieTable.etablissement_id, user.etablissement_id!));
    }

    const rows = await db
      .select()
      .from(consultationsInfirmerieTable)
      .where(and(...conditions))
      .orderBy(desc(consultationsInfirmerieTable.heure_entree));

    const consultations = await Promise.all(rows.map(enrichConsultation));

    const motifsMap = new Map<string, number>();
    for (const c of rows) {
      motifsMap.set(c.motif, (motifsMap.get(c.motif) ?? 0) + 1);
    }
    const motifs_frequents = [...motifsMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([motif, count]) => ({ motif, count }));

    res.json({
      consultations,
      stats: {
        nb_visites: rows.length,
        motifs_frequents,
      },
    });
  },
);

/* GET /infirmerie/stats */
router.get(
  "/infirmerie/stats",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "infirmier"),
  async (req, res) => {
    const user = req.user!;
    const etabCondition = user.role !== "dev"
      ? eq(consultationsInfirmerieTable.etablissement_id, user.etablissement_id!)
      : undefined;
    const stockEtabCond = user.role !== "dev"
      ? eq(stocksInfirmerieTable.etablissement_id, user.etablissement_id!)
      : undefined;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const firstDayMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const firstDayTrimestre = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);

    const todayCond = and(
      etabCondition,
      gte(consultationsInfirmerieTable.heure_entree, today),
      lte(consultationsInfirmerieTable.heure_entree, todayEnd),
    );

    const [todayRow] = await db
      .select({ n: count() })
      .from(consultationsInfirmerieTable)
      .where(todayCond);

    const [enCoursCond] = await db
      .select({ n: count() })
      .from(consultationsInfirmerieTable)
      .where(and(etabCondition, eq(consultationsInfirmerieTable.statut, "en_cours")));

    const [moisRow] = await db
      .select({ n: count() })
      .from(consultationsInfirmerieTable)
      .where(and(etabCondition, gte(consultationsInfirmerieTable.heure_entree, firstDayMonth)));

    const [trimestreRow] = await db
      .select({ n: count() })
      .from(consultationsInfirmerieTable)
      .where(and(etabCondition, gte(consultationsInfirmerieTable.heure_entree, firstDayTrimestre)));

    const stocks = await db
      .select({ quantite: stocksInfirmerieTable.quantite, seuil_alerte: stocksInfirmerieTable.seuil_alerte })
      .from(stocksInfirmerieTable)
      .where(stockEtabCond);
    const articlesEnAlerte = stocks.filter(s => s.quantite <= s.seuil_alerte).length;

    const allConsultations = await db
      .select({ motif: consultationsInfirmerieTable.motif })
      .from(consultationsInfirmerieTable)
      .where(etabCondition)
      .orderBy(desc(consultationsInfirmerieTable.heure_entree))
      .limit(500);
    const motifsMap = new Map<string, number>();
    for (const c of allConsultations) {
      motifsMap.set(c.motif, (motifsMap.get(c.motif) ?? 0) + 1);
    }
    const motifs_frequents = [...motifsMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([motif, count]) => ({ motif, count }));

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const hist30 = await db
      .select({ heure_entree: consultationsInfirmerieTable.heure_entree })
      .from(consultationsInfirmerieTable)
      .where(and(etabCondition, gte(consultationsInfirmerieTable.heure_entree, since30)));

    const dayMap = new Map<string, number>();
    for (const c of hist30) {
      const day = c.heure_entree.toISOString().split("T")[0]!;
      dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
    }
    const activite_30j = [...dayMap.entries()]
      .sort((a, b) => a[0]! < b[0]! ? -1 : 1)
      .map(([date, count]) => ({ date, count }));

    res.json({
      consultations_aujourd_hui: todayRow?.n ?? 0,
      consultations_en_cours: enCoursCond?.n ?? 0,
      consultations_mois: moisRow?.n ?? 0,
      consultations_trimestre: trimestreRow?.n ?? 0,
      articles_en_alerte: articlesEnAlerte,
      motifs_frequents,
      activite_30j,
    });
  },
);

/* ═══════════════════════════════════════════════════════════════════
   STOCKS
   ═══════════════════════════════════════════════════════════════════ */

/* GET /infirmerie/stocks */
router.get(
  "/infirmerie/stocks",
  authMiddleware,
  verifierLicence,
  requireRole(...STOCKS_ACCESS),
  async (req, res) => {
    const user = req.user!;
    const { categorie } = req.query as Record<string, string>;
    const alerte_stock = req.query["alerte_stock"] === "true";

    const conditions = [];
    if (user.role !== "dev") {
      conditions.push(eq(stocksInfirmerieTable.etablissement_id, user.etablissement_id!));
    }
    if (categorie && categorie !== "tous") {
      conditions.push(eq(stocksInfirmerieTable.categorie, categorie as "medicament" | "materiel" | "consommable"));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    let stocks = await db
      .select()
      .from(stocksInfirmerieTable)
      .where(where)
      .orderBy(stocksInfirmerieTable.nom);

    const enriched = stocks.map(s => ({
      ...s,
      statut_stock: getStatutStock(s.quantite, s.seuil_alerte),
    }));

    const filtered = alerte_stock
      ? enriched.filter(s => s.statut_stock !== "ok")
      : enriched;

    const en_alerte = enriched.filter(s => s.statut_stock === "alerte").length;
    const en_rupture = enriched.filter(s => s.statut_stock === "rupture").length;

    res.json({
      stocks: filtered,
      total: filtered.length,
      en_alerte,
      en_rupture,
    });
  },
);

/* POST /infirmerie/stocks */
router.post(
  "/infirmerie/stocks",
  authMiddleware,
  verifierLicence,
  requireRole(...STOCKS_ACCESS),
  async (req, res) => {
    const user = req.user!;
    const { nom, categorie, quantite, unite, seuil_alerte, date_expiration } = req.body as {
      nom: string;
      categorie: string;
      quantite: number;
      unite: string;
      seuil_alerte: number;
      date_expiration?: string;
    };

    if (!nom || !categorie || quantite === undefined || !unite || seuil_alerte === undefined) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const etabId = user.role === "dev"
      ? (req.body as { etablissement_id?: string }).etablissement_id
      : user.etablissement_id!;

    if (!etabId) {
      res.status(400).json({ message: "etablissement_id requis pour le rôle dev." });
      return;
    }

    const [stock] = await db
      .insert(stocksInfirmerieTable)
      .values({
        etablissement_id: etabId,
        nom,
        categorie: categorie as "medicament" | "materiel" | "consommable",
        quantite,
        unite,
        seuil_alerte,
        date_expiration: date_expiration ? new Date(date_expiration) : null,
      })
      .returning();

    res.status(201).json({
      ...stock!,
      statut_stock: getStatutStock(stock!.quantite, stock!.seuil_alerte),
    });
  },
);

/* GET /infirmerie/stocks/alertes */
router.get(
  "/infirmerie/stocks/alertes",
  authMiddleware,
  verifierLicence,
  requireRole(...STOCKS_ACCESS),
  async (req, res) => {
    const user = req.user!;

    const condition = user.role !== "dev"
      ? eq(stocksInfirmerieTable.etablissement_id, user.etablissement_id!)
      : undefined;

    const stocks = await db
      .select()
      .from(stocksInfirmerieTable)
      .where(condition)
      .orderBy(stocksInfirmerieTable.quantite);

    const enriched = stocks.map(s => ({
      ...s,
      statut_stock: getStatutStock(s.quantite, s.seuil_alerte),
    }));

    const alertes = enriched.filter(s => s.statut_stock !== "ok");

    res.json({
      stocks: alertes,
      total: alertes.length,
      en_alerte: alertes.filter(s => s.statut_stock === "alerte").length,
      en_rupture: alertes.filter(s => s.statut_stock === "rupture").length,
    });
  },
);

/* PUT /infirmerie/stocks/:id */
router.put(
  "/infirmerie/stocks/:id",
  authMiddleware,
  verifierLicence,
  requireRole(...STOCKS_ACCESS),
  async (req, res) => {
    const user = req.user!;
    const id = normalizeId(req.params["id"]!);

    const conditions = [eq(stocksInfirmerieTable.id, id)];
    if (user.role !== "dev") {
      conditions.push(eq(stocksInfirmerieTable.etablissement_id, user.etablissement_id!));
    }

    const [existing] = await db
      .select()
      .from(stocksInfirmerieTable)
      .where(and(...conditions))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Article introuvable." });
      return;
    }

    const { nom, categorie, quantite, unite, seuil_alerte, date_expiration } = req.body as Record<string, unknown>;

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (nom !== undefined) updateData["nom"] = nom;
    if (categorie !== undefined) updateData["categorie"] = categorie;
    if (quantite !== undefined) updateData["quantite"] = quantite;
    if (unite !== undefined) updateData["unite"] = unite;
    if (seuil_alerte !== undefined) updateData["seuil_alerte"] = seuil_alerte;
    if (date_expiration !== undefined) updateData["date_expiration"] = date_expiration ? new Date(date_expiration as string) : null;

    await db
      .update(stocksInfirmerieTable)
      .set(updateData)
      .where(eq(stocksInfirmerieTable.id, id));

    const [updated] = await db
      .select()
      .from(stocksInfirmerieTable)
      .where(eq(stocksInfirmerieTable.id, id))
      .limit(1);

    res.json({
      ...updated!,
      statut_stock: getStatutStock(updated!.quantite, updated!.seuil_alerte),
    });
  },
);

/* POST /infirmerie/stocks/:id/mouvement */
router.post(
  "/infirmerie/stocks/:id/mouvement",
  authMiddleware,
  verifierLicence,
  requireRole(...INFIRMIER_ONLY),
  async (req, res) => {
    const user = req.user!;
    const id = normalizeId(req.params["id"]!);

    const conditions = [eq(stocksInfirmerieTable.id, id)];
    if (user.role !== "dev") {
      conditions.push(eq(stocksInfirmerieTable.etablissement_id, user.etablissement_id!));
    }

    const [stock] = await db
      .select()
      .from(stocksInfirmerieTable)
      .where(and(...conditions))
      .limit(1);

    if (!stock) {
      res.status(404).json({ message: "Article introuvable." });
      return;
    }

    const { type, quantite, motif, consultation_id } = req.body as {
      type: "entree" | "sortie";
      quantite: number;
      motif?: string;
      consultation_id?: string;
    };

    if (!type || !quantite || quantite <= 0) {
      res.status(400).json({ message: "Type et quantité (>0) sont obligatoires." });
      return;
    }

    if (type === "sortie" && stock.quantite < quantite) {
      res.status(400).json({ message: `Stock insuffisant. Disponible : ${stock.quantite} ${stock.unite}.` });
      return;
    }

    const nouvelleQuantite = type === "entree"
      ? stock.quantite + quantite
      : stock.quantite - quantite;

    await db
      .update(stocksInfirmerieTable)
      .set({ quantite: nouvelleQuantite, updated_at: new Date() })
      .where(eq(stocksInfirmerieTable.id, id));

    await db
      .insert(mouvementsStocksTable)
      .values({
        stock_id: id,
        consultation_id: consultation_id ?? null,
        type,
        quantite,
        motif: motif ?? null,
        effectue_par: user.id,
      });

    const [updated] = await db
      .select()
      .from(stocksInfirmerieTable)
      .where(eq(stocksInfirmerieTable.id, id))
      .limit(1);

    res.json({
      ...updated!,
      statut_stock: getStatutStock(updated!.quantite, updated!.seuil_alerte),
    });
  },
);

/* GET /infirmerie/stocks/:id/historique */
router.get(
  "/infirmerie/stocks/:id/historique",
  authMiddleware,
  verifierLicence,
  requireRole(...STOCKS_ACCESS),
  async (req, res) => {
    const user = req.user!;
    const id = normalizeId(req.params["id"]!);

    const conditions = [eq(stocksInfirmerieTable.id, id)];
    if (user.role !== "dev") {
      conditions.push(eq(stocksInfirmerieTable.etablissement_id, user.etablissement_id!));
    }

    const [stock] = await db
      .select()
      .from(stocksInfirmerieTable)
      .where(and(...conditions))
      .limit(1);

    if (!stock) {
      res.status(404).json({ message: "Article introuvable." });
      return;
    }

    const mouvements = await db
      .select()
      .from(mouvementsStocksTable)
      .where(eq(mouvementsStocksTable.stock_id, id))
      .orderBy(desc(mouvementsStocksTable.created_at))
      .limit(100);

    const utilisateurIds = [...new Set(mouvements.map(m => m.effectue_par))];
    const utilisateurs = utilisateurIds.length > 0
      ? await db
          .select({ id: utilisateursTable.id, nom: utilisateursTable.nom })
          .from(utilisateursTable)
          .where(
            or(...utilisateurIds.map(uid => eq(utilisateursTable.id, uid))),
          )
      : [];
    const nomMap = new Map(utilisateurs.map(u => [u.id, u.nom]));

    const enriched = mouvements.map(m => ({
      ...m,
      effectue_par_nom: nomMap.get(m.effectue_par) ?? null,
    }));

    res.json({
      mouvements: enriched,
      stock: { ...stock, statut_stock: getStatutStock(stock.quantite, stock.seuil_alerte) },
    });
  },
);

/* ── Helper interne ───────────────────────────────────────────────── */
async function buildDossierResume(eleveId: string) {
  const [dossier] = await db
    .select({
      groupe_sanguin: dossiersMedicauxTable.groupe_sanguin,
      allergies: dossiersMedicauxTable.allergies,
      medicaments_interdits: dossiersMedicauxTable.medicaments_interdits,
    })
    .from(dossiersMedicauxTable)
    .where(eq(dossiersMedicauxTable.eleve_id, eleveId))
    .limit(1);

  const [nbRow] = await db
    .select({ n: count() })
    .from(consultationsInfirmerieTable)
    .where(eq(consultationsInfirmerieTable.eleve_id, eleveId));

  const [lastRow] = await db
    .select({ heure_entree: consultationsInfirmerieTable.heure_entree })
    .from(consultationsInfirmerieTable)
    .where(eq(consultationsInfirmerieTable.eleve_id, eleveId))
    .orderBy(desc(consultationsInfirmerieTable.heure_entree))
    .limit(1);

  return {
    groupe_sanguin: dossier?.groupe_sanguin ?? null,
    allergies: dossier?.allergies ?? [],
    medicaments_interdits: dossier?.medicaments_interdits ?? null,
    nb_visites: (nbRow?.n ?? 0) as number,
    derniere_visite: lastRow?.heure_entree?.toISOString() ?? null,
  };
}

export default router;
