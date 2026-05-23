import { Router } from "express";
import { eq, and, desc, count, sql, ilike, or, gte, inArray } from "drizzle-orm";
import {
  db,
  ressourcesTable,
  ressourceFavorisTable,
  ressourceHistoriqueTable,
  utilisateursTable,
  matieresConfigTable,
  notificationsTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { emitNotification } from "../socket/socketManager";

const router = Router();
const ADMINS = ["dev", "directeur", "censeur"];
const GESTIONNAIRES = ["dev", "directeur", "censeur", "professeur"];

type TypeRessource = "manuel" | "fiche_cours" | "exercice" | "video" | "document_officiel" | "autre";
type ActionHistorique = "consultation" | "telechargement";

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

async function enrichRessource(
  ressource: typeof ressourcesTable.$inferSelect,
  userId: string,
  matiereNomMap: Map<string, string>,
): Promise<Record<string, unknown>> {
  const [favori] = await db
    .select()
    .from(ressourceFavorisTable)
    .where(
      and(
        eq(ressourceFavorisTable.ressource_id, ressource.id),
        eq(ressourceFavorisTable.utilisateur_id, userId),
      ),
    )
    .limit(1);
  return {
    ...ressource,
    matiere_nom: ressource.matiere_id ? (matiereNomMap.get(ressource.matiere_id) ?? null) : null,
    est_favori: !!favori,
  };
}

/* ── GET /bibliotheque/ressources ─────────────────────── */
router.get("/bibliotheque/ressources", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const {
    matiere_id, type, niveau, langue, mots_cles, q, tri = "date",
  } = req.query as Record<string, string>;
  const publie = req.query["publie"] as string | undefined;
  const valide = req.query["valide"] as string | undefined;
  const page = Math.max(1, parseInt((req.query["page"] as string) || "1", 10));
  const limit = Math.min(50, parseInt((req.query["limit"] as string) || "20", 10));
  const offset = (page - 1) * limit;
  const etabId = user.etablissement_id ?? null;
  const isRestricted = ["eleve", "parent"].includes(user.role);

  const conditions: ReturnType<typeof eq>[] = [];
  if (etabId) conditions.push(eq(ressourcesTable.etablissement_id, etabId));

  // Élèves et parents ne voient que les ressources publiées et validées
  if (isRestricted) {
    conditions.push(eq(ressourcesTable.publie, true));
    conditions.push(eq(ressourcesTable.valide, true));
  } else {
    if (publie !== undefined) conditions.push(eq(ressourcesTable.publie, publie === "true"));
    if (valide !== undefined) conditions.push(eq(ressourcesTable.valide, valide === "true"));
  }
  // Professeur voit ses propres ressources non validées + toutes les publiées
  if (user.role === "professeur") {
    // Surcharge : pas de filtre strict, le where ci-dessus n'est pas appliqué
    // On retire les conditions publie/valide déjà ajoutées
    conditions.length = etabId ? 1 : 0;
    // On accepte toutes celles publiées+validées OU les siennes
    // (géré côté JS après la requête)
  }

  if (matiere_id) conditions.push(eq(ressourcesTable.matiere_id, matiere_id));
  if (type) conditions.push(eq(ressourcesTable.type, type as TypeRessource));
  if (langue) conditions.push(eq(ressourcesTable.langue, langue));

  let rows = await db
    .select({
      ressource: ressourcesTable,
      auteur_nom: utilisateursTable.nom,
      auteur_role: utilisateursTable.role,
    })
    .from(ressourcesTable)
    .leftJoin(utilisateursTable, eq(ressourcesTable.ajoute_par, utilisateursTable.id))
    .where(and(...conditions))
    .orderBy(
      tri === "consultations"
        ? desc(ressourcesTable.nb_consultations)
        : tri === "telechargements"
        ? desc(ressourcesTable.nb_telechargements)
        : desc(ressourcesTable.created_at),
    );

  // Filtre professeur : ses propres + publiées
  if (user.role === "professeur") {
    rows = rows.filter(
      (r) =>
        r.ressource.ajoute_par === user.id ||
        (r.ressource.publie && r.ressource.valide),
    );
  }

  // Filtre niveau (array contains)
  if (niveau) {
    rows = rows.filter((r) => r.ressource.niveau.includes(niveau));
  }

  // Filtre mots_cles
  if (mots_cles) {
    const kw = mots_cles.toLowerCase();
    rows = rows.filter((r) =>
      r.ressource.mots_cles?.some((m) => m.toLowerCase().includes(kw)),
    );
  }

  // Recherche full-text (titre, auteur, description, mots_cles)
  if (q) {
    const qLow = q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.ressource.titre.toLowerCase().includes(qLow) ||
        (r.ressource.auteur?.toLowerCase().includes(qLow) ?? false) ||
        (r.ressource.description?.toLowerCase().includes(qLow) ?? false) ||
        (r.ressource.mots_cles?.some((m) => m.toLowerCase().includes(qLow)) ?? false),
    );
  }

  const total = rows.length;
  const paginated = rows.slice(offset, offset + limit);

  // Charger la map des matières
  const matiereIds = [...new Set(paginated.map((r) => r.ressource.matiere_id).filter(Boolean))] as string[];
  const matiereMap = new Map<string, string>();
  if (matiereIds.length > 0) {
    const matieres = await db
      .select({ id: matieresConfigTable.id, nom: matieresConfigTable.nom_matiere })
      .from(matieresConfigTable)
      .where(inArray(matieresConfigTable.id, matiereIds));
    matieres.forEach((m) => matiereMap.set(m.id, m.nom));
  }

  // Vérifier favoris en batch
  const ressourceIds = paginated.map((r) => r.ressource.id);
  const favoris = ressourceIds.length
    ? await db
        .select({ ressource_id: ressourceFavorisTable.ressource_id })
        .from(ressourceFavorisTable)
        .where(
          and(
            inArray(ressourceFavorisTable.ressource_id, ressourceIds),
            eq(ressourceFavorisTable.utilisateur_id, user.id),
          ),
        )
    : [];
  const favoriSet = new Set(favoris.map((f) => f.ressource_id));

  const ressources = paginated.map((r) => ({
    ...r.ressource,
    auteur_nom: r.auteur_nom ?? null,
    auteur_role: r.auteur_role ?? null,
    matiere_nom: r.ressource.matiere_id ? (matiereMap.get(r.ressource.matiere_id) ?? null) : null,
    est_favori: favoriSet.has(r.ressource.id),
  }));

  res.json({ ressources, total, page, limit });
});

