import { Router } from "express";
import { eq, and, desc, count, sql, gte, lte, inArray } from "drizzle-orm";
import {
  db,
  clubsTable,
  clubMembresTable,
  activitesClubTable,
  presencesClubTable,
  distinctionsClubTable,
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
const ADMINS    = ["dev", "directeur", "censeur"];
const STAFF     = ["dev", "directeur", "censeur", "professeur"];
const ALL_ROLES = ["dev", "directeur", "censeur", "professeur", "eleve", "parent", "infirmier"];

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0]! : v;
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

async function getClasseNom(eleveId: string): Promise<string | null> {
  const [ec] = await db
    .select({ nom: classesTable.nom })
    .from(eleveClassesTable)
    .innerJoin(classesTable, eq(eleveClassesTable.classe_id, classesTable.id))
    .where(eq(eleveClassesTable.eleve_id, eleveId))
    .orderBy(desc(eleveClassesTable.created_at))
    .limit(1);
  return ec?.nom ?? null;
}

async function isResponsable(clubId: string, userId: string): Promise<boolean> {
  const [club] = await db
    .select({ responsable_id: clubsTable.responsable_id })
    .from(clubsTable)
    .where(eq(clubsTable.id, clubId))
    .limit(1);
  return club?.responsable_id === userId;
}

async function getEleveIdForUser(userId: string): Promise<string | null> {
  const [e] = await db
    .select({ id: elevesTable.id })
    .from(elevesTable)
    .where(eq(elevesTable.utilisateur_id, userId))
    .limit(1);
  return e?.id ?? null;
}

async function notifyUser(
  etablissementId: string,
  destinataireId: string,
  titre: string,
  contenu: string,
  lien?: string,
) {
  try {
    const [notif] = await db
      .insert(notificationsTable)
      .values({
        etablissement_id: etablissementId,
        destinataire_id: destinataireId,
        titre,
        contenu,
        type: "message",
        lien: lien ?? null,
        lu: false,
      })
      .returning();
    if (notif) {
      await emitNotification(destinataireId, {
        id: notif.id,
        titre: notif.titre,
        contenu: notif.contenu,
        type: notif.type,
        lien: notif.lien ?? undefined,
        created_at: notif.created_at,
      });
    }
  } catch {
    // non-fatal
  }
}

async function enrichClubItem(
  club: typeof clubsTable.$inferSelect,
  userId?: string,
  userEtabId?: string,
) {
  const [resp] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, club.responsable_id))
    .limit(1);

  const [{ value: nbMembres }] = await db
    .select({ value: count() })
    .from(clubMembresTable)
    .where(and(eq(clubMembresTable.club_id, club.id), eq(clubMembresTable.statut, "accepte")));

  let est_membre = false;
  let mon_statut: string | null = null;
  let mon_role: string | null = null;

  if (userId) {
    const eleveId = await getEleveIdForUser(userId);
    if (eleveId) {
      const [mem] = await db
        .select({ statut: clubMembresTable.statut, role_membre: clubMembresTable.role_membre })
        .from(clubMembresTable)
        .where(and(eq(clubMembresTable.club_id, club.id), eq(clubMembresTable.eleve_id, eleveId)))
        .limit(1);
      if (mem) {
        est_membre = mem.statut === "accepte";
        mon_statut = mem.statut;
        mon_role = mem.role_membre;
      }
    }
  }

  const prochaine = await db
    .select({ date_activite: activitesClubTable.date_activite, titre: activitesClubTable.titre })
    .from(activitesClubTable)
    .where(
      and(
        eq(activitesClubTable.club_id, club.id),
        eq(activitesClubTable.statut, "planifiee"),
        gte(activitesClubTable.date_activite, new Date().toISOString().slice(0, 10)),
      ),
    )
    .orderBy(activitesClubTable.date_activite)
    .limit(1);

  return {
    ...club,
    responsable_nom: resp?.nom ?? null,
    responsable_prenoms: resp?.prenoms ?? null,
    nb_membres: Number(nbMembres),
    est_membre,
    mon_statut,
    mon_role,
    prochaine_activite: prochaine[0]?.date_activite ?? null,
  };
}

async function enrichMembreItem(m: typeof clubMembresTable.$inferSelect) {
  const [eleve] = await db
    .select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, photo_url: elevesTable.photo_url })
    .from(elevesTable)
    .where(eq(elevesTable.id, m.eleve_id))
    .limit(1);
  const classeNom = await getClasseNom(m.eleve_id);
  return {
    ...m,
    eleve_nom: eleve?.nom ?? null,
    eleve_prenoms: eleve?.prenoms ?? null,
    eleve_photo: eleve?.photo_url ?? null,
    classe_nom: classeNom,
  };
}

/* ════════════════════════════════════════════════════════════════════════════
   CLUBS — CRUD
═══════════════════════════════════════════════════════════════════════════ */

