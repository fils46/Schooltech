import { Router } from "express";
import { eq, and, desc, count, sql, ilike, or } from "drizzle-orm";
import {
  db, sujetsExamensTable, utilisateursTable, notificationsTable, elevesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { emitNotification } from "../socket/socketManager";

const router = Router();
const GESTIONNAIRES = ["dev", "directeur", "censeur", "professeur"];
const ADMINS = ["dev", "directeur", "censeur"];

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

/* ── GET /examens/sujets ──────────────────────────────── */
router.get("/examens/sujets", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const { matiere, type_examen, serie, niveau, q } = req.query as Record<string, string>;
  const annee = req.query["annee"] ? parseInt(req.query["annee"] as string, 10) : undefined;
  const publie = req.query["publie"] as string | undefined;
  const isAdmin = ADMINS.includes(user.role);
  const etabId = user.etablissement_id ?? null;

  const conditions: ReturnType<typeof eq>[] = [];

  if (etabId) conditions.push(eq(sujetsExamensTable.etablissement_id, etabId));

  if (["eleve", "parent"].includes(user.role)) {
    conditions.push(eq(sujetsExamensTable.publie, true));
  } else if (publie !== undefined) {
    conditions.push(eq(sujetsExamensTable.publie, publie === "true"));
  }

  if (matiere)     conditions.push(eq(sujetsExamensTable.matiere, matiere));
  if (type_examen) conditions.push(eq(sujetsExamensTable.type_examen, type_examen as "BEPC" | "BAC" | "blanc" | "entrainement"));
  if (serie)       conditions.push(eq(sujetsExamensTable.serie, serie));
  if (niveau)      conditions.push(eq(sujetsExamensTable.niveau, niveau as "3eme" | "Tle"));
  if (annee)       conditions.push(eq(sujetsExamensTable.annee, annee));

  let rows = await db
    .select({
      sujet: sujetsExamensTable,
      auteur_nom: utilisateursTable.nom,
    })
    .from(sujetsExamensTable)
    .leftJoin(utilisateursTable, eq(sujetsExamensTable.ajoute_par, utilisateursTable.id))
    .where(and(...conditions))
    .orderBy(desc(sujetsExamensTable.annee), desc(sujetsExamensTable.created_at));

  if (q) {
    const qLower = q.toLowerCase();
    rows = rows.filter(r =>
      r.sujet.titre.toLowerCase().includes(qLower) ||
      r.sujet.matiere.toLowerCase().includes(qLower)
    );
  }

  const sujets = rows.map(r => ({ ...r.sujet, auteur_nom: r.auteur_nom ?? "" }));
  res.json({ sujets, total: sujets.length });
});

/* ── POST /examens/sujets ─────────────────────────────── */
router.post("/examens/sujets", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!GESTIONNAIRES.includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }
  if (!user.etablissement_id) {
    res.status(400).json({ message: "Aucun établissement assigné." }); return;
  }

  const {
    matiere, titre, type_examen, serie, annee, niveau,
    fichier_url, fichier_nom, corrige_url, corrige_nom, publie = false,
  } = req.body as {
    matiere: string; titre: string; type_examen: string; serie?: string;
    annee?: number; niveau: string; fichier_url: string; fichier_nom: string;
    corrige_url?: string; corrige_nom?: string; publie?: boolean;
  };

  if (!matiere?.trim() || !titre?.trim() || !type_examen || !niveau || !fichier_url || !fichier_nom) {
    res.status(400).json({ message: "Champs obligatoires manquants." }); return;
  }

  const [sujet] = await db.insert(sujetsExamensTable).values({
    etablissement_id: user.etablissement_id,
    ajoute_par: user.id,
    matiere: matiere.trim(),
    titre: titre.trim(),
    type_examen: type_examen as "BEPC" | "BAC" | "blanc" | "entrainement",
    serie: serie ?? null,
    annee: annee ?? null,
    niveau: niveau as "3eme" | "Tle",
    fichier_url,
    fichier_nom,
    corrige_url: corrige_url ?? null,
    corrige_nom: corrige_nom ?? null,
    publie,
  }).returning();

  const [auteur] = await db.select({ nom: utilisateursTable.nom })
    .from(utilisateursTable).where(eq(utilisateursTable.id, sujet.ajoute_par)).limit(1);

  res.status(201).json({ sujet: { ...sujet, auteur_nom: auteur?.nom ?? "" } });
});