/* ── POST /bibliotheque/ressources ────────────────────── */
router.post("/bibliotheque/ressources", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!GESTIONNAIRES.includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }
  if (!user.etablissement_id) {
    res.status(400).json({ message: "Aucun établissement assigné." }); return;
  }

  const {
    matiere_id, titre, auteur, description, type, niveau,
    fichier_url, fichier_nom, fichier_taille, fichier_type,
    couverture_url, mots_cles, langue = "fr",
  } = req.body as {
    matiere_id?: string; titre: string; auteur?: string; description?: string;
    type: TypeRessource; niveau: string[]; fichier_url: string; fichier_nom: string;
    fichier_taille?: number; fichier_type?: string; couverture_url?: string;
    mots_cles?: string[]; langue?: string;
  };

  if (!titre?.trim() || !type || !niveau?.length || !fichier_url || !fichier_nom) {
    res.status(400).json({ message: "Champs obligatoires manquants." }); return;
  }

  const isAdmin = ADMINS.includes(user.role);
  const valide = isAdmin;
  const publie = isAdmin;

  const [ressource] = await db.insert(ressourcesTable).values({
    etablissement_id: user.etablissement_id,
    ajoute_par: user.id,
    matiere_id: matiere_id ?? null,
    titre: titre.trim(),
    auteur: auteur?.trim() ?? null,
    description: description?.trim() ?? null,
    type,
    niveau,
    fichier_url,
    fichier_nom,
    fichier_taille: fichier_taille ?? null,
    fichier_type: fichier_type ?? null,
    couverture_url: couverture_url ?? null,
    mots_cles: mots_cles ?? null,
    langue,
    valide,
    publie,
  }).returning();

  // Notifier censeur/directeur si dépôt par professeur
  if (user.role === "professeur") {
    const admins = await db
      .select({ id: utilisateursTable.id })
      .from(utilisateursTable)
      .where(
        and(
          eq(utilisateursTable.etablissement_id, user.etablissement_id),
          inArray(utilisateursTable.role, ["censeur", "directeur"] as string[]),
          eq(utilisateursTable.actif, true),
        ),
      );
    for (const admin of admins) {
      const [notif] = await db.insert(notificationsTable).values({
        etablissement_id: user.etablissement_id,
        destinataire_id: admin.id,
        type: "annonce",
        titre: `📚 Nouvelle ressource en attente : ${ressource.titre}`,
        contenu: `${user.nom} a déposé une ressource de type ${ressource.type} en attente de validation.`,
        lien: "/admin-bibliotheque",
      }).returning();
      await emitNotification(admin.id, {
        id: notif.id, type: "annonce",
        titre: notif.titre, contenu: notif.contenu, lien: notif.lien,
        created_at: notif.created_at,
      });
    }
  }

  const [auteurRow] = await db.select({ nom: utilisateursTable.nom, role: utilisateursTable.role })
    .from(utilisateursTable).where(eq(utilisateursTable.id, ressource.ajoute_par)).limit(1);

  res.status(201).json({
    ressource: {
      ...ressource,
      auteur_nom: auteurRow?.nom ?? null,
      auteur_role: auteurRow?.role ?? null,
      matiere_nom: null,
      est_favori: false,
    },
  });
});