/* GET /clubs ─────────────────────────────────────────────────────────────── */
router.get(
  "/clubs",
  authMiddleware,
  verifierLicence,
  requireRole(...ALL_ROLES),
  async (req, res) => {
    const { categorie, actif, annee_scolaire_id } = req.query as Record<string, string>;
    const { etablissement_id, id: userId, role } = req.user!;

    const conditions = [];
    if (role !== "dev") conditions.push(eq(clubsTable.etablissement_id, etablissement_id!));
    if (categorie) conditions.push(eq(clubsTable.categorie, categorie as any));
    if (actif !== undefined) conditions.push(eq(clubsTable.actif, actif === "true"));
    if (annee_scolaire_id) conditions.push(eq(clubsTable.annee_scolaire_id, annee_scolaire_id));

    const clubs = await db
      .select()
      .from(clubsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(clubsTable.categorie, clubsTable.nom);

    const enriched = await Promise.all(clubs.map(c => enrichClubItem(c, userId, etablissement_id ?? undefined)));
    res.json({ clubs: enriched, total: enriched.length });
  },
);

/* POST /clubs ────────────────────────────────────────────────────────────── */
router.post(
  "/clubs",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res) => {
    const { etablissement_id, id: userId } = req.user!;
    const { nom, description, categorie, logo_url, couleur, capacite_max, responsable_id, annee_scolaire_id } = req.body as {
      nom: string; description?: string; categorie: string; logo_url?: string; couleur?: string;
      capacite_max?: number; responsable_id: string; annee_scolaire_id: string;
    };

    if (!nom || !categorie || !responsable_id || !annee_scolaire_id) {
      res.status(400).json({ message: "Champs requis manquants" });
      return;
    }

    const [club] = await db
      .insert(clubsTable)
      .values({
        etablissement_id: etablissement_id!,
        responsable_id,
        nom,
        description: description ?? null,
        categorie: categorie as any,
        logo_url: logo_url ?? null,
        couleur: couleur ?? null,
        capacite_max: capacite_max ?? null,
        annee_scolaire_id,
        actif: true,
      })
      .returning();

    // Notifier le responsable
    const [resp] = await db.select({ utilisateur_id: utilisateursTable.id }).from(utilisateursTable).where(eq(utilisateursTable.id, responsable_id)).limit(1);
    if (resp && etablissement_id) {
      await notifyUser(etablissement_id, responsable_id, `Nouveau club : ${nom}`, `Vous avez été désigné(e) responsable du club "${nom}".`, `/clubs/${club!.id}`);
    }

    const enriched = await enrichClubItem(club!, userId, etablissement_id ?? undefined);
    res.status(201).json(enriched);
  },
);

/* GET /clubs/stats ───────────────────────────────────────────────────────── */
router.get(
  "/clubs/stats",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res) => {
    const { etablissement_id, role } = req.user!;

    const etabCond = role !== "dev" ? eq(clubsTable.etablissement_id, etablissement_id!) : undefined;

    const [totalClubs] = await db.select({ value: count() }).from(clubsTable).where(etabCond);
    const [totalMembres] = await db
      .select({ value: count() })
      .from(clubMembresTable)
      .innerJoin(clubsTable, eq(clubMembresTable.club_id, clubsTable.id))
      .where(and(etabCond, eq(clubMembresTable.statut, "accepte")));

    const now = new Date();
    const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const [activitesMois] = await db
      .select({ value: count() })
      .from(activitesClubTable)
      .where(and(
        role !== "dev" ? eq(activitesClubTable.etablissement_id, etablissement_id!) : undefined,
        gte(activitesClubTable.date_activite, firstOfMonth),
      ));

    const [demandesAttente] = await db
      .select({ value: count() })
      .from(clubMembresTable)
      .innerJoin(clubsTable, eq(clubMembresTable.club_id, clubsTable.id))
      .where(and(etabCond, eq(clubMembresTable.statut, "en_attente")));

    const parCategorie = await db
      .select({
        categorie: clubsTable.categorie,
        nb_clubs: count(clubsTable.id),
      })
      .from(clubsTable)
      .where(etabCond)
      .groupBy(clubsTable.categorie);

    res.json({
      total_clubs: Number(totalClubs?.value ?? 0),
      total_membres: Number(totalMembres?.value ?? 0),
      activites_ce_mois: Number(activitesMois?.value ?? 0),
      demandes_en_attente: Number(demandesAttente?.value ?? 0),
      par_categorie: parCategorie.map(r => ({ categorie: r.categorie, nb_clubs: Number(r.nb_clubs), nb_membres: 0 })),
      clubs_actifs: [],
    });
  },
);

