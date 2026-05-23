import { Router } from "express";
import { eq, and, desc, count, sql, gte, lte } from "drizzle-orm";
import {
  db, annoncesTable, annonceLecturesTable, utilisateursTable, notificationsTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { emitNotification, emitNouvelleAnnonce } from "../socket/socketManager";

const router = Router();
const ADMINS = ["dev", "directeur", "censeur"];

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

/* Enrich annonce with auteur info */
async function enrichirAnnonce(row: typeof annoncesTable.$inferSelect, userId?: string) {
  const [auteur] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms, role: utilisateursTable.role })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, row.auteur_id))
    .limit(1);

  let lu = false;
  if (userId) {
    const [lecture] = await db
      .select({ id: annonceLecturesTable.id })
      .from(annonceLecturesTable)
      .where(and(
        eq(annonceLecturesTable.annonce_id, row.id),
        eq(annonceLecturesTable.utilisateur_id, userId),
      ))
      .limit(1);
    lu = !!lecture;
  }

  return {
    ...row,
    auteur_nom: auteur?.nom ?? "",
    auteur_prenoms: auteur?.prenoms ?? "",
    auteur_role: auteur?.role ?? "",
    lu,
  };
}

/* Notify all targeted users in establishment */
async function notifierDestinataires(
  annonce: typeof annoncesTable.$inferSelect,
  auteurNom: string,
) {
  const dest = annonce.destinataires ?? ["tous"];
  let userQuery = db
    .select({ id: utilisateursTable.id, role: utilisateursTable.role })
    .from(utilisateursTable)
    .where(
      and(
        eq(utilisateursTable.etablissement_id, annonce.etablissement_id),
        eq(utilisateursTable.actif, true),
      )
    );

  const users = await userQuery;
  const targets = users.filter(u =>
    dest.includes("tous") || dest.includes(u.role)
  ).filter(u => u.id !== annonce.auteur_id);

  const badge: Record<string, string> = {
    information: "ℹ️",
    urgence: "🚨",
    evenement: "📅",
    rappel: "🔔",
  };

  for (const u of targets) {
    const [notif] = await db.insert(notificationsTable).values({
      etablissement_id: annonce.etablissement_id,
      destinataire_id: u.id,
      type: "annonce",
      titre: `${badge[annonce.type] ?? "📢"} ${annonce.titre}`,
      contenu: annonce.contenu.slice(0, 200),
      lien: `/annonces`,
    }).returning();

    await emitNotification(u.id, {
      id: notif.id,
      type: "annonce",
      titre: notif.titre,
      contenu: notif.contenu,
      lien: "/annonces",
      created_at: notif.created_at,
    });
  }

  /* Broadcast annonce via socket to role rooms */
  await emitNouvelleAnnonce(annonce.etablissement_id, dest, {
    id: annonce.id,
    titre: annonce.titre,
    type: annonce.type,
    auteur: auteurNom,
  });
}

/* ── GET /api/annonces ──────────────────────────────────────── */
router.get("/annonces", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const { type, date_debut, date_fin } = req.query as Record<string, string>;
  const publie  = req.query["publie"]  as string | undefined;
  const epingle = req.query["epingle"] as string | undefined;

  const isAdmin = ADMINS.includes(user.role);
  const isDev   = user.role === "dev";
  const etabId  = user.etablissement_id ?? null;

  const conditions: ReturnType<typeof eq>[] = [];

  /* dev voit tout ; autres rôles filtrés par établissement */
  if (!isDev) {
    if (!etabId) { res.json({ annonces: [], total: 0 }); return; }
    conditions.push(eq(annoncesTable.etablissement_id, etabId));
  }

  /* Non-admins: seules les annonces publiées dont ils sont destinataires */
  if (!isAdmin) {
    conditions.push(eq(annoncesTable.publie, true));
    conditions.push(
      sql`(NOW() >= ${annoncesTable.date_publication} OR ${annoncesTable.date_publication} IS NULL)`
    );
    conditions.push(
      sql`(${annoncesTable.date_expiration} IS NULL OR ${annoncesTable.date_expiration} > NOW())`
    );
  }

  /* Filtre destinataires : l'utilisateur doit être dans la liste (sauf dev qui voit tout) */
  if (!isDev) {
    conditions.push(
      sql`('tous' = ANY(${annoncesTable.destinataires}) OR ${user.role} = ANY(${annoncesTable.destinataires}))`
    );
  }

  if (type)  conditions.push(eq(annoncesTable.type, type as "information" | "urgence" | "evenement" | "rappel"));
  if (publie !== undefined && isAdmin) conditions.push(eq(annoncesTable.publie, publie === "true"));
  if (epingle !== undefined) conditions.push(eq(annoncesTable.epingle, epingle === "true"));
  if (date_debut) conditions.push(gte(annoncesTable.date_publication, new Date(date_debut)));
  if (date_fin)   conditions.push(lte(annoncesTable.date_publication, new Date(date_fin)));

  const [{ total }] = await db.select({ total: count() }).from(annoncesTable).where(and(...conditions));
  const rows = await db
    .select()
    .from(annoncesTable)
    .where(and(...conditions))
    .orderBy(desc(annoncesTable.epingle), desc(annoncesTable.date_publication));

  const annonces = await Promise.all(rows.map(r => enrichirAnnonce(r, user.id)));
  res.json({ annonces, total });
});

