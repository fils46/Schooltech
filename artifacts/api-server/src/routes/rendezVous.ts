import { Router } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  db, rendezVousTable, utilisateursTable, elevesTable,
  parentsElevesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { emitNotification } from "../socket/socketManager";

const router = Router();

async function enrichirRdv(rdv: typeof rendezVousTable.$inferSelect) {
  const [parent]    = await db.select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms }).from(utilisateursTable).where(eq(utilisateursTable.id, rdv.parent_id)).limit(1);
  const [eleve]     = await db.select({ nom: elevesTable.nom, prenoms: elevesTable.prenoms }).from(elevesTable).where(eq(elevesTable.id, rdv.eleve_id)).limit(1);
  const [prof]      = rdv.professeur_id
    ? await db.select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms }).from(utilisateursTable).where(eq(utilisateursTable.id, rdv.professeur_id)).limit(1).then(r => r)
    : [null];
  const [directeur] = rdv.directeur_id
    ? await db.select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms }).from(utilisateursTable).where(eq(utilisateursTable.id, rdv.directeur_id)).limit(1).then(r => r)
    : [null];

  return {
    ...rdv,
    parent_nom:      parent?.nom ?? "",
    parent_prenoms:  parent?.prenoms ?? "",
    eleve_nom:       eleve?.nom ?? "",
    eleve_prenoms:   eleve?.prenoms ?? "",
    professeur_nom:  prof ? `${prof.prenoms} ${prof.nom}` : null,
    directeur_nom:   directeur ? `${directeur.prenoms} ${directeur.nom}` : null,
  };
}