/* GET /clubs/mes-clubs ───────────────────────────────────────────────────── */
router.get(
  "/clubs/mes-clubs",
  authMiddleware,
  verifierLicence,
  requireRole("eleve"),
  async (req, res) => {
    const { id: userId } = req.user!;
    const eleveId = await getEleveIdForUser(userId);
    if (!eleveId) { res.status(404).json({ message: "Élève introuvable" }); return; }

    const memberships = await db
      .select()
      .from(clubMembresTable)
      .where(eq(clubMembresTable.eleve_id, eleveId));

    const clubsActifsRaw: Record<string, unknown>[] = [];
    const demandesEnAttente: Record<string, unknown>[] = [];

    for (const m of memberships) {
      const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, m.club_id)).limit(1);
      if (!club) continue;
      const [resp] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, club.responsable_id)).limit(1);

      if (m.statut === "accepte") {
        // Taux présence
        const activites = await db.select({ id: activitesClubTable.id }).from(activitesClubTable).where(and(eq(activitesClubTable.club_id, club.id), eq(activitesClubTable.statut, "terminee")));
        let nbPresent = 0;
        for (const a of activites) {
          const [p] = await db.select().from(presencesClubTable).where(and(eq(presencesClubTable.activite_id, a.id), eq(presencesClubTable.eleve_id, eleveId))).limit(1);
          if (p?.present) nbPresent++;
        }
        const tauxPresence = activites.length > 0 ? Math.round((nbPresent / activites.length) * 100) : 0;
        const [nbDistinctions] = await db.select({ value: count() }).from(distinctionsClubTable).where(and(eq(distinctionsClubTable.club_id, club.id), eq(distinctionsClubTable.eleve_id, eleveId)));
        const prochaine = await db.select({ date_activite: activitesClubTable.date_activite }).from(activitesClubTable).where(and(eq(activitesClubTable.club_id, club.id), eq(activitesClubTable.statut, "planifiee"), gte(activitesClubTable.date_activite, new Date().toISOString().slice(0, 10)))).orderBy(activitesClubTable.date_activite).limit(1);

        clubsActifsRaw.push({
          id: club.id, nom: club.nom, categorie: club.categorie, logo_url: club.logo_url, couleur: club.couleur,
          responsable_nom: resp?.nom ?? null,
          mon_role: m.role_membre,
          taux_presence: tauxPresence,
          nb_distinctions: Number(nbDistinctions?.value ?? 0),
          prochaine_activite: prochaine[0]?.date_activite ?? null,
        });
      } else if (m.statut === "en_attente") {
        demandesEnAttente.push({ ...club, responsable_nom: resp?.nom ?? null, mon_statut: "en_attente" });
      }
    }

    const distinctions = await db
      .select()
      .from(distinctionsClubTable)
      .where(eq(distinctionsClubTable.eleve_id, eleveId))
      .orderBy(desc(distinctionsClubTable.date_obtention));

    const distinctionsEnriched = await Promise.all(distinctions.map(async d => {
      const [club] = await db.select({ nom: clubsTable.nom }).from(clubsTable).where(eq(clubsTable.id, d.club_id)).limit(1);
      const [par] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, d.decerne_par)).limit(1);
      return { ...d, club_nom: club?.nom ?? null, decerne_par_nom: par?.nom ?? null };
    }));

    res.json({ clubs_actifs: clubsActifsRaw, demandes_en_attente: demandesEnAttente, distinctions: distinctionsEnriched });
  },
);

/* GET /clubs/:id ─────────────────────────────────────────────────────────── */
router.get(
  "/clubs/:id",
  authMiddleware,
  verifierLicence,
  requireRole(...ALL_ROLES),
  async (req, res) => {
    const id = normalizeId(req.params["id"]!);
    const { id: userId } = req.user!;

    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, id)).limit(1);
    if (!club) { res.status(404).json({ message: "Club introuvable" }); return; }

    const base = await enrichClubItem(club, userId);
    const membres = await db.select().from(clubMembresTable).where(and(eq(clubMembresTable.club_id, id), eq(clubMembresTable.statut, "accepte")));
    const membresEnriched = await Promise.all(membres.map(enrichMembreItem));

    const prochaines = await db.select().from(activitesClubTable).where(and(eq(activitesClubTable.club_id, id), eq(activitesClubTable.statut, "planifiee"))).orderBy(activitesClubTable.date_activite).limit(3);
    const pEnriched = prochaines.map(a => ({ ...a, club_nom: club.nom, club_couleur: club.couleur, nb_presents: null, nb_absents: null }));

    const distinctions = await db.select().from(distinctionsClubTable).where(eq(distinctionsClubTable.club_id, id)).orderBy(desc(distinctionsClubTable.date_obtention)).limit(5);
    const distEnriched = await Promise.all(distinctions.map(async d => {
      const [e] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms }).from(elevesTable).where(eq(elevesTable.id, d.eleve_id)).limit(1);
      const [par] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, d.decerne_par)).limit(1);
      return { ...d, eleve_nom: e?.nom ?? null, eleve_prenoms: e?.prenoms ?? null, club_nom: club.nom, decerne_par_nom: par?.nom ?? null };
    }));

    res.json({ ...base, membres: membresEnriched, prochaines_activites: pEnriched, distinctions_recentes: distEnriched });
  },
);

/* PUT /clubs/:id ─────────────────────────────────────────────────────────── */
router.put(
  "/clubs/:id",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const id = normalizeId(req.params["id"]!);
    const { id: userId, role } = req.user!;

    if (!ADMINS.includes(role) && !(await isResponsable(id, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const { nom, description, categorie, logo_url, couleur, capacite_max, responsable_id, annee_scolaire_id, actif } = req.body as Record<string, any>;
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (nom !== undefined) updates["nom"] = nom;
    if (description !== undefined) updates["description"] = description;
    if (categorie !== undefined) updates["categorie"] = categorie;
    if (logo_url !== undefined) updates["logo_url"] = logo_url;
    if (couleur !== undefined) updates["couleur"] = couleur;
    if (capacite_max !== undefined) updates["capacite_max"] = capacite_max;
    if (responsable_id !== undefined) updates["responsable_id"] = responsable_id;
    if (annee_scolaire_id !== undefined) updates["annee_scolaire_id"] = annee_scolaire_id;
    if (actif !== undefined) updates["actif"] = actif;

    const [updated] = await db.update(clubsTable).set(updates as any).where(eq(clubsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ message: "Club introuvable" }); return; }

    const enriched = await enrichClubItem(updated, userId);
    res.json(enriched);
  },
);

/* DELETE /clubs/:id ──────────────────────────────────────────────────────── */
router.delete(
  "/clubs/:id",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS),
  async (req, res) => {
    const id = normalizeId(req.params["id"]!);

    // Cascade: presences → activites → distinctions → membres → club
    const activites = await db.select({ id: activitesClubTable.id }).from(activitesClubTable).where(eq(activitesClubTable.club_id, id));
    for (const a of activites) {
      await db.delete(presencesClubTable).where(eq(presencesClubTable.activite_id, a.id));
    }
    await db.delete(activitesClubTable).where(eq(activitesClubTable.club_id, id));
    await db.delete(distinctionsClubTable).where(eq(distinctionsClubTable.club_id, id));
    await db.delete(clubMembresTable).where(eq(clubMembresTable.club_id, id));
    await db.delete(clubsTable).where(eq(clubsTable.id, id));

    res.json({ message: "Club supprimé" });
  },
);