/* ── POST /api/annonces ─────────────────────────────────────── */
router.post("/annonces", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!ADMINS.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const {
    titre, contenu, type = "information", destinataires = ["tous"],
    date_publication, date_expiration, publie = false, epingle = false,
    piece_jointe_url, piece_jointe_nom,
  } = req.body as {
    titre: string; contenu: string; type?: string;
    destinataires?: string[]; date_publication?: string;
    date_expiration?: string; publie?: boolean; epingle?: boolean;
    piece_jointe_url?: string; piece_jointe_nom?: string;
  };

  if (!titre?.trim() || !contenu?.trim()) {
    res.status(400).json({ message: "Titre et contenu requis." }); return;
  }

  if (!user.etablissement_id) {
    res.status(400).json({ message: "Aucun établissement assigné à ce compte." }); return;
  }

  const [annonce] = await db.insert(annoncesTable).values({
    etablissement_id: user.etablissement_id,
    auteur_id: user.id,
    titre: titre.trim(),
    contenu: contenu.trim(),
    type: (type as "information" | "urgence" | "evenement" | "rappel"),
    destinataires,
    date_publication: date_publication ? new Date(date_publication) : (publie ? new Date() : null),
    date_expiration: date_expiration ? new Date(date_expiration) : null,
    publie,
    epingle,
    piece_jointe_url: piece_jointe_url ?? null,
    piece_jointe_nom: piece_jointe_nom ?? null,
  }).returning();

  if (publie) {
    await notifierDestinataires(annonce, user.nom ?? "");
  }

  const enriched = await enrichirAnnonce(annonce, user.id);
  res.status(201).json({ annonce: enriched });
});

/* ── GET /api/annonces/non-lues/count ───────────────────────── */
router.get("/annonces/non-lues/count", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const etabId = user.etablissement_id ?? null;

  if (!etabId) { res.json({ count: 0 }); return; }

  const rows = await db
    .select({ id: annoncesTable.id })
    .from(annoncesTable)
    .where(and(
      eq(annoncesTable.etablissement_id, etabId),
      eq(annoncesTable.publie, true),
      sql`(NOW() >= ${annoncesTable.date_publication} OR ${annoncesTable.date_publication} IS NULL)`,
      sql`(${annoncesTable.date_expiration} IS NULL OR ${annoncesTable.date_expiration} > NOW())`,
      sql`('tous' = ANY(${annoncesTable.destinataires}) OR ${user.role} = ANY(${annoncesTable.destinataires}))`,
    ));

  const lues = await db
    .select({ annonce_id: annonceLecturesTable.annonce_id })
    .from(annonceLecturesTable)
    .where(eq(annonceLecturesTable.utilisateur_id, user.id));

  const lueSet = new Set(lues.map(l => l.annonce_id));
  const count = rows.filter(r => !lueSet.has(r.id)).length;
  res.json({ count });
});

/* ── GET /api/annonces/:id ──────────────────────────────────── */
router.get("/annonces/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [annonce] = await db.select().from(annoncesTable).where(eq(annoncesTable.id, id)).limit(1);
  if (!annonce) { res.status(404).json({ message: "Annonce introuvable." }); return; }

  const isAdmin = ADMINS.includes(user.role);
  const isAuteur = annonce.auteur_id === user.id;

  if (!annonce.publie && !isAdmin && !isAuteur) {
    res.status(403).json({ message: "Annonce non publiée." }); return;
  }

  /* Vérifier destinataires */
  if (!isAdmin && !isAuteur && !annonce.destinataires.includes("tous") && !annonce.destinataires.includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  /* Marquer comme lue (upsert) */
  await db.insert(annonceLecturesTable).values({
    annonce_id: id,
    utilisateur_id: user.id,
  }).onConflictDoNothing();

  /* Incrémenter nb_vues */
  await db.update(annoncesTable).set({ nb_vues: sql`${annoncesTable.nb_vues} + 1`, updated_at: new Date() })
    .where(eq(annoncesTable.id, id));

  const enriched = await enrichirAnnonce({ ...annonce, nb_vues: annonce.nb_vues + 1 }, user.id);

  let stats = null;
  if (isAdmin || isAuteur) {
    const lectures = await db
      .select({
        utilisateur_id: annonceLecturesTable.utilisateur_id,
        lu_le: annonceLecturesTable.lu_le,
        nom: utilisateursTable.nom,
        prenoms: utilisateursTable.prenoms,
      })
      .from(annonceLecturesTable)
      .leftJoin(utilisateursTable, eq(annonceLecturesTable.utilisateur_id, utilisateursTable.id))
      .where(eq(annonceLecturesTable.annonce_id, id));

    stats = { nb_vues: annonce.nb_vues + 1, nb_lecteurs: lectures.length, lectures };
  }

  res.json({ annonce: enriched, stats });
});