/* ── GET /bibliotheque/ressources/en-attente ──────────── */
router.get("/bibliotheque/ressources/en-attente", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!ADMINS.includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }
  const etabId = user.etablissement_id ?? null;
  const conditions: ReturnType<typeof eq>[] = [eq(ressourcesTable.valide, false)];
  if (etabId) conditions.push(eq(ressourcesTable.etablissement_id, etabId));

  const rows = await db
    .select({
      ressource: ressourcesTable,
      auteur_nom: utilisateursTable.nom,
      auteur_role: utilisateursTable.role,
    })
    .from(ressourcesTable)
    .leftJoin(utilisateursTable, eq(ressourcesTable.ajoute_par, utilisateursTable.id))
    .where(and(...conditions))
    .orderBy(desc(ressourcesTable.created_at));

  const ressources = rows.map((r) => ({
    ...r.ressource,
    auteur_nom: r.auteur_nom ?? null,
    auteur_role: r.auteur_role ?? null,
    matiere_nom: null,
    est_favori: false,
  }));
  res.json({ ressources, total: ressources.length, page: 1, limit: ressources.length });
});

/* ── GET /bibliotheque/ressources/:id ─────────────────── */
router.get("/bibliotheque/ressources/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [row] = await db
    .select({
      ressource: ressourcesTable,
      auteur_nom: utilisateursTable.nom,
      auteur_role: utilisateursTable.role,
    })
    .from(ressourcesTable)
    .leftJoin(utilisateursTable, eq(ressourcesTable.ajoute_par, utilisateursTable.id))
    .where(eq(ressourcesTable.id, id))
    .limit(1);

  if (!row) { res.status(404).json({ message: "Ressource introuvable." }); return; }

  const isRestricted = ["eleve", "parent"].includes(user.role);
  if (isRestricted && (!row.ressource.publie || !row.ressource.valide)) {
    res.status(403).json({ message: "Ressource non disponible." }); return;
  }

  // Incrémenter consultations + historique
  await db.update(ressourcesTable)
    .set({
      nb_consultations: sql`${ressourcesTable.nb_consultations} + 1`,
      updated_at: new Date(),
    })
    .where(eq(ressourcesTable.id, id));

  await db.insert(ressourceHistoriqueTable).values({
    ressource_id: id,
    utilisateur_id: user.id,
    action: "consultation",
  });

  const [favori] = await db.select()
    .from(ressourceFavorisTable)
    .where(and(
      eq(ressourceFavorisTable.ressource_id, id),
      eq(ressourceFavorisTable.utilisateur_id, user.id),
    ))
    .limit(1);

  let matiereNom: string | null = null;
  if (row.ressource.matiere_id) {
    const [m] = await db.select({ nom: matieresConfigTable.nom_matiere })
      .from(matieresConfigTable)
      .where(eq(matieresConfigTable.id, row.ressource.matiere_id))
      .limit(1);
    matiereNom = m?.nom ?? null;
  }

  res.json({
    ressource: {
      ...row.ressource,
      nb_consultations: row.ressource.nb_consultations + 1,
      auteur_nom: row.auteur_nom ?? null,
      auteur_role: row.auteur_role ?? null,
      matiere_nom: matiereNom,
      est_favori: !!favori,
    },
  });
});