/* ════════════════════════════════════════════════════════════════════════════
   MEMBRES
═══════════════════════════════════════════════════════════════════════════ */

/* GET /clubs/:id/membres ─────────────────────────────────────────────────── */
router.get(
  "/clubs/:id/membres",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const id = normalizeId(req.params["id"]!);
    const { statut, role_membre } = req.query as Record<string, string>;
    const { id: userId, role } = req.user!;

    if (!ADMINS.includes(role) && !(await isResponsable(id, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const conditions = [eq(clubMembresTable.club_id, id)];
    if (statut) conditions.push(eq(clubMembresTable.statut, statut as any));
    if (role_membre) conditions.push(eq(clubMembresTable.role_membre, role_membre as any));

    const membres = await db.select().from(clubMembresTable).where(and(...conditions)).orderBy(clubMembresTable.created_at);
    const enriched = await Promise.all(membres.map(enrichMembreItem));
    res.json({ membres: enriched, total: enriched.length });
  },
);

/* GET /clubs/:id/membres/en-attente ──────────────────────────────────────── */
router.get(
  "/clubs/:id/membres/en-attente",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const id = normalizeId(req.params["id"]!);
    const { id: userId, role } = req.user!;

    if (!ADMINS.includes(role) && !(await isResponsable(id, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const membres = await db.select().from(clubMembresTable).where(and(eq(clubMembresTable.club_id, id), eq(clubMembresTable.statut, "en_attente"))).orderBy(clubMembresTable.created_at);
    const enriched = await Promise.all(membres.map(enrichMembreItem));
    res.json({ membres: enriched, total: enriched.length });
  },
);

/* POST /clubs/:id/inscrire ───────────────────────────────────────────────── */
router.post(
  "/clubs/:id/inscrire",
  authMiddleware,
  verifierLicence,
  requireRole("eleve"),
  async (req, res) => {
    const id = normalizeId(req.params["id"]!);
    const { id: userId, etablissement_id } = req.user!;

    const eleveId = await getEleveIdForUser(userId);
    if (!eleveId) { res.status(404).json({ message: "Profil élève introuvable" }); return; }

    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, id)).limit(1);
    if (!club || !club.actif) { res.status(404).json({ message: "Club introuvable ou inactif" }); return; }

    // Vérifier déjà inscrit
    const [existing] = await db.select().from(clubMembresTable).where(and(eq(clubMembresTable.club_id, id), eq(clubMembresTable.eleve_id, eleveId))).limit(1);
    if (existing) { res.status(409).json({ message: "Vous êtes déjà inscrit(e) à ce club" }); return; }

    // Vérifier capacité
    if (club.capacite_max !== null) {
      const [{ value: nb }] = await db.select({ value: count() }).from(clubMembresTable).where(and(eq(clubMembresTable.club_id, id), eq(clubMembresTable.statut, "accepte")));
      if (Number(nb) >= club.capacite_max) {
        res.status(409).json({ message: "Capacité maximale du club atteinte" }); return;
      }
    }

    const [membre] = await db.insert(clubMembresTable).values({
      club_id: id,
      eleve_id: eleveId,
      statut: "en_attente",
      date_inscription: new Date().toISOString().slice(0, 10),
      role_membre: "membre",
    }).returning();

    // Notifier le responsable
    await notifyUser(club.etablissement_id, club.responsable_id, `Nouvelle demande d'inscription`, `Un élève souhaite rejoindre le club "${club.nom}".`, `/clubs/${id}`);

    const enriched = await enrichMembreItem(membre!);
    res.status(201).json(enriched);
  },
);

/* PUT /clubs/:clubId/membres/:membreId ───────────────────────────────────── */
router.put(
  "/clubs/:clubId/membres/:membreId",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);
    const membreId = normalizeId(req.params["membreId"]!);
    const { id: userId, role, etablissement_id } = req.user!;
    const { statut, role_membre } = req.body as { statut?: string; role_membre?: string };

    if (!ADMINS.includes(role) && !(await isResponsable(clubId, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const [existing] = await db.select().from(clubMembresTable).where(eq(clubMembresTable.id, membreId)).limit(1);
    if (!existing) { res.status(404).json({ message: "Membre introuvable" }); return; }

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (statut) updates["statut"] = statut;
    if (statut === "accepte") updates["date_acceptation"] = new Date().toISOString().slice(0, 10);
    if (role_membre) updates["role_membre"] = role_membre;

    const [updated] = await db.update(clubMembresTable).set(updates as any).where(eq(clubMembresTable.id, membreId)).returning();

    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);
    const [eleve] = await db.select({ utilisateur_id: elevesTable.utilisateur_id }).from(elevesTable).where(eq(elevesTable.id, existing.eleve_id)).limit(1);

    if (eleve?.utilisateur_id && club) {
      const etabId = etablissement_id ?? club.etablissement_id;
      if (statut === "accepte") {
        await notifyUser(etabId, eleve.utilisateur_id, `Inscription acceptée`, `Votre demande d'inscription au club "${club.nom}" a été acceptée !`, `/clubs/${clubId}`);
        // Notifier parents
        const parents = await db.select({ utilisateur_id: parentsElevesTable.utilisateur_id }).from(parentsElevesTable).where(eq(parentsElevesTable.eleve_id, existing.eleve_id));
        for (const p of parents) {
          await notifyUser(etabId, p.utilisateur_id, `Inscription club acceptée`, `Votre enfant a été accepté(e) dans le club "${club.nom}".`, `/clubs/${clubId}`);
        }
      } else if (statut === "refuse") {
        await notifyUser(etabId, eleve.utilisateur_id, `Inscription refusée`, `Votre demande d'inscription au club "${club.nom}" a été refusée.`, `/clubs/${clubId}`);
      }
    }

    const enriched = await enrichMembreItem(updated!);
    res.json(enriched);
  },
);

/* DELETE /clubs/:clubId/membres/:membreId ────────────────────────────────── */
router.delete(
  "/clubs/:clubId/membres/:membreId",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);
    const membreId = normalizeId(req.params["membreId"]!);
    const { id: userId, role, etablissement_id } = req.user!;

    if (!ADMINS.includes(role) && !(await isResponsable(clubId, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const [existing] = await db.select().from(clubMembresTable).where(eq(clubMembresTable.id, membreId)).limit(1);
    if (!existing) { res.status(404).json({ message: "Membre introuvable" }); return; }

    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);
    const [eleve] = await db.select({ utilisateur_id: elevesTable.utilisateur_id }).from(elevesTable).where(eq(elevesTable.id, existing.eleve_id)).limit(1);

    await db.delete(clubMembresTable).where(eq(clubMembresTable.id, membreId));

    if (eleve?.utilisateur_id && club) {
      const etabId = etablissement_id ?? club.etablissement_id;
      await notifyUser(etabId, eleve.utilisateur_id, `Retiré du club`, `Vous avez été retiré(e) du club "${club.nom}".`, `/clubs/${clubId}`);
      const parents = await db.select({ utilisateur_id: parentsElevesTable.utilisateur_id }).from(parentsElevesTable).where(eq(parentsElevesTable.eleve_id, existing.eleve_id));
      for (const p of parents) {
        await notifyUser(etabId, p.utilisateur_id, `Retiré du club`, `Votre enfant a été retiré(e) du club "${club.nom}".`, `/clubs/${clubId}`);
      }
    }

    res.json({ message: "Membre retiré" });
  },
);

/* PUT /clubs/:clubId/membres/:membreId/role ──────────────────────────────── */
router.put(
  "/clubs/:clubId/membres/:membreId/role",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);
    const membreId = normalizeId(req.params["membreId"]!);
    const { id: userId, role } = req.user!;
    const { role_membre, distinctions } = req.body as { role_membre: string; distinctions?: string };

    if (!ADMINS.includes(role) && !(await isResponsable(clubId, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (role_membre) updates["role_membre"] = role_membre;
    if (distinctions !== undefined) updates["distinctions"] = distinctions;

    const [updated] = await db.update(clubMembresTable).set(updates as any).where(eq(clubMembresTable.id, membreId)).returning();
    if (!updated) { res.status(404).json({ message: "Membre introuvable" }); return; }

    const enriched = await enrichMembreItem(updated);
    res.json(enriched);
  },
);

/* ════════════════════════════════════════════════════════════════════════════
   ACTIVITÉS
═══════════════════════════════════════════════════════════════════════════ */

/* GET /clubs/:clubId/activites ───────────────────────────────────────────── */
router.get(
  "/clubs/:clubId/activites",
  authMiddleware,
  verifierLicence,
  requireRole(...ALL_ROLES),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);
    const { type, statut, date_debut, date_fin } = req.query as Record<string, string>;

    const conditions = [eq(activitesClubTable.club_id, clubId)];
    if (type) conditions.push(eq(activitesClubTable.type, type as any));
    if (statut) conditions.push(eq(activitesClubTable.statut, statut as any));
    if (date_debut) conditions.push(gte(activitesClubTable.date_activite, date_debut));
    if (date_fin) conditions.push(lte(activitesClubTable.date_activite, date_fin));

    const activites = await db.select().from(activitesClubTable).where(and(...conditions)).orderBy(desc(activitesClubTable.date_activite));
    const [club] = await db.select({ nom: clubsTable.nom, couleur: clubsTable.couleur }).from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);

    const enriched = activites.map(a => ({ ...a, club_nom: club?.nom ?? null, club_couleur: club?.couleur ?? null, nb_presents: null, nb_absents: null }));
    res.json({ activites: enriched, total: enriched.length });
  },
);