/* ── PUT /api/annonces/:id ──────────────────────────────────── */
router.put("/annonces/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [existing] = await db.select().from(annoncesTable).where(eq(annoncesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Annonce introuvable." }); return; }

  const isAdmin = ADMINS.includes(user.role);
  if (existing.auteur_id !== user.id && !isAdmin) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  const {
    titre, contenu, type, destinataires, date_publication, date_expiration,
    epingle, publie, piece_jointe_url, piece_jointe_nom,
  } = req.body as Partial<{
    titre: string; contenu: string; type: string; destinataires: string[];
    date_publication: string; date_expiration: string;
    epingle: boolean; publie: boolean; piece_jointe_url: string; piece_jointe_nom: string;
  }>;

  const [updated] = await db.update(annoncesTable).set({
    ...(titre       !== undefined && { titre: titre.trim() }),
    ...(contenu     !== undefined && { contenu: contenu.trim() }),
    ...(type        !== undefined && { type: type as "information" | "urgence" | "evenement" | "rappel" }),
    ...(destinataires !== undefined && { destinataires }),
    ...(date_publication !== undefined && { date_publication: date_publication ? new Date(date_publication) : null }),
    ...(date_expiration  !== undefined && { date_expiration:  date_expiration  ? new Date(date_expiration)  : null }),
    ...(epingle !== undefined && { epingle }),
    ...(publie  !== undefined && { publie }),
    ...(piece_jointe_url !== undefined && { piece_jointe_url }),
    ...(piece_jointe_nom !== undefined && { piece_jointe_nom }),
    updated_at: new Date(),
  }).where(eq(annoncesTable.id, id)).returning();

  const enriched = await enrichirAnnonce(updated, user.id);
  res.json({ annonce: enriched });
});

/* ── DELETE /api/annonces/:id ───────────────────────────────── */
router.delete("/annonces/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [existing] = await db.select().from(annoncesTable).where(eq(annoncesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Annonce introuvable." }); return; }

  const isAdmin = ADMINS.includes(user.role);
  if (existing.auteur_id !== user.id && !isAdmin) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  await db.delete(annonceLecturesTable).where(eq(annonceLecturesTable.annonce_id, id));
  await db.delete(annoncesTable).where(eq(annoncesTable.id, id));
  res.json({ message: "Annonce supprimée." });
});

/* ── PUT /api/annonces/:id/publier ──────────────────────────── */
router.put("/annonces/:id/publier", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!ADMINS.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const id = normalizeId(req.params["id"]);
  const [existing] = await db.select().from(annoncesTable).where(eq(annoncesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Annonce introuvable." }); return; }

  const [annonce] = await db.update(annoncesTable).set({
    publie: true,
    date_publication: existing.date_publication ?? new Date(),
    updated_at: new Date(),
  }).where(eq(annoncesTable.id, id)).returning();

  await notifierDestinataires(annonce, user.nom ?? "");

  const enriched = await enrichirAnnonce(annonce, user.id);
  res.json({ annonce: enriched });
});

/* ── GET /api/annonces/:id/stats ────────────────────────────── */
router.get("/annonces/:id/stats", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!ADMINS.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const id = normalizeId(req.params["id"]);
  const [annonce] = await db.select({ nb_vues: annoncesTable.nb_vues }).from(annoncesTable)
    .where(eq(annoncesTable.id, id)).limit(1);
  if (!annonce) { res.status(404).json({ message: "Annonce introuvable." }); return; }

  const lectures = await db
    .select({
      utilisateur_id: annonceLecturesTable.utilisateur_id,
      lu_le: annonceLecturesTable.lu_le,
      nom: utilisateursTable.nom,
      prenoms: utilisateursTable.prenoms,
    })
    .from(annonceLecturesTable)
    .leftJoin(utilisateursTable, eq(annonceLecturesTable.utilisateur_id, utilisateursTable.id))
    .where(eq(annonceLecturesTable.annonce_id, id));

  res.json({ nb_vues: annonce.nb_vues, nb_lecteurs: lectures.length, lectures });
});

export default router;