/* ── PUT /bibliotheque/ressources/:id ─────────────────── */
router.put("/bibliotheque/ressources/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [existing] = await db.select().from(ressourcesTable).where(eq(ressourcesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Ressource introuvable." }); return; }

  const isAdmin = ADMINS.includes(user.role);
  if (existing.ajoute_par !== user.id && !isAdmin) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  const {
    matiere_id, titre, auteur, description, type, niveau,
    fichier_url, fichier_nom, fichier_taille, fichier_type,
    couverture_url, mots_cles, langue, publie,
  } = req.body as Partial<{
    matiere_id: string | null; titre: string; auteur: string; description: string;
    type: TypeRessource; niveau: string[]; fichier_url: string; fichier_nom: string;
    fichier_taille: number; fichier_type: string; couverture_url: string;
    mots_cles: string[]; langue: string; publie: boolean;
  }>;

  const isAuthorModif = existing.ajoute_par === user.id && !isAdmin;

  const [updated] = await db.update(ressourcesTable).set({
    ...(matiere_id   !== undefined && { matiere_id }),
    ...(titre        !== undefined && { titre: titre!.trim() }),
    ...(auteur       !== undefined && { auteur }),
    ...(description  !== undefined && { description }),
    ...(type         !== undefined && { type }),
    ...(niveau       !== undefined && { niveau }),
    ...(fichier_url  !== undefined && { fichier_url }),
    ...(fichier_nom  !== undefined && { fichier_nom }),
    ...(fichier_taille !== undefined && { fichier_taille }),
    ...(fichier_type !== undefined && { fichier_type }),
    ...(couverture_url !== undefined && { couverture_url }),
    ...(mots_cles    !== undefined && { mots_cles }),
    ...(langue       !== undefined && { langue }),
    ...(publie       !== undefined && { publie }),
    // Modif par l'auteur → repasse en attente validation
    ...(isAuthorModif && { valide: false }),
    updated_at: new Date(),
  }).where(eq(ressourcesTable.id, id)).returning();

  const [auteurRow] = await db.select({ nom: utilisateursTable.nom, role: utilisateursTable.role })
    .from(utilisateursTable).where(eq(utilisateursTable.id, updated.ajoute_par)).limit(1);

  res.json({
    ressource: {
      ...updated,
      auteur_nom: auteurRow?.nom ?? null,
      auteur_role: auteurRow?.role ?? null,
      matiere_nom: null,
      est_favori: false,
    },
  });
});

/* ── DELETE /bibliotheque/ressources/:id ──────────────── */
router.delete("/bibliotheque/ressources/:id", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [existing] = await db.select().from(ressourcesTable).where(eq(ressourcesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Ressource introuvable." }); return; }

  if (existing.ajoute_par !== user.id && !["dev", "directeur"].includes(user.role)) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  // Supprimer favoris et historique liés
  await db.delete(ressourceFavorisTable).where(eq(ressourceFavorisTable.ressource_id, id));
  await db.delete(ressourceHistoriqueTable).where(eq(ressourceHistoriqueTable.ressource_id, id));
  await db.delete(ressourcesTable).where(eq(ressourcesTable.id, id));

  res.json({ message: "Ressource supprimée." });
});

/* ── PUT /bibliotheque/ressources/:id/valider ─────────── */
router.put("/bibliotheque/ressources/:id/valider", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!ADMINS.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const id = normalizeId(req.params["id"]);
  const [existing] = await db.select().from(ressourcesTable).where(eq(ressourcesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Ressource introuvable." }); return; }

  const [ressource] = await db.update(ressourcesTable)
    .set({ valide: true, publie: true, updated_at: new Date() })
    .where(eq(ressourcesTable.id, id))
    .returning();

  // Notifier l'auteur
  const [auteurRow] = await db
    .select({ nom: utilisateursTable.nom, role: utilisateursTable.role })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, ressource.ajoute_par))
    .limit(1);

  if (auteurRow && ressource.ajoute_par !== user.id) {
    const etabId = ressource.etablissement_id;
    const [notif] = await db.insert(notificationsTable).values({
      etablissement_id: etabId,
      destinataire_id: ressource.ajoute_par,
      type: "annonce",
      titre: `✅ Ressource validée : ${ressource.titre}`,
      contenu: `Votre ressource a été validée et publiée dans la bibliothèque.`,
      lien: "/bibliotheque",
    }).returning();
    await emitNotification(ressource.ajoute_par, {
      id: notif.id, type: "annonce",
      titre: notif.titre, contenu: notif.contenu, lien: notif.lien,
      created_at: notif.created_at,
    });
  }

  res.json({
    ressource: {
      ...ressource,
      auteur_nom: auteurRow?.nom ?? null,
      auteur_role: auteurRow?.role ?? null,
      matiere_nom: null,
      est_favori: false,
    },
  });
});