/* POST /clubs/:clubId/activites ──────────────────────────────────────────── */
router.post(
  "/clubs/:clubId/activites",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);
    const { id: userId, role, etablissement_id } = req.user!;

    if (!ADMINS.includes(role) && !(await isResponsable(clubId, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);
    if (!club) { res.status(404).json({ message: "Club introuvable" }); return; }

    const { titre, description, type, date_activite, heure_debut, heure_fin, lieu } = req.body as {
      titre: string; description?: string; type: string; date_activite: string; heure_debut: string; heure_fin?: string; lieu?: string;
    };

    if (!titre || !type || !date_activite || !heure_debut) {
      res.status(400).json({ message: "Champs requis manquants" }); return;
    }

    const [activite] = await db.insert(activitesClubTable).values({
      club_id: clubId,
      etablissement_id: etablissement_id ?? club.etablissement_id,
      titre,
      description: description ?? null,
      type: type as any,
      date_activite,
      heure_debut,
      heure_fin: heure_fin ?? null,
      lieu: lieu ?? null,
      statut: "planifiee",
    }).returning();

    // Créer présences pour tous les membres acceptés
    const membres = await db.select({ eleve_id: clubMembresTable.eleve_id }).from(clubMembresTable).where(and(eq(clubMembresTable.club_id, clubId), eq(clubMembresTable.statut, "accepte")));
    if (membres.length > 0) {
      await db.insert(presencesClubTable).values(membres.map(m => ({
        activite_id: activite!.id,
        eleve_id: m.eleve_id,
        present: false,
      }))).onConflictDoNothing();
    }

    // Notifier membres + parents
    const etabId = etablissement_id ?? club.etablissement_id;
    for (const m of membres) {
      const [eleve] = await db.select({ utilisateur_id: elevesTable.utilisateur_id }).from(elevesTable).where(eq(elevesTable.id, m.eleve_id)).limit(1);
      if (eleve?.utilisateur_id) {
        await notifyUser(etabId, eleve.utilisateur_id, `Nouvelle activité : ${titre}`, `Le club "${club.nom}" a planifié une activité le ${date_activite}.`, `/clubs/${clubId}`);
      }
      const parents = await db.select({ utilisateur_id: parentsElevesTable.utilisateur_id }).from(parentsElevesTable).where(eq(parentsElevesTable.eleve_id, m.eleve_id));
      for (const p of parents) {
        await notifyUser(etabId, p.utilisateur_id, `Activité club planifiée`, `Le club "${club.nom}" de votre enfant a planifié une activité le ${date_activite}.`, `/clubs/${clubId}`);
      }
    }

    res.status(201).json({ ...activite!, club_nom: club.nom, club_couleur: club.couleur, nb_presents: 0, nb_absents: membres.length });
  },
);

