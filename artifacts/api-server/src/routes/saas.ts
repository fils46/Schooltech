import { Router } from "express";
import {
  eq, and, gte, lte, lt, desc, asc, count, sum, sql, or, isNull,
} from "drizzle-orm";
import {
  db,
  etablissementsTable,
  utilisateursTable,
  licencesTable,
  paiementsLicencesTable,
  logsActiviteSaasTable,
} from "@workspace/db";
import bcrypt from "bcrypt";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifSaasAdmin } from "../middlewares/verifSaasAdmin";
import { generateTempPassword } from "../lib/auth";

const router = Router();

/* ── Garde global : JWT + rôle dev — uniquement pour les routes /saas/* ── */
router.use("/saas", authMiddleware, verifSaasAdmin);

/* ── Helpers ────────────────────────────────────────────────────── */
function addMonths(base: Date, months: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}
function toDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

async function logAction(
  req: import("express").Request,
  action: string,
  details?: Record<string, unknown>,
  etablissementId?: string,
): Promise<void> {
  await db.insert(logsActiviteSaasTable).values({
    effectue_par: req.user!.id,
    action,
    details: details ?? null,
    etablissement_id: etablissementId ?? null,
    ip_address: (req.headers["x-forwarded-for"] as string) ?? req.socket.remoteAddress ?? null,
  });
}

/* ══════════════════════════════════════════════════════════════════
   STATS
══════════════════════════════════════════════════════════════════ */