/* ── GET /examens/sujets/:id ──────────────────────────── */
router.get("/examens/sujets/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [row] = await db
    .select({ sujet: sujetsExamensTable, auteur_nom: utilisateursTable.nom })
    .from(sujetsExamensTable)
    .leftJoin(utilisateursTable, eq(sujetsExamensTable.ajoute_par, utilisateursTable.id))
    .where(eq(sujetsExamensTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ message: "Sujet introuvable." }); return; }

  if (["eleve", "parent"].includes(user.role) && !row.sujet.publie) {
    res.status(403).json({ message: "Sujet non publié." }); return;
  }

  await db.update(sujetsExamensTable)
    .set({ nb_telechargements: sql`${sujetsExamensTable.nb_telechargements} + 1`, updated_at: new Date() })
    .where(eq(sujetsExamensTable.id, id));

  res.json({ sujet: { ...row.sujet, nb_telechargements: row.sujet.nb_telechargements + 1, auteur_nom: row.auteur_nom ?? "" } });
});

/* ── PUT /examens/sujets/:id ──────────────────────────── */
router.put("/examens/sujets/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [existing] = await db.select().from(sujetsExamensTable).where(eq(sujetsExamensTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Sujet introuvable." }); return; }

  const isAdmin = ADMINS.includes(user.role);
  if (existing.ajoute_par !== user.id && !isAdmin) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  const {
    matiere, titre, type_examen, serie, annee, niveau,
    fichier_url, fichier_nom, corrige_url, corrige_nom, publie,
  } = req.body as Partial<{
    matiere: string; titre: string; type_examen: string; serie: string;
    annee: number; niveau: string; fichier_url: string; fichier_nom: string;
    corrige_url: string; corrige_nom: string; publie: boolean;
  }>;

  const [updated] = await db.update(sujetsExamensTable).set({
    ...(matiere     !== undefined && { matiere: matiere.trim() }),
    ...(titre       !== undefined && { titre: titre.trim() }),
    ...(type_examen !== undefined && { type_examen: type_examen as "BEPC" | "BAC" | "blanc" | "entrainement" }),
    ...(serie       !== undefined && { serie }),
    ...(annee       !== undefined && { annee }),
    ...(niveau      !== undefined && { niveau: niveau as "3eme" | "Tle" }),
    ...(fichier_url !== undefined && { fichier_url }),
    ...(fichier_nom !== undefined && { fichier_nom }),
    ...(corrige_url !== undefined && { corrige_url }),
    ...(corrige_nom !== undefined && { corrige_nom }),
    ...(publie      !== undefined && { publie }),
    updated_at: new Date(),
  }).where(eq(sujetsExamensTable.id, id)).returning();

  const [auteur] = await db.select({ nom: utilisateursTable.nom })
    .from(utilisateursTable).where(eq(utilisateursTable.id, updated.ajoute_par)).limit(1);

  res.json({ sujet: { ...updated, auteur_nom: auteur?.nom ?? "" } });
});

/* ── DELETE /examens/sujets/:id ───────────────────────── */
router.delete("/examens/sujets/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [existing] = await db.select().from(sujetsExamensTable).where(eq(sujetsExamensTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Sujet introuvable." }); return; }

  if (existing.ajoute_par !== user.id && !["dev", "directeur"].includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  await db.delete(sujetsExamensTable).where(eq(sujetsExamensTable.id, id));
  res.json({ message: "Sujet supprimé." });
});

/* ── PUT /examens/sujets/:id/publier ──────────────────── */
router.put("/examens/sujets/:id/publier", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!ADMINS.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const id = normalizeId(req.params["id"]);
  const [existing] = await db.select().from(sujetsExamensTable).where(eq(sujetsExamensTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Sujet introuvable." }); return; }

  const [sujet] = await db.update(sujetsExamensTable)
    .set({ publie: true, updated_at: new Date() })
    .where(eq(sujetsExamensTable.id, id))
    .returning();

  const etabId = sujet.etablissement_id;
  const eleves = await db
    .select({ id: utilisateursTable.id })
    .from(utilisateursTable)
    .where(and(
      eq(utilisateursTable.etablissement_id, etabId),
      eq(utilisateursTable.role, "eleve"),
      eq(utilisateursTable.actif, true),
    ));

  for (const eleve of eleves) {
    const [notif] = await db.insert(notificationsTable).values({
      etablissement_id: etabId,
      destinataire_id: eleve.id,
      type: "annonce",
      titre: `📚 Nouveau sujet disponible : ${sujet.titre}`,
      contenu: `Un nouveau sujet ${sujet.type_examen} de ${sujet.matiere} (${sujet.niveau}) a été publié.`,
      lien: "/bibliotheque-sujets",
    }).returning();
    await emitNotification(eleve.id, {
      id: notif.id, type: "annonce",
      titre: notif.titre, contenu: notif.contenu, lien: notif.lien,
      created_at: notif.created_at,
    });
  }

  const [auteur] = await db.select({ nom: utilisateursTable.nom })
    .from(utilisateursTable).where(eq(utilisateursTable.id, sujet.ajoute_par)).limit(1);

  res.json({ sujet: { ...sujet, auteur_nom: auteur?.nom ?? "" } });
});

export default router;