/* PUT /clubs/:clubId/activites/:id ───────────────────────────────────────── */
router.put(
  "/clubs/:clubId/activites/:id",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);
    const id = normalizeId(req.params["id"]!);
    const { id: userId, role } = req.user!;

    if (!ADMINS.includes(role) && !(await isResponsable(clubId, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const { titre, description, type, date_activite, heure_debut, heure_fin, lieu, notes_compte_rendu } = req.body as Record<string, any>;
    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (titre) updates["titre"] = titre;
    if (description !== undefined) updates["description"] = description;
    if (type) updates["type"] = type;
    if (date_activite) updates["date_activite"] = date_activite;
    if (heure_debut) updates["heure_debut"] = heure_debut;
    if (heure_fin !== undefined) updates["heure_fin"] = heure_fin;
    if (lieu !== undefined) updates["lieu"] = lieu;
    if (notes_compte_rendu !== undefined) updates["notes_compte_rendu"] = notes_compte_rendu;

    const [updated] = await db.update(activitesClubTable).set(updates as any).where(eq(activitesClubTable.id, id)).returning();
    if (!updated) { res.status(404).json({ message: "Activité introuvable" }); return; }

    const [club] = await db.select({ nom: clubsTable.nom, couleur: clubsTable.couleur }).from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);
    res.json({ ...updated, club_nom: club?.nom ?? null, club_couleur: club?.couleur ?? null, nb_presents: null, nb_absents: null });
  },
);

/* PUT /clubs/:clubId/activites/:id/annuler ───────────────────────────────── */
router.put(
  "/clubs/:clubId/activites/:id/annuler",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);
    const id = normalizeId(req.params["id"]!);
    const { id: userId, role, etablissement_id } = req.user!;

    if (!ADMINS.includes(role) && !(await isResponsable(clubId, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const [updated] = await db.update(activitesClubTable).set({ statut: "annulee", updated_at: new Date() }).where(eq(activitesClubTable.id, id)).returning();
    if (!updated) { res.status(404).json({ message: "Activité introuvable" }); return; }

    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);
    if (club) {
      const membres = await db.select({ eleve_id: clubMembresTable.eleve_id }).from(clubMembresTable).where(and(eq(clubMembresTable.club_id, clubId), eq(clubMembresTable.statut, "accepte")));
      const etabId = etablissement_id ?? club.etablissement_id;
      for (const m of membres) {
        const [eleve] = await db.select({ utilisateur_id: elevesTable.utilisateur_id }).from(elevesTable).where(eq(elevesTable.id, m.eleve_id)).limit(1);
        if (eleve?.utilisateur_id) {
          await notifyUser(etabId, eleve.utilisateur_id, `Activité annulée`, `L'activité "${updated.titre}" du club "${club.nom}" a été annulée.`, `/clubs/${clubId}`);
        }
      }
    }

    res.json({ ...updated, club_nom: club?.nom ?? null, club_couleur: club?.couleur ?? null, nb_presents: null, nb_absents: null });
  },
);

/* ════════════════════════════════════════════════════════════════════════════
   PRÉSENCES
═══════════════════════════════════════════════════════════════════════════ */