// GET /saas/stats
router.get("/saas/stats", async (req, res): Promise<void> => {
  try {
    const now = new Date();
    const in30Days = toDate(addMonths(now, 0));
    const limit30  = toDate(new Date(now.getTime() + 30 * 86400_000));
    const startOfMonth    = toDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const startOfQuarter  = toDate(new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1));
    const startOfYear     = toDate(new Date(now.getFullYear(), 0, 1));

    const [total]    = await db.select({ c: count() }).from(etablissementsTable);
    const [actifs]   = await db.select({ c: count() }).from(etablissementsTable).where(eq(etablissementsTable.licence_active, true));
    const [suspendus]= await db.select({ c: count() }).from(etablissementsTable).where(eq(etablissementsTable.licence_active, false));

    const [essai] = await db.select({ c: count() }).from(licencesTable)
      .where(and(eq(licencesTable.type, "essai"), eq(licencesTable.actif, true)));

    const [expirant] = await db.select({ c: count() }).from(licencesTable)
      .where(and(
        eq(licencesTable.actif, true),
        gte(licencesTable.date_expiration, toDate(now)),
        lte(licencesTable.date_expiration, limit30),
      ));

    const [revMois] = await db.select({ total: sum(paiementsLicencesTable.montant) })
      .from(paiementsLicencesTable)
      .where(and(eq(paiementsLicencesTable.statut, "confirme"), gte(paiementsLicencesTable.date_paiement, startOfMonth)));

    const [revTrimestre] = await db.select({ total: sum(paiementsLicencesTable.montant) })
      .from(paiementsLicencesTable)
      .where(and(eq(paiementsLicencesTable.statut, "confirme"), gte(paiementsLicencesTable.date_paiement, startOfQuarter)));

    const [revAnnee] = await db.select({ total: sum(paiementsLicencesTable.montant) })
      .from(paiementsLicencesTable)
      .where(and(eq(paiementsLicencesTable.statut, "confirme"), gte(paiementsLicencesTable.date_paiement, startOfYear)));

    // Evolution 12 mois (nb établissements créés par mois)
    const evolution = await db.execute<{ mois: string; nb: string }>(sql`
      SELECT to_char(created_at, 'YYYY-MM') AS mois, COUNT(*) AS nb
      FROM etablissements
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY mois ORDER BY mois
    `);

    // Répartition type
    const parType = await db.execute<{ type: string; nb: string }>(sql`
      SELECT type, COUNT(*) AS nb FROM etablissements GROUP BY type
    `);

    // Répartition ville
    const parVille = await db.execute<{ ville: string; nb: string }>(sql`
      SELECT COALESCE(ville, 'Non renseignée') AS ville, COUNT(*) AS nb
      FROM etablissements GROUP BY ville ORDER BY nb DESC LIMIT 10
    `);

    // Nouveaux ce mois
    const [nouveauxMois] = await db.select({ c: count() }).from(etablissementsTable)
      .where(gte(etablissementsTable.created_at, new Date(startOfMonth)));

    res.json({
      success: true, data: {
        etablissements: {
          total: Number(total.c),
          actifs: Number(actifs.c),
          suspendus: Number(suspendus.c),
          essai: Number(essai.c),
          nouveaux_ce_mois: Number(nouveauxMois.c),
        },
        licences: {
          expirant_30j: Number(expirant.c),
        },
        revenus: {
          ce_mois:       Number(revMois.total ?? 0),
          ce_trimestre:  Number(revTrimestre.total ?? 0),
          cette_annee:   Number(revAnnee.total ?? 0),
        },
        evolution: (evolution.rows ?? evolution as unknown as { mois: string; nb: string }[]).map((r: { mois: string; nb: string }) => ({
          mois: r.mois,
          nb: Number(r.nb),
        })),
        par_type:  (parType.rows ?? parType as unknown as { type: string; nb: string }[]).map((r: { type: string; nb: string }) => ({ type: r.type, nb: Number(r.nb) })),
        par_ville: (parVille.rows ?? parVille as unknown as { ville: string; nb: string }[]).map((r: { ville: string; nb: string }) => ({ ville: r.ville, nb: Number(r.nb) })),
      },
    });
  } catch (err) {
    req.log.error({ err }, "saas/stats error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

/* ══════════════════════════════════════════════════════════════════
   ÉTABLISSEMENTS
══════════════════════════════════════════════════════════════════ */

// GET /saas/etablissements
router.get("/saas/etablissements", async (req, res): Promise<void> => {
  try {
    const { licence_active, type, ville } = req.query as Record<string, string>;

    const conditions: import("drizzle-orm").SQL[] = [];
    if (licence_active !== undefined) {
      conditions.push(eq(etablissementsTable.licence_active, licence_active === "true"));
    }
    if (type) conditions.push(eq(etablissementsTable.type, type));
    if (ville) conditions.push(eq(etablissementsTable.ville, ville));

    const etabs = await db
      .select()
      .from(etablissementsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(etablissementsTable.created_at));

    const result = await Promise.all(etabs.map(async (e) => {
      const [licence] = await db.select()
        .from(licencesTable)
        .where(and(eq(licencesTable.etablissement_id, e.id), eq(licencesTable.actif, true)))
        .orderBy(desc(licencesTable.created_at))
        .limit(1);

      const [nbUsers] = await db.select({ c: count() })
        .from(utilisateursTable)
        .where(eq(utilisateursTable.etablissement_id, e.id));

      const [nbEleves] = await db.select({ c: count() })
        .from(utilisateursTable)
        .where(and(eq(utilisateursTable.etablissement_id, e.id), eq(utilisateursTable.role, "eleve")));

      return {
        ...e,
        licence: licence ?? null,
        nb_utilisateurs: Number(nbUsers.c),
        nb_eleves: Number(nbEleves.c),
      };
    }));

    res.json({ success: true, data: result });
  } catch (err) {
    req.log.error({ err }, "saas/etablissements GET error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// POST /saas/etablissements — création cascade
router.post("/saas/etablissements", async (req, res): Promise<void> => {
  try {
    const {
      nom, type, ville, adresse, telephone, email_contact,
      nom_directeur, prenom_directeur, email_directeur,
      licence_type, licence_duree_mois, montant_licence,
    } = req.body as Record<string, string>;

    if (!nom || !email_directeur || !licence_type || !licence_duree_mois || !montant_licence) {
      res.status(400).json({ success: false, message: "Champs obligatoires manquants." });
      return;
    }

    const duree = Number(licence_duree_mois);
    const montant = Number(montant_licence);

    // 1. Créer l'établissement
    const [etab] = await db.insert(etablissementsTable).values({
      nom,
      type: type ?? null,
      ville: ville ?? null,
      adresse: adresse ?? null,
      telephone: telephone ?? null,
      email: email_contact ?? null,
      licence_active: false,
    }).returning();

    // 2. Mot de passe temporaire + directeur
    const motDePasse = generateTempPassword(10);
    const hash = await bcrypt.hash(motDePasse, 10);

    const [directeur] = await db.insert(utilisateursTable).values({
      nom: nom_directeur ?? nom,
      prenoms: prenom_directeur ?? null,
      email: email_directeur,
      password: hash,
      role: "directeur",
      etablissement_id: etab.id,
      premier_login: true,
      actif: true,
    }).returning();

    // 3. Créer la licence
    const today = new Date();
    const expiration = addMonths(today, duree);

    const [licence] = await db.insert(licencesTable).values({
      etablissement_id: etab.id,
      type: licence_type as "mensuel" | "trimestriel" | "annuel" | "essai",
      date_debut: toDate(today),
      date_expiration: toDate(expiration),
      actif: true,
      montant: String(montant),
      renouvellement_auto: false,
    }).returning();

    // 4. Activer la licence sur l'établissement
    await db.update(etablissementsTable)
      .set({ licence_active: true, date_expiration_licence: toDate(expiration) })
      .where(eq(etablissementsTable.id, etab.id));

    // 5. Logger
    await logAction(req, "etablissement_cree", {
      etablissement_nom: nom,
      directeur_email: email_directeur,
      licence_type,
      duree_mois: duree,
    }, etab.id);

    res.status(201).json({
      success: true,
      message: `Établissement ${nom} créé avec succès.`,
      data: {
        etablissement: { ...etab, licence_active: true, date_expiration_licence: toDate(expiration) },
        directeur: { ...directeur, password: undefined },
        licence,
        mot_de_passe_temporaire: motDePasse,
      },
    });
  } catch (err) {
    req.log.error({ err }, "saas/etablissements POST error");
    if ((err as any).code === "23505") {
      res.status(409).json({ success: false, message: "Un compte avec cet email existe déjà." });
    } else {
      res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  }
});

// GET /saas/etablissements/:id
router.get("/saas/etablissements/:id", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;

    const [etab] = await db.select().from(etablissementsTable).where(eq(etablissementsTable.id, id));
    if (!etab) {
      res.status(404).json({ success: false, message: "Établissement introuvable." });
      return;
    }

    const [licence] = await db.select().from(licencesTable)
      .where(and(eq(licencesTable.etablissement_id, id), eq(licencesTable.actif, true)))
      .orderBy(desc(licencesTable.created_at)).limit(1);

    const paiements = await db.select().from(paiementsLicencesTable)
      .where(eq(paiementsLicencesTable.etablissement_id, id))
      .orderBy(desc(paiementsLicencesTable.date_paiement));

    // Comptes directeur actif
    const [directeur] = await db.select({
      id: utilisateursTable.id, nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms,
      email: utilisateursTable.email, actif: utilisateursTable.actif,
    }).from(utilisateursTable).where(and(
      eq(utilisateursTable.etablissement_id, id),
      eq(utilisateursTable.role, "directeur"),
      eq(utilisateursTable.actif, true),
    )).orderBy(desc(utilisateursTable.created_at)).limit(1);

    // Stats utilisation (counts uniquement — pas de données scolaires)
    const parRole = await db.execute<{ role: string; nb: string }>(sql`
      SELECT role, COUNT(*) AS nb FROM utilisateurs WHERE etablissement_id = ${id} GROUP BY role
    `);

    const rows = (parRole.rows ?? parRole as unknown as { role: string; nb: string }[]);
    const stats: Record<string, number> = {};
    for (const r of rows) stats[r.role] = Number(r.nb);

    const logs = await db.select().from(logsActiviteSaasTable)
      .where(eq(logsActiviteSaasTable.etablissement_id, id))
      .orderBy(desc(logsActiviteSaasTable.created_at))
      .limit(20);

    res.json({
      success: true, data: {
        etablissement: etab,
        directeur: directeur ?? null,
        licence: licence ?? null,
        paiements,
        stats_utilisation: stats,
        logs,
      },
    });
  } catch (err) {
    req.log.error({ err }, "saas/etablissements/:id GET error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// PUT /saas/etablissements/:id
router.put("/saas/etablissements/:id", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { nom, type, ville, adresse, telephone, email_contact } = req.body as Record<string, string>;

    const [updated] = await db.update(etablissementsTable)
      .set({
        ...(nom && { nom }),
        ...(type !== undefined && { type }),
        ...(ville !== undefined && { ville }),
        ...(adresse !== undefined && { adresse }),
        ...(telephone !== undefined && { telephone }),
        ...(email_contact !== undefined && { email: email_contact }),
        updated_at: new Date(),
      })
      .where(eq(etablissementsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, message: "Établissement introuvable." });
      return;
    }

    await logAction(req, "etablissement_modifie", { champs: Object.keys(req.body) }, id);
    res.json({ success: true, message: "Établissement mis à jour.", data: updated });
  } catch (err) {
    req.log.error({ err }, "saas/etablissements/:id PUT error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// PUT /saas/etablissements/:id/suspendre
router.put("/saas/etablissements/:id/suspendre", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;

    await db.update(etablissementsTable)
      .set({ licence_active: false, updated_at: new Date() })
      .where(eq(etablissementsTable.id, id));

    await db.update(licencesTable)
      .set({ actif: false, updated_at: new Date() })
      .where(eq(licencesTable.etablissement_id, id));

    await logAction(req, "etablissement_suspendu", {}, id);
    res.json({ success: true, message: "Établissement suspendu. Tous les accès sont bloqués." });
  } catch (err) {
    req.log.error({ err }, "saas/suspendre error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// PUT /saas/etablissements/:id/reactiver
router.put("/saas/etablissements/:id/reactiver", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { duree_mois } = req.body as { duree_mois?: number };

    const today = new Date();
    let expiration: string | null = null;

    const [etab] = await db.select().from(etablissementsTable).where(eq(etablissementsTable.id, id));
    if (!etab) {
      res.status(404).json({ success: false, message: "Établissement introuvable." });
      return;
    }

    // Si la licence était expirée, prolonger
    if (duree_mois) {
      expiration = toDate(addMonths(today, duree_mois));
    } else if (etab.date_expiration_licence && etab.date_expiration_licence < toDate(today)) {
      expiration = toDate(addMonths(today, 1));
    } else {
      expiration = etab.date_expiration_licence;
    }

    await db.update(etablissementsTable)
      .set({ licence_active: true, date_expiration_licence: expiration, updated_at: new Date() })
      .where(eq(etablissementsTable.id, id));

    await db.update(licencesTable)
      .set({ actif: true, ...(expiration ? { date_expiration: expiration } : {}), updated_at: new Date() })
      .where(eq(licencesTable.etablissement_id, id));

    await logAction(req, "etablissement_reactive", { date_expiration: expiration }, id);
    res.json({ success: true, message: "Établissement réactivé." });
  } catch (err) {
    req.log.error({ err }, "saas/reactiver error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

/* ══════════════════════════════════════════════════════════════════
   LICENCES
══════════════════════════════════════════════════════════════════ */

// GET /saas/licences/expirant (AVANT /:id pour éviter conflit)
router.get("/saas/licences/expirant", async (req, res): Promise<void> => {
  try {
    const in30Days = toDate(new Date(Date.now() + 30 * 86400_000));
    const today = toDate(new Date());

    const licences = await db
      .select({ licence: licencesTable, etablissement: etablissementsTable })
      .from(licencesTable)
      .innerJoin(etablissementsTable, eq(licencesTable.etablissement_id, etablissementsTable.id))
      .where(and(
        eq(licencesTable.actif, true),
        gte(licencesTable.date_expiration, today),
        lte(licencesTable.date_expiration, in30Days),
      ))
      .orderBy(asc(licencesTable.date_expiration));

    res.json({ success: true, data: licences });
  } catch (err) {
    req.log.error({ err }, "saas/licences/expirant error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// GET /saas/etablissements/:id/licence
router.get("/saas/etablissements/:id/licence", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;

    const [licence] = await db.select().from(licencesTable)
      .where(and(eq(licencesTable.etablissement_id, id), eq(licencesTable.actif, true)))
      .orderBy(desc(licencesTable.created_at)).limit(1);

    const paiements = await db.select().from(paiementsLicencesTable)
      .where(eq(paiementsLicencesTable.etablissement_id, id))
      .orderBy(desc(paiementsLicencesTable.date_paiement));

    res.json({ success: true, data: { licence: licence ?? null, paiements } });
  } catch (err) {
    req.log.error({ err }, "saas/licence GET error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// POST /saas/etablissements/:id/licence/renouveler
router.post("/saas/etablissements/:id/licence/renouveler", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { type, duree_mois, montant, renouvellement_auto } = req.body as Record<string, unknown>;

    const duree = Number(duree_mois);
    const today = new Date();

    const [existing] = await db.select().from(licencesTable)
      .where(and(eq(licencesTable.etablissement_id, id), eq(licencesTable.actif, true)))
      .orderBy(desc(licencesTable.created_at)).limit(1);

    const baseDate = existing?.date_expiration && existing.date_expiration > toDate(today)
      ? new Date(existing.date_expiration)
      : today;
    const newExpiration = toDate(addMonths(baseDate, duree));

    let licence;
    if (existing) {
      [licence] = await db.update(licencesTable)
        .set({
          type: (type as any) ?? existing.type,
          date_expiration: newExpiration,
          montant: montant !== undefined ? String(montant) : existing.montant,
          renouvellement_auto: renouvellement_auto !== undefined ? Boolean(renouvellement_auto) : existing.renouvellement_auto,
          actif: true,
          updated_at: new Date(),
        })
        .where(eq(licencesTable.id, existing.id))
        .returning();
    } else {
      [licence] = await db.insert(licencesTable).values({
        etablissement_id: id,
        type: (type as any) ?? "mensuel",
        date_debut: toDate(today),
        date_expiration: newExpiration,
        actif: true,
        montant: String(montant ?? 0),
        renouvellement_auto: Boolean(renouvellement_auto),
      }).returning();
    }

    await db.update(etablissementsTable)
      .set({ licence_active: true, date_expiration_licence: newExpiration, updated_at: new Date() })
      .where(eq(etablissementsTable.id, id));

    await logAction(req, "licence_renouvelee", { duree_mois: duree, nouvelle_expiration: newExpiration }, id);
    res.json({ success: true, message: "Licence renouvelée.", data: licence });
  } catch (err) {
    req.log.error({ err }, "saas/licence/renouveler error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// PUT /saas/licences/:id
router.put("/saas/licences/:id", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { type, montant, notes_admin, renouvellement_auto } = req.body as Record<string, unknown>;

    const [updated] = await db.update(licencesTable)
      .set({
        ...(type !== undefined && { type: type as any }),
        ...(montant !== undefined && { montant: String(montant) }),
        ...(notes_admin !== undefined && { notes_admin: notes_admin as string }),
        ...(renouvellement_auto !== undefined && { renouvellement_auto: Boolean(renouvellement_auto) }),
        updated_at: new Date(),
      })
      .where(eq(licencesTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ success: false, message: "Licence introuvable." });
      return;
    }

    await logAction(req, "licence_modifiee", { licence_id: id }, updated.etablissement_id);
    res.json({ success: true, message: "Licence mise à jour.", data: updated });
  } catch (err) {
    req.log.error({ err }, "saas/licences/:id PUT error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// POST /saas/licences/:id/paiements
router.post("/saas/licences/:id/paiements", async (req, res): Promise<void> => {
  try {
    const { id: licenceId } = req.params;
    const { montant, date_paiement, mode_paiement, reference, statut, note } = req.body as Record<string, string>;

    const [licence] = await db.select().from(licencesTable).where(eq(licencesTable.id, licenceId));
    if (!licence) {
      res.status(404).json({ success: false, message: "Licence introuvable." });
      return;
    }

    const [paiement] = await db.insert(paiementsLicencesTable).values({
      licence_id: licenceId,
      etablissement_id: licence.etablissement_id,
      montant: montant,
      date_paiement: date_paiement,
      mode_paiement: mode_paiement as any,
      reference: reference ?? null,
      statut: (statut as any) ?? "en_attente",
      note: note ?? null,
      enregistre_par: req.user!.id,
    }).returning();

    await logAction(req, "paiement_enregistre", {
      montant, mode_paiement, statut, reference,
    }, licence.etablissement_id);

    res.status(201).json({ success: true, message: "Paiement enregistré.", data: paiement });
  } catch (err) {
    req.log.error({ err }, "saas/licences/:id/paiements error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// GET /saas/paiements
router.get("/saas/paiements", async (req, res): Promise<void> => {
  try {
    const { statut, mode_paiement, date_debut, date_fin, etablissement_id } = req.query as Record<string, string>;

    const conditions: import("drizzle-orm").SQL[] = [];
    if (statut) conditions.push(eq(paiementsLicencesTable.statut, statut as any));
    if (mode_paiement) conditions.push(eq(paiementsLicencesTable.mode_paiement, mode_paiement as any));
    if (date_debut) conditions.push(gte(paiementsLicencesTable.date_paiement, date_debut));
    if (date_fin) conditions.push(lte(paiementsLicencesTable.date_paiement, date_fin));
    if (etablissement_id) conditions.push(eq(paiementsLicencesTable.etablissement_id, etablissement_id));

    const paiements = await db
      .select({ paiement: paiementsLicencesTable, etablissement: { id: etablissementsTable.id, nom: etablissementsTable.nom } })
      .from(paiementsLicencesTable)
      .innerJoin(etablissementsTable, eq(paiementsLicencesTable.etablissement_id, etablissementsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(paiementsLicencesTable.date_paiement));

    res.json({ success: true, data: paiements });
  } catch (err) {
    req.log.error({ err }, "saas/paiements error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

/* ══════════════════════════════════════════════════════════════════
   DIRECTEURS
══════════════════════════════════════════════════════════════════ */

// GET /saas/directeurs
router.get("/saas/directeurs", async (req, res): Promise<void> => {
  try {
    const { actif, etablissement_id } = req.query as Record<string, string>;

    const conditions: import("drizzle-orm").SQL[] = [eq(utilisateursTable.role, "directeur")];
    if (actif !== undefined) conditions.push(eq(utilisateursTable.actif, actif === "true"));
    if (etablissement_id) conditions.push(eq(utilisateursTable.etablissement_id, etablissement_id));

    const directeurs = await db
      .select({
        id: utilisateursTable.id,
        nom: utilisateursTable.nom,
        prenoms: utilisateursTable.prenoms,
        email: utilisateursTable.email,
        actif: utilisateursTable.actif,
        premier_login: utilisateursTable.premier_login,
        etablissement_id: utilisateursTable.etablissement_id,
        created_at: utilisateursTable.created_at,
        etablissement: { id: etablissementsTable.id, nom: etablissementsTable.nom },
      })
      .from(utilisateursTable)
      .leftJoin(etablissementsTable, eq(utilisateursTable.etablissement_id, etablissementsTable.id))
      .where(and(...conditions))
      .orderBy(desc(utilisateursTable.created_at));

    res.json({ success: true, data: directeurs });
  } catch (err) {
    req.log.error({ err }, "saas/directeurs error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

// POST /saas/etablissements/:id/directeur
router.post("/saas/etablissements/:id/directeur", async (req, res): Promise<void> => {
  try {
    const { id: etabId } = req.params;
    const { nom, prenoms, email, telephone } = req.body as Record<string, string>;

    if (!nom || !email) {
      res.status(400).json({ success: false, message: "Nom et email obligatoires." });
      return;
    }

    // Désactiver l'ancien directeur
    await db.update(utilisateursTable)
      .set({ actif: false })
      .where(and(
        eq(utilisateursTable.etablissement_id, etabId),
        eq(utilisateursTable.role, "directeur"),
        eq(utilisateursTable.actif, true),
      ));

    const motDePasse = generateTempPassword(10);
    const hash = await bcrypt.hash(motDePasse, 10);

    const [directeur] = await db.insert(utilisateursTable).values({
      nom, prenoms: prenoms ?? null, email, telephone: telephone ?? null,
      password: hash, role: "directeur",
      etablissement_id: etabId, premier_login: true, actif: true,
    }).returning();

    await logAction(req, "directeur_cree", { email, nom }, etabId);
    res.status(201).json({
      success: true,
      message: "Compte directeur créé.",
      data: { directeur: { ...directeur, password: undefined }, mot_de_passe_temporaire: motDePasse },
    });
  } catch (err) {
    req.log.error({ err }, "saas/directeur POST error");
    if ((err as any).code === "23505") {
      res.status(409).json({ success: false, message: "Un compte avec cet email existe déjà." });
    } else {
      res.status(500).json({ success: false, message: "Erreur serveur." });
    }
  }
});

// POST /saas/directeurs/:id/reinitialiser
router.post("/saas/directeurs/:id/reinitialiser", async (req, res): Promise<void> => {
  try {
    const { id } = req.params;

    const [directeur] = await db.select().from(utilisateursTable)
      .where(and(eq(utilisateursTable.id, id), eq(utilisateursTable.role, "directeur")));
    if (!directeur) {
      res.status(404).json({ success: false, message: "Directeur introuvable." });
      return;
    }

    const motDePasse = generateTempPassword(10);
    const hash = await bcrypt.hash(motDePasse, 10);

    await db.update(utilisateursTable)
      .set({ password: hash, premier_login: true })
      .where(eq(utilisateursTable.id, id));

    await logAction(req, "mot_de_passe_reinitialise", { directeur_email: directeur.email }, directeur.etablissement_id ?? undefined);
    res.json({
      success: true,
      message: "Mot de passe réinitialisé.",
      data: { mot_de_passe_temporaire: motDePasse },
    });
  } catch (err) {
    req.log.error({ err }, "saas/directeurs/reinitialiser error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

/* ══════════════════════════════════════════════════════════════════
   LOGS
══════════════════════════════════════════════════════════════════ */

// GET /saas/logs
router.get("/saas/logs", async (req, res): Promise<void> => {
  try {
    const { etablissement_id, action, date_debut, date_fin, page = "1", limit = "50" } = req.query as Record<string, string>;

    const conditions: import("drizzle-orm").SQL[] = [];
    if (etablissement_id) conditions.push(eq(logsActiviteSaasTable.etablissement_id, etablissement_id));
    if (action) conditions.push(eq(logsActiviteSaasTable.action, action));
    if (date_debut) conditions.push(gte(logsActiviteSaasTable.created_at, new Date(date_debut)));
    if (date_fin) conditions.push(lte(logsActiviteSaasTable.created_at, new Date(date_fin)));

    const offset = (Number(page) - 1) * Number(limit);

    const [totalResult] = await db.select({ c: count() })
      .from(logsActiviteSaasTable)
      .where(conditions.length ? and(...conditions) : undefined);

    const logs = await db
      .select({ log: logsActiviteSaasTable, etablissement: { nom: etablissementsTable.nom } })
      .from(logsActiviteSaasTable)
      .leftJoin(etablissementsTable, eq(logsActiviteSaasTable.etablissement_id, etablissementsTable.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(logsActiviteSaasTable.created_at))
      .limit(Number(limit))
      .offset(offset);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total: Number(totalResult.c),
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(Number(totalResult.c) / Number(limit)),
        },
      },
    });
  } catch (err) {
    req.log.error({ err }, "saas/logs error");
    res.status(500).json({ success: false, message: "Erreur serveur." });
  }
});

export default router;