/* ── PUT /bibliotheque/ressources/:id/publier ─────────── */
router.put("/bibliotheque/ressources/:id/publier", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!ADMINS.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }

  const id = normalizeId(req.params["id"]);
  const [existing] = await db.select().from(ressourcesTable).where(eq(ressourcesTable.id, id)).limit(1);
  if (!existing) { res.status(404).json({ message: "Ressource introuvable." }); return; }

  const { publie = true } = req.body as { publie?: boolean };

  const [ressource] = await db.update(ressourcesTable)
    .set({ publie, updated_at: new Date() })
    .where(eq(ressourcesTable.id, id))
    .returning();

  // Notifier les élèves si publication
  if (publie && ressource.valide) {
    const etabId = ressource.etablissement_id;
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
        titre: `📚 Nouvelle ressource : ${ressource.titre}`,
        contenu: `Une nouvelle ressource de type ${ressource.type} est disponible dans la bibliothèque.`,
        lien: "/bibliotheque",
      }).returning();
      await emitNotification(eleve.id, {
        id: notif.id, type: "annonce",
        titre: notif.titre, contenu: notif.contenu, lien: notif.lien,
        created_at: notif.created_at,
      });
    }
  }

  const [auteurRow] = await db.select({ nom: utilisateursTable.nom, role: utilisateursTable.role })
    .from(utilisateursTable).where(eq(utilisateursTable.id, ressource.ajoute_par)).limit(1);

  res.json({
    ressource: {
      ...ressource,
      auteur_nom: auteurRow?.nom ?? null,
      auteur_role: auteurRow?.role ?? null,
      matiere_nom: null,
      est_favori: false,
    },
  });
});

/* ── POST /bibliotheque/ressources/:id/telecharger ────── */
router.post("/bibliotheque/ressources/:id/telecharger", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [ressource] = await db.select().from(ressourcesTable).where(eq(ressourcesTable.id, id)).limit(1);
  if (!ressource) { res.status(404).json({ message: "Ressource introuvable." }); return; }

  const isRestricted = ["eleve", "parent"].includes(user.role);
  if (isRestricted && (!ressource.publie || !ressource.valide)) {
    res.status(403).json({ message: "Ressource non disponible." }); return;
  }

  await db.update(ressourcesTable)
    .set({ nb_telechargements: sql`${ressourcesTable.nb_telechargements} + 1`, updated_at: new Date() })
    .where(eq(ressourcesTable.id, id));

  await db.insert(ressourceHistoriqueTable).values({
    ressource_id: id,
    utilisateur_id: user.id,
    action: "telechargement",
  });

  res.json({ fichier_url: ressource.fichier_url, fichier_nom: ressource.fichier_nom });
});

/* ── POST /bibliotheque/ressources/:id/favori ─────────── */
router.post("/bibliotheque/ressources/:id/favori", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [ressource] = await db.select().from(ressourcesTable).where(eq(ressourcesTable.id, id)).limit(1);
  if (!ressource) { res.status(404).json({ message: "Ressource introuvable." }); return; }

  const [existing] = await db.select()
    .from(ressourceFavorisTable)
    .where(and(
      eq(ressourceFavorisTable.ressource_id, id),
      eq(ressourceFavorisTable.utilisateur_id, user.id),
    ))
    .limit(1);

  if (existing) {
    await db.delete(ressourceFavorisTable).where(eq(ressourceFavorisTable.id, existing.id));
    res.json({ est_favori: false });
  } else {
    await db.insert(ressourceFavorisTable).values({
      ressource_id: id,
      utilisateur_id: user.id,
    });
    res.json({ est_favori: true });
  }
});