/* GET /clubs/activites/:id/presences ─────────────────────────────────────── */
router.get(
  "/clubs/activites/:id/presences",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const id = normalizeId(req.params["id"]!);

    const [activite] = await db.select().from(activitesClubTable).where(eq(activitesClubTable.id, id)).limit(1);
    if (!activite) { res.status(404).json({ message: "Activité introuvable" }); return; }

    const presences = await db.select().from(presencesClubTable).where(eq(presencesClubTable.activite_id, id));
    const enriched = await Promise.all(presences.map(async p => {
      const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, photo_url: elevesTable.photo_url }).from(elevesTable).where(eq(elevesTable.id, p.eleve_id)).limit(1);
      const classeNom = await getClasseNom(p.eleve_id);
      return { ...p, eleve_nom: eleve?.nom ?? null, eleve_prenoms: eleve?.prenoms ?? null, eleve_photo: eleve?.photo_url ?? null, classe_nom: classeNom };
    }));

    const [club] = await db.select({ nom: clubsTable.nom, couleur: clubsTable.couleur }).from(clubsTable).where(eq(clubsTable.id, activite.club_id)).limit(1);
    const nb_presents = enriched.filter(p => p.present).length;
    const nb_absents = enriched.filter(p => !p.present).length;

    res.json({
      presences: enriched,
      activite: { ...activite, club_nom: club?.nom ?? null, club_couleur: club?.couleur ?? null, nb_presents, nb_absents },
      nb_presents,
      nb_absents,
    });
  },
);

/* POST /clubs/activites/:id/presences ────────────────────────────────────── */
router.post(
  "/clubs/activites/:id/presences",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const id = normalizeId(req.params["id"]!);
    const { presences } = req.body as { presences: Array<{ eleve_id: string; present: boolean; motif_absence?: string }> };

    if (!Array.isArray(presences)) {
      res.status(400).json({ message: "presences requis (tableau)" }); return;
    }

    const [activite] = await db.select().from(activitesClubTable).where(eq(activitesClubTable.id, id)).limit(1);
    if (!activite) { res.status(404).json({ message: "Activité introuvable" }); return; }

    for (const p of presences) {
      const [existing] = await db.select().from(presencesClubTable).where(and(eq(presencesClubTable.activite_id, id), eq(presencesClubTable.eleve_id, p.eleve_id))).limit(1);
      if (existing) {
        await db.update(presencesClubTable).set({ present: p.present, motif_absence: p.motif_absence ?? null }).where(and(eq(presencesClubTable.activite_id, id), eq(presencesClubTable.eleve_id, p.eleve_id)));
      } else {
        await db.insert(presencesClubTable).values({ activite_id: id, eleve_id: p.eleve_id, present: p.present, motif_absence: p.motif_absence ?? null }).onConflictDoNothing();
      }
    }

    // Marquer l'activité comme terminée
    await db.update(activitesClubTable).set({ statut: "terminee", updated_at: new Date() }).where(eq(activitesClubTable.id, id));

    const presencesFinal = await db.select().from(presencesClubTable).where(eq(presencesClubTable.activite_id, id));
    const nb_presents = presencesFinal.filter(p => p.present).length;
    const nb_absents = presencesFinal.filter(p => !p.present).length;

    const [club] = await db.select({ nom: clubsTable.nom, couleur: clubsTable.couleur }).from(clubsTable).where(eq(clubsTable.id, activite.club_id)).limit(1);
    const updatedActivite = { ...activite, statut: "terminee" as const, club_nom: club?.nom ?? null, club_couleur: club?.couleur ?? null, nb_presents, nb_absents };

    const enriched = await Promise.all(presencesFinal.map(async p => {
      const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, photo_url: elevesTable.photo_url }).from(elevesTable).where(eq(elevesTable.id, p.eleve_id)).limit(1);
      const classeNom = await getClasseNom(p.eleve_id);
      return { ...p, eleve_nom: eleve?.nom ?? null, eleve_prenoms: eleve?.prenoms ?? null, eleve_photo: eleve?.photo_url ?? null, classe_nom: classeNom };
    }));

    res.json({ presences: enriched, activite: updatedActivite, nb_presents, nb_absents });
  },
);

/* GET /clubs/:clubId/membres/:eleveId/stats ──────────────────────────────── */
router.get(
  "/clubs/:clubId/membres/:eleveId/stats",
  authMiddleware,
  verifierLicence,
  requireRole(...ALL_ROLES),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);
    const eleveId = normalizeId(req.params["eleveId"]!);

    const [membre] = await db.select().from(clubMembresTable).where(and(eq(clubMembresTable.club_id, clubId), eq(clubMembresTable.eleve_id, eleveId))).limit(1);
    if (!membre) { res.status(404).json({ message: "Membre introuvable" }); return; }

    const activites = await db.select({ id: activitesClubTable.id }).from(activitesClubTable).where(and(eq(activitesClubTable.club_id, clubId), eq(activitesClubTable.statut, "terminee")));
    let nbPresents = 0;
    for (const a of activites) {
      const [p] = await db.select().from(presencesClubTable).where(and(eq(presencesClubTable.activite_id, a.id), eq(presencesClubTable.eleve_id, eleveId))).limit(1);
      if (p?.present) nbPresents++;
    }

    const distinctions = await db.select().from(distinctionsClubTable).where(and(eq(distinctionsClubTable.club_id, clubId), eq(distinctionsClubTable.eleve_id, eleveId))).orderBy(desc(distinctionsClubTable.date_obtention));
    const distEnriched = await Promise.all(distinctions.map(async d => {
      const [par] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, d.decerne_par)).limit(1);
      const [club] = await db.select({ nom: clubsTable.nom }).from(clubsTable).where(eq(clubsTable.id, d.club_id)).limit(1);
      return { ...d, club_nom: club?.nom ?? null, decerne_par_nom: par?.nom ?? null, eleve_nom: null, eleve_prenoms: null };
    }));

    const taux_presence = activites.length > 0 ? Math.round((nbPresents / activites.length) * 100) : 0;

    res.json({
      eleve_id: eleveId,
      club_id: clubId,
      nb_activites: activites.length,
      nb_presents: nbPresents,
      taux_presence,
      role_membre: membre.role_membre,
      distinctions: distEnriched,
    });
  },
);