/* ── GET /api/rendez-vous/liste ─────────────────────────────── */
router.get("/rendez-vous/liste", authMiddleware, async (req, res) => {
  const user = req.user!;
  const { statut, date_debut, date_fin } = req.query as Record<string, string>;

  const conditions = [];

  if (user.role === "parent") {
    conditions.push(eq(rendezVousTable.parent_id, user.id));
  } else if (user.role === "professeur") {
    conditions.push(eq(rendezVousTable.professeur_id, user.id));
  } else if (user.role === "directeur") {
    conditions.push(
      eq(rendezVousTable.directeur_id, user.id)
    );
  } else if (!["dev", "censeur"].includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  if (user.etablissement_id) conditions.push(eq(rendezVousTable.etablissement_id, user.etablissement_id));
  if (statut)      conditions.push(eq(rendezVousTable.statut, statut as "en_attente" | "confirme" | "annule" | "termine"));
  if (date_debut)  conditions.push(gte(rendezVousTable.date_rdv, date_debut));
  if (date_fin)    conditions.push(lte(rendezVousTable.date_rdv, date_fin));

  const rows = await db.select().from(rendezVousTable).where(conditions.length > 0 ? and(...conditions) : undefined).orderBy(rendezVousTable.date_rdv);
  const enriched = await Promise.all(rows.map(enrichirRdv));
  res.json({ rdvs: enriched });
});

/* ── POST /api/rendez-vous/demander ─────────────────────────── */
router.post("/rendez-vous/demander", authMiddleware, async (req, res) => {
  const user = req.user!;
  if (user.role !== "parent") { res.status(403).json({ message: "Accès parent uniquement." }); return; }

  const { professeur_id, directeur_id, eleve_id, motif, date_rdv, heure_rdv, duree_minutes } =
    req.body as {
      professeur_id?: string; directeur_id?: string; eleve_id: string;
      motif: string; date_rdv: string; heure_rdv: string; duree_minutes?: number;
    };

  if (!eleve_id || !motif?.trim() || !date_rdv || !heure_rdv) {
    res.status(400).json({ message: "Champs obligatoires manquants." }); return;
  }
  if (!professeur_id && !directeur_id) {
    res.status(400).json({ message: "professeur_id ou directeur_id requis." }); return;
  }

  /* Vérifier le lien parent ↔ élève */
  const [lien] = await db.select().from(parentsElevesTable).where(and(eq(parentsElevesTable.utilisateur_id, user.id), eq(parentsElevesTable.eleve_id, eleve_id))).limit(1);
  if (!lien) { res.status(403).json({ message: "Cet élève n'est pas votre enfant." }); return; }

  const [rdv] = await db
    .insert(rendezVousTable)
    .values({
      etablissement_id: user.etablissement_id ?? "",
      parent_id: user.id,
      professeur_id: professeur_id ?? null,
      directeur_id: directeur_id ?? null,
      eleve_id,
      motif: motif.trim(),
      date_rdv,
      heure_rdv,
      duree_minutes: duree_minutes ?? 30,
      statut: "en_attente",
    })
    .returning();

  const enriched = await enrichirRdv(rdv);
  const interlocuteurId = professeur_id ?? directeur_id!;

  /* Notifier l'interlocuteur */
  await emitNotification(interlocuteurId, {
    id: `rdv_${rdv.id}`,
    type: "demande_rdv",
    titre: "Nouvelle demande de rendez-vous",
    contenu: `${enriched.parent_prenoms} ${enriched.parent_nom} demande un RDV le ${date_rdv} à ${heure_rdv} concernant ${enriched.eleve_prenoms} ${enriched.eleve_nom}.`,
    lien: `/rendez-vous`,
    created_at: new Date(),
  });

  /* Notifications RDV : socket-only, pas d'insertion en DB (types non standards) */

  res.status(201).json({ rdv: enriched });
});

/* ── PUT /api/rendez-vous/:id/confirmer ─────────────────────── */
router.put("/rendez-vous/:id/confirmer", authMiddleware, async (req, res) => {
  const user = req.user!;
  if (!["directeur","censeur","professeur"].includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const id = req.params["id"] as string;
  const { lieu, notes_rdv } = req.body as { lieu?: string; notes_rdv?: string };

  const [existing] = await db.select().from(rendezVousTable).where(eq(rendezVousTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Rendez-vous introuvable." }); return; }

  const [updated] = await db
    .update(rendezVousTable)
    .set({ statut: "confirme", lieu: lieu ?? null, notes_rdv: notes_rdv ?? null, updated_at: new Date() })
    .where(eq(rendezVousTable.id, id))
    .returning();

  const enriched = await enrichirRdv(updated);

  await emitNotification(existing.parent_id, {
    id: `rdv_conf_${id}`,
    type: "rdv_confirme",
    titre: "Rendez-vous confirmé",
    contenu: `Votre rendez-vous du ${existing.date_rdv} à ${existing.heure_rdv} est confirmé.${lieu ? ` Lieu : ${lieu}` : ""}`,
    lien: "/rendez-vous",
    created_at: new Date(),
  });

  res.json({ rdv: enriched });
});

/* ── PUT /api/rendez-vous/:id/annuler ───────────────────────── */
router.put("/rendez-vous/:id/annuler", authMiddleware, async (req, res) => {
  const user = req.user!;
  const id = req.params["id"] as string;

  const [existing] = await db.select().from(rendezVousTable).where(eq(rendezVousTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Rendez-vous introuvable." }); return; }

  const isParent = user.role === "parent" && existing.parent_id === user.id;
  const isStaff  = ["directeur","censeur","professeur"].includes(user.role);
  if (!isParent && !isStaff) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const [updated] = await db
    .update(rendezVousTable)
    .set({ statut: "annule", updated_at: new Date() })
    .where(eq(rendezVousTable.id, id))
    .returning();

  /* Notifier l'autre partie */
  const notifierId = user.id === existing.parent_id
    ? (existing.professeur_id ?? existing.directeur_id)
    : existing.parent_id;

  if (notifierId) {
    await emitNotification(notifierId, {
      id: `rdv_ann_${id}`,
      type: "rdv_annule",
      titre: "Rendez-vous annulé",
      contenu: `Le rendez-vous du ${existing.date_rdv} à ${existing.heure_rdv} a été annulé.`,
      lien: "/rendez-vous",
      created_at: new Date(),
    });
  }

  res.json({ rdv: await enrichirRdv(updated) });
});

/* ── PUT /api/rendez-vous/:id/terminer ──────────────────────── */
router.put("/rendez-vous/:id/terminer", authMiddleware, async (req, res) => {
  const user = req.user!;
  if (!["directeur","censeur","professeur"].includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const id = req.params["id"] as string;
  const [updated] = await db
    .update(rendezVousTable)
    .set({ statut: "termine", updated_at: new Date() })
    .where(eq(rendezVousTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ message: "Rendez-vous introuvable." }); return; }
  res.json({ rdv: await enrichirRdv(updated) });
});

export default router;