/* ── GET /bibliotheque/ressources/:id/stats ───────────── */
router.get("/bibliotheque/ressources/:id/stats", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const id = normalizeId(req.params["id"]);

  const [ressource] = await db.select().from(ressourcesTable).where(eq(ressourcesTable.id, id)).limit(1);
  if (!ressource) { res.status(404).json({ message: "Ressource introuvable." }); return; }

  const isAdmin = ADMINS.includes(user.role);
  if (ressource.ajoute_par !== user.id && !isAdmin) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  const [{ nbFavoris }] = await db
    .select({ nbFavoris: count() })
    .from(ressourceFavorisTable)
    .where(eq(ressourceFavorisTable.ressource_id, id));

  // Historique 30 derniers jours par jour
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const historique = await db
    .select()
    .from(ressourceHistoriqueTable)
    .where(and(
      eq(ressourceHistoriqueTable.ressource_id, id),
      gte(ressourceHistoriqueTable.created_at, since),
    ))
    .orderBy(ressourceHistoriqueTable.created_at);

  // Agréger par jour
  const dayMap = new Map<string, { consultations: number; telechargements: number }>();
  for (const h of historique) {
    const day = h.created_at.toISOString().split("T")[0]!;
    const entry = dayMap.get(day) ?? { consultations: 0, telechargements: 0 };
    if (h.action === "consultation") entry.consultations++;
    else entry.telechargements++;
    dayMap.set(day, entry);
  }
  const historique_30j = Array.from(dayMap.entries()).map(([date, vals]) => ({ date, ...vals }));

  res.json({
    nb_consultations: ressource.nb_consultations,
    nb_telechargements: ressource.nb_telechargements,
    nb_favoris: nbFavoris,
    historique_30j,
  });
});

/* ── GET /bibliotheque/favoris ────────────────────────── */
router.get("/bibliotheque/favoris", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;

  const favoris = await db
    .select({ ressource_id: ressourceFavorisTable.ressource_id })
    .from(ressourceFavorisTable)
    .where(eq(ressourceFavorisTable.utilisateur_id, user.id));

  if (!favoris.length) {
    res.json({ ressources: [], total: 0, page: 1, limit: 20 }); return;
  }

  const ids = favoris.map((f) => f.ressource_id);
  const rows = await db
    .select({
      ressource: ressourcesTable,
      auteur_nom: utilisateursTable.nom,
      auteur_role: utilisateursTable.role,
    })
    .from(ressourcesTable)
    .leftJoin(utilisateursTable, eq(ressourcesTable.ajoute_par, utilisateursTable.id))
    .where(inArray(ressourcesTable.id, ids))
    .orderBy(desc(ressourcesTable.created_at));

  const ressources = rows.map((r) => ({
    ...r.ressource,
    auteur_nom: r.auteur_nom ?? null,
    auteur_role: r.auteur_role ?? null,
    matiere_nom: null,
    est_favori: true,
  }));

  res.json({ ressources, total: ressources.length, page: 1, limit: ressources.length });
});

/* ── GET /bibliotheque/historique ─────────────────────── */
router.get("/bibliotheque/historique", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  const { action, date_debut, date_fin } = req.query as Record<string, string>;

  const conditions: ReturnType<typeof eq>[] = [
    eq(ressourceHistoriqueTable.utilisateur_id, user.id),
  ];
  if (action) conditions.push(eq(ressourceHistoriqueTable.action, action as ActionHistorique));
  if (date_debut) {
    conditions.push(gte(ressourceHistoriqueTable.created_at, new Date(date_debut)));
  }

  const rows = await db
    .select({
      historique: ressourceHistoriqueTable,
      ressource_titre: ressourcesTable.titre,
      ressource_type: ressourcesTable.type,
      ressource_fichier_url: ressourcesTable.fichier_url,
    })
    .from(ressourceHistoriqueTable)
    .leftJoin(ressourcesTable, eq(ressourceHistoriqueTable.ressource_id, ressourcesTable.id))
    .where(and(...conditions))
    .orderBy(desc(ressourceHistoriqueTable.created_at))
    .limit(100);

  // Filtre date_fin côté JS (simplification)
  const filtered = date_fin
    ? rows.filter((r) => r.historique.created_at <= new Date(date_fin))
    : rows;

  const historique = filtered.map((r) => ({
    ...r.historique,
    ressource_titre: r.ressource_titre ?? "Ressource supprimée",
    ressource_type: r.ressource_type ?? null,
    ressource_fichier_url: r.ressource_fichier_url ?? null,
  }));

  res.json({ historique, total: historique.length });
});