/* ════════════════════════════════════════════════════════════════════════════
   DISTINCTIONS
═══════════════════════════════════════════════════════════════════════════ */

/* GET /clubs/:clubId/distinctions ────────────────────────────────────────── */
router.get(
  "/clubs/:clubId/distinctions",
  authMiddleware,
  verifierLicence,
  requireRole(...ALL_ROLES),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);

    const distinctions = await db.select().from(distinctionsClubTable).where(eq(distinctionsClubTable.club_id, clubId)).orderBy(desc(distinctionsClubTable.date_obtention));
    const [club] = await db.select({ nom: clubsTable.nom }).from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);

    const enriched = await Promise.all(distinctions.map(async d => {
      const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms }).from(elevesTable).where(eq(elevesTable.id, d.eleve_id)).limit(1);
      const [par] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, d.decerne_par)).limit(1);
      return { ...d, eleve_nom: eleve?.nom ?? null, eleve_prenoms: eleve?.prenoms ?? null, club_nom: club?.nom ?? null, decerne_par_nom: par?.nom ?? null };
    }));

    res.json({ distinctions: enriched, total: enriched.length });
  },
);

/* POST /clubs/:clubId/distinctions ───────────────────────────────────────── */
router.post(
  "/clubs/:clubId/distinctions",
  authMiddleware,
  verifierLicence,
  requireRole(...ADMINS, "professeur"),
  async (req, res) => {
    const clubId = normalizeId(req.params["clubId"]!);
    const { id: userId, role, etablissement_id } = req.user!;

    if (!ADMINS.includes(role) && !(await isResponsable(clubId, userId))) {
      res.status(403).json({ message: "Accès refusé" }); return;
    }

    const { eleve_id, titre, description, date_obtention } = req.body as { eleve_id: string; titre: string; description?: string; date_obtention: string };
    if (!eleve_id || !titre || !date_obtention) {
      res.status(400).json({ message: "Champs requis manquants" }); return;
    }

    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);
    if (!club) { res.status(404).json({ message: "Club introuvable" }); return; }

    const [distinction] = await db.insert(distinctionsClubTable).values({
      club_id: clubId,
      eleve_id,
      titre,
      description: description ?? null,
      date_obtention,
      decerne_par: userId,
    }).returning();

    // Notifier élève + parents
    const [eleve] = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms, utilisateur_id: elevesTable.utilisateur_id }).from(elevesTable).where(eq(elevesTable.id, eleve_id)).limit(1);
    const [decernePar] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, userId)).limit(1);
    const etabId = etablissement_id ?? club.etablissement_id;

    if (eleve?.utilisateur_id) {
      await notifyUser(etabId, eleve.utilisateur_id, `🏆 Distinction obtenue !`, `Vous avez reçu la distinction "${titre}" dans le club "${club.nom}".`, `/clubs/${clubId}`);
      const parents = await db.select({ utilisateur_id: parentsElevesTable.utilisateur_id }).from(parentsElevesTable).where(eq(parentsElevesTable.eleve_id, eleve_id));
      for (const p of parents) {
        await notifyUser(etabId, p.utilisateur_id, `Distinction obtenue par votre enfant 🏆`, `${eleve.nom} ${eleve.prenoms} a reçu la distinction "${titre}" dans le club "${club.nom}".`, `/clubs/${clubId}`);
      }
    }

    res.status(201).json({
      ...distinction!,
      eleve_nom: eleve?.nom ?? null,
      eleve_prenoms: eleve?.prenoms ?? null,
      club_nom: club.nom,
      decerne_par_nom: decernePar?.nom ?? null,
    });
  },
);

/* GET /distinctions/eleve/:eleveId ───────────────────────────────────────── */
router.get(
  "/distinctions/eleve/:eleveId",
  authMiddleware,
  verifierLicence,
  requireRole(...ALL_ROLES),
  async (req, res) => {
    const eleveId = normalizeId(req.params["eleveId"]!);

    const distinctions = await db.select().from(distinctionsClubTable).where(eq(distinctionsClubTable.eleve_id, eleveId)).orderBy(desc(distinctionsClubTable.date_obtention));
    const enriched = await Promise.all(distinctions.map(async d => {
      const [club] = await db.select({ nom: clubsTable.nom }).from(clubsTable).where(eq(clubsTable.id, d.club_id)).limit(1);
      const [par] = await db.select({ nom: utilisateursTable.nom }).from(utilisateursTable).where(eq(utilisateursTable.id, d.decerne_par)).limit(1);
      return { ...d, club_nom: club?.nom ?? null, decerne_par_nom: par?.nom ?? null, eleve_nom: null, eleve_prenoms: null };
    }));

    res.json({ distinctions: enriched, total: enriched.length });
  },
);

export default router;