/* ── GET /bibliotheque/stats ──────────────────────────── */
router.get("/bibliotheque/stats", authMiddleware, verifierLicence, async (req, res) => {
  const user = req.user!;
  if (!ADMINS.includes(user.role)) { res.status(403).json({ message: "Accès non autorisé." }); return; }
  const etabId = user.etablissement_id ?? null;

  const etabCondition = etabId ? eq(ressourcesTable.etablissement_id, etabId) : undefined;

  const [totalPubRow] = await db
    .select({ n: count() })
    .from(ressourcesTable)
    .where(etabCondition
      ? and(etabCondition, eq(ressourcesTable.publie, true))
      : eq(ressourcesTable.publie, true));

  const [enAttenteRow] = await db
    .select({ n: count() })
    .from(ressourcesTable)
    .where(etabCondition
      ? and(etabCondition, eq(ressourcesTable.valide, false))
      : eq(ressourcesTable.valide, false));

  const since = new Date();
  since.setDate(1); // début du mois
  const etabHistCond = etabId
    ? and(
        gte(ressourceHistoriqueTable.created_at, since),
        inArray(
          ressourceHistoriqueTable.ressource_id,
          db.select({ id: ressourcesTable.id })
            .from(ressourcesTable)
            .where(eq(ressourcesTable.etablissement_id, etabId)),
        ),
      )
    : gte(ressourceHistoriqueTable.created_at, since);

  const historiqueMois = await db
    .select({ action: ressourceHistoriqueTable.action })
    .from(ressourceHistoriqueTable)
    .where(etabHistCond);

  const consultationsMois = historiqueMois.filter((h) => h.action === "consultation").length;
  const telechargementsMois = historiqueMois.filter((h) => h.action === "telechargement").length;

  // Top 10 consultées / téléchargées
  const topCondition = etabCondition
    ? and(etabCondition, eq(ressourcesTable.publie, true))
    : eq(ressourcesTable.publie, true);

  const topConsultees = await db
    .select({ ressource: ressourcesTable })
    .from(ressourcesTable)
    .where(topCondition)
    .orderBy(desc(ressourcesTable.nb_consultations))
    .limit(10);

  const topTelechargees = await db
    .select({ ressource: ressourcesTable })
    .from(ressourcesTable)
    .where(topCondition)
    .orderBy(desc(ressourcesTable.nb_telechargements))
    .limit(10);

  // Par type
  const allTypes: TypeRessource[] = ["manuel", "fiche_cours", "exercice", "video", "document_officiel", "autre"];
  const parTypeRows = await db
    .select({ type: ressourcesTable.type, n: count() })
    .from(ressourcesTable)
    .where(etabCondition ?? sql`1=1`)
    .groupBy(ressourcesTable.type);

  const parType = allTypes.map((t) => ({
    type: t,
    total: parTypeRows.find((r) => r.type === t)?.n ?? 0,
  }));

  // Activité 30j
  const since30 = new Date();
  since30.setDate(since30.getDate() - 30);
  const hist30Cond = etabId
    ? and(
        gte(ressourceHistoriqueTable.created_at, since30),
        inArray(
          ressourceHistoriqueTable.ressource_id,
          db.select({ id: ressourcesTable.id })
            .from(ressourcesTable)
            .where(eq(ressourcesTable.etablissement_id, etabId)),
        ),
      )
    : gte(ressourceHistoriqueTable.created_at, since30);

  const hist30 = await db
    .select()
    .from(ressourceHistoriqueTable)
    .where(hist30Cond)
    .orderBy(ressourceHistoriqueTable.created_at);

  const dayMap = new Map<string, { consultations: number; telechargements: number }>();
  for (const h of hist30) {
    const day = h.created_at.toISOString().split("T")[0]!;
    const e = dayMap.get(day) ?? { consultations: 0, telechargements: 0 };
    if (h.action === "consultation") e.consultations++;
    else e.telechargements++;
    dayMap.set(day, e);
  }
  const activite_30j = Array.from(dayMap.entries()).map(([date, v]) => ({ date, ...v }));

  const toItem = (r: { ressource: typeof ressourcesTable.$inferSelect }) => ({
    ...r.ressource,
    auteur_nom: null,
    auteur_role: null,
    matiere_nom: null,
    est_favori: false,
  });

  res.json({
    total_publiees: totalPubRow?.n ?? 0,
    en_attente_validation: enAttenteRow?.n ?? 0,
    consultations_mois: consultationsMois,
    telechargements_mois: telechargementsMois,
    par_type: parType,
    top_consultees: topConsultees.map(toItem),
    top_telechargees: topTelechargees.map(toItem),
    activite_30j,
  });
});

export default router;
