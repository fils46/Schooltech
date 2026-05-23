import { Router } from "express";
import { eq, and, count, sql } from "drizzle-orm";
import { db, elevesTable, parentsElevesTable, documentsElevesTable, utilisateursTable, etablissementsTable } from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import bcrypt from "bcrypt";
import { generateTempPassword } from "../lib/auth";
import multer from "multer";
import path from "path";
import fs from "fs";

const uploadStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const user = (req as Express.Request & { user?: { etablissement_id?: string } }).user;
    const eleveId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const dir = path.join(process.cwd(), "uploads", user?.etablissement_id ?? "global", eleveId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    cb(null, allowed.includes(file.mimetype));
  },
});

const router = Router();

/* ─── Génération matricule ───────────────────────────────── */
async function genererMatricule(etablissementId: string): Promise<string> {
  const [etab] = await db
    .select({ ville: etablissementsTable.ville })
    .from(etablissementsTable)
    .where(eq(etablissementsTable.id, etablissementId));

  const villeCode = (etab?.ville ?? "GEN").slice(0, 3).toUpperCase().replace(/\s/g, "");
  const annee = new Date().getFullYear();

  const [countResult] = await db
    .select({ count: count() })
    .from(elevesTable)
    .where(
      and(
        eq(elevesTable.etablissement_id, etablissementId),
        sql`EXTRACT(YEAR FROM ${elevesTable.created_at}) = ${annee}`
      )
    );

  const numero = (Number(countResult?.count ?? 0) + 1).toString().padStart(4, "0");
  const candidat = `CI-${villeCode}-${annee}-${numero}`;

  const [existing] = await db
    .select({ id: elevesTable.id })
    .from(elevesTable)
    .where(eq(elevesTable.matricule, candidat));

  if (existing) {
    const fallback = `CI-${villeCode}-${annee}-${Date.now().toString().slice(-4)}`;
    return fallback;
  }

  return candidat;
}

/* ─── POST /eleves/inscrire ─────────────────────────────── */
router.post(
  "/eleves/inscrire",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const createur = req.user!;
    const {
      nom, prenoms, date_naissance, lieu_naissance, sexe,
      adresse, situation_familiale, annee_inscription,
      parent_nom, parent_prenoms, parent_email, parent_lien, parent_telephone,
    } = req.body as Record<string, string>;

    if (!nom || !prenoms || !date_naissance || !sexe || !annee_inscription ||
        !parent_nom || !parent_prenoms || !parent_email || !parent_lien) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const etablissementId = createur.role === "dev"
      ? (req.body.etablissement_id ?? null)
      : createur.etablissement_id;

    if (!etablissementId) {
      res.status(400).json({ message: "etablissement_id requis pour le rôle dev." });
      return;
    }

    const matricule = await genererMatricule(etablissementId);
    const emailEleve = `${prenoms.toLowerCase().split(" ")[0]}.${nom.toLowerCase().replace(/\s/g, "")}${matricule.slice(-4)}@m15.ci`;
    const passwordEleve = generateTempPassword(8);
    const hashedEleve = await bcrypt.hash(passwordEleve, 10);

    const [eleveUser] = await db
      .insert(utilisateursTable)
      .values({
        nom,
        prenoms,
        email: emailEleve,
        password: hashedEleve,
        role: "eleve",
        etablissement_id: etablissementId,
        actif: true,
        premier_login: true,
      })
      .returning();

    const [eleve] = await db
      .insert(elevesTable)
      .values({
        etablissement_id: etablissementId,
        utilisateur_id: eleveUser.id,
        matricule,
        nom,
        prenoms,
        date_naissance,
        lieu_naissance: lieu_naissance ?? null,
        sexe,
        adresse: adresse ?? null,
        situation_familiale: situation_familiale ?? null,
        annee_inscription: parseInt(annee_inscription),
        statut: "actif",
      })
      .returning();

    const emailParentNorm = parent_email.toLowerCase();
    const [existingParent] = await db
      .select()
      .from(utilisateursTable)
      .where(eq(utilisateursTable.email, emailParentNorm));

    let parentUser = existingParent;
    let passwordParentTemporaire: string | undefined;

    if (!existingParent) {
      passwordParentTemporaire = generateTempPassword(8);
      const hashedParent = await bcrypt.hash(passwordParentTemporaire, 10);
      const [newParent] = await db
        .insert(utilisateursTable)
        .values({
          nom: parent_nom,
          prenoms: parent_prenoms,
          email: emailParentNorm,
          telephone: parent_telephone ?? null,
          password: hashedParent,
          role: "parent",
          etablissement_id: etablissementId,
          actif: true,
          premier_login: true,
        })
        .returning();
      parentUser = newParent;
    }

    await db.insert(parentsElevesTable).values({
      eleve_id: eleve.id,
      utilisateur_id: parentUser.id,
      lien: parent_lien,
      est_principal: true,
    });

    req.log.info({ eleveId: eleve.id, matricule }, "Élève inscrit");

    res.status(201).json({
      message: "Élève inscrit avec succès.",
      eleve: {
        id: eleve.id,
        matricule: eleve.matricule,
        nom: eleve.nom,
        prenoms: eleve.prenoms,
        statut: eleve.statut,
        annee_inscription: eleve.annee_inscription,
        sexe: eleve.sexe,
        etablissement_id: eleve.etablissement_id,
        utilisateur_id: eleve.utilisateur_id,
        date_naissance: eleve.date_naissance,
        created_at: eleve.created_at,
      },
      matricule,
      email_eleve: emailEleve,
      password_eleve_temporaire: passwordEleve,
      ...(passwordParentTemporaire ? { email_parent: emailParentNorm, password_parent_temporaire: passwordParentTemporaire } : {}),
    });
  }
);

/* ─── GET /eleves/recherche ──────────────────────────────── */
router.get(
  "/eleves/recherche",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur", "professeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { q, statut, sexe } = req.query as Record<string, string>;
    const annee = req.query.annee ? parseInt(req.query.annee as string) : undefined;

    const conditions: ReturnType<typeof eq>[] = [];

    if (user.role !== "dev" && user.etablissement_id) {
      conditions.push(eq(elevesTable.etablissement_id, user.etablissement_id));
    }
    if (statut) conditions.push(eq(elevesTable.statut, statut));
    if (sexe) conditions.push(eq(elevesTable.sexe, sexe));
    if (annee) conditions.push(eq(elevesTable.annee_inscription, annee));

    let rows = conditions.length
      ? await db.select().from(elevesTable).where(and(...conditions)).limit(50)
      : await db.select().from(elevesTable).limit(50);

    if (q) {
      const ql = q.toLowerCase();
      rows = rows.filter(
        (e) =>
          e.nom.toLowerCase().includes(ql) ||
          e.prenoms.toLowerCase().includes(ql) ||
          e.matricule.toLowerCase().includes(ql)
      );
    }

    res.json(rows.map(mapEleve));
  }
);

/* ─── GET /eleves/liste ──────────────────────────────────── */
router.get(
  "/eleves/liste",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur", "professeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { statut, sexe } = req.query as Record<string, string>;
    const annee = req.query.annee_inscription ? parseInt(req.query.annee_inscription as string) : undefined;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];

    if (user.role !== "dev" && user.etablissement_id) {
      conditions.push(eq(elevesTable.etablissement_id, user.etablissement_id));
    }
    if (statut) conditions.push(eq(elevesTable.statut, statut));
    if (sexe) conditions.push(eq(elevesTable.sexe, sexe));
    if (annee) conditions.push(eq(elevesTable.annee_inscription, annee));

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const [totalResult] = whereClause
      ? await db.select({ count: count() }).from(elevesTable).where(whereClause)
      : await db.select({ count: count() }).from(elevesTable);

    const rows = whereClause
      ? await db.select().from(elevesTable).where(whereClause).limit(limit).offset(offset)
      : await db.select().from(elevesTable).limit(limit).offset(offset);

    res.json({
      eleves: rows.map(mapEleve),
      total: Number(totalResult?.count ?? 0),
      page,
      limit,
    });
  }
);

/* ─── GET /eleves/:id ────────────────────────────────────── */
router.get(
  "/eleves/:id",
  authMiddleware,
  verifierLicence,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, rawId));
    if (!eleve) { res.status(404).json({ message: "Élève introuvable." }); return; }

    if (user.role !== "dev" && user.role !== "directeur" && user.role !== "censeur") {
      if (user.role === "eleve" && eleve.utilisateur_id !== user.id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }
      if (user.role === "parent") {
        const [link] = await db.select().from(parentsElevesTable).where(
          and(eq(parentsElevesTable.eleve_id, rawId), eq(parentsElevesTable.utilisateur_id, user.id))
        );
        if (!link) { res.status(403).json({ message: "Accès refusé." }); return; }
      }
    } else if (user.role !== "dev" && user.etablissement_id !== eleve.etablissement_id) {
      res.status(403).json({ message: "Accès refusé." }); return;
    }

    const parentLinks = await db.select().from(parentsElevesTable).where(eq(parentsElevesTable.eleve_id, rawId));
    const parents = await Promise.all(
      parentLinks.map(async (pl) => {
        const [u] = await db.select().from(utilisateursTable).where(eq(utilisateursTable.id, pl.utilisateur_id));
        return {
          lien_id: pl.id,
          utilisateur_id: pl.utilisateur_id,
          nom: u?.nom ?? "",
          prenoms: u?.prenoms ?? null,
          email: u?.email ?? "",
          telephone: u?.telephone ?? null,
          lien: pl.lien,
          est_principal: pl.est_principal,
        };
      })
    );

    const documents = await db.select().from(documentsElevesTable).where(eq(documentsElevesTable.eleve_id, rawId));

    res.json({
      ...mapEleve(eleve),
      historique_statut: (eleve.historique_statut as Array<{ statut: string; motif?: string; date: string }>) ?? [],
      parents,
      documents,
    });
  }
);

/* ─── PUT /eleves/:id ────────────────────────────────────── */
router.put(
  "/eleves/:id",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, rawId));
    if (!eleve) { res.status(404).json({ message: "Élève introuvable." }); return; }
    if (user.role !== "dev" && user.etablissement_id !== eleve.etablissement_id) {
      res.status(403).json({ message: "Accès refusé." }); return;
    }

    const { nom, prenoms, date_naissance, lieu_naissance, sexe, adresse, situation_familiale, photo_url } = req.body as Record<string, string>;
    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (nom) updateData.nom = nom;
    if (prenoms) updateData.prenoms = prenoms;
    if (date_naissance) updateData.date_naissance = date_naissance;
    if (lieu_naissance !== undefined) updateData.lieu_naissance = lieu_naissance;
    if (sexe) updateData.sexe = sexe;
    if (adresse !== undefined) updateData.adresse = adresse;
    if (situation_familiale !== undefined) updateData.situation_familiale = situation_familiale;
    if (photo_url !== undefined) updateData.photo_url = photo_url;

    const [updated] = await db.update(elevesTable).set(updateData).where(eq(elevesTable.id, rawId)).returning();
    res.json(mapEleve(updated));
  }
);

/* ─── DELETE /eleves/:id ─────────────────────────────────── */
router.delete(
  "/eleves/:id",
  authMiddleware,
  verifierLicence,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, rawId));
    if (!eleve) { res.status(404).json({ message: "Élève introuvable." }); return; }

    await db.update(elevesTable).set({ statut: "inactif", updated_at: new Date() }).where(eq(elevesTable.id, rawId));
    if (eleve.utilisateur_id) {
      await db.update(utilisateursTable).set({ actif: false }).where(eq(utilisateursTable.id, eleve.utilisateur_id));
    }

    res.json({ message: "Élève désactivé (soft delete)." });
  }
);

/* ─── PUT /eleves/:id/statut ─────────────────────────────── */
router.put(
  "/eleves/:id/statut",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;
    const { statut, motif } = req.body as { statut: string; motif?: string };

    const validStatuts = ["actif", "inactif", "transfere", "exclu"];
    if (!statut || !validStatuts.includes(statut)) {
      res.status(400).json({ message: `Statut invalide. Valeurs acceptées : ${validStatuts.join(", ")}` }); return;
    }

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, rawId));
    if (!eleve) { res.status(404).json({ message: "Élève introuvable." }); return; }
    if (user.role !== "dev" && user.etablissement_id !== eleve.etablissement_id) {
      res.status(403).json({ message: "Accès refusé." }); return;
    }

    const historiqueEntry: { statut: string; date: string; motif?: string } = {
      statut,
      date: new Date().toISOString(),
      ...(motif ? { motif } : {}),
    };
    const historique = [
      ...((eleve.historique_statut as Array<{ statut: string; motif?: string; date: string }>) ?? []),
      historiqueEntry,
    ];

    await db.update(elevesTable)
      .set({ statut, historique_statut: historique, updated_at: new Date() })
      .where(eq(elevesTable.id, rawId));

    if ((statut === "exclu" || statut === "transfere") && eleve.utilisateur_id) {
      await db.update(utilisateursTable).set({ actif: false }).where(eq(utilisateursTable.id, eleve.utilisateur_id));
    }
    if (statut === "actif" && eleve.utilisateur_id) {
      await db.update(utilisateursTable).set({ actif: true }).where(eq(utilisateursTable.id, eleve.utilisateur_id));
    }

    res.json({ message: `Statut mis à jour : ${statut}.` });
  }
);

/* ─── POST /eleves/:id/lier-parent ──────────────────────── */
router.post(
  "/eleves/:id/lier-parent",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { utilisateur_id, lien, est_principal } = req.body as { utilisateur_id: string; lien: string; est_principal?: boolean };

    if (!utilisateur_id || !lien) { res.status(400).json({ message: "utilisateur_id et lien requis." }); return; }

    const [parent] = await db.select().from(utilisateursTable).where(eq(utilisateursTable.id, utilisateur_id));
    if (!parent || parent.role !== "parent") {
      res.status(400).json({ message: "L'utilisateur n'est pas de rôle 'parent'." }); return;
    }

    const existingLinks = await db.select().from(parentsElevesTable).where(eq(parentsElevesTable.eleve_id, rawId));
    if (existingLinks.length >= 2) {
      res.status(400).json({ message: "Un élève ne peut avoir que 2 parents au maximum." }); return;
    }

    const [existing] = await db.select().from(parentsElevesTable).where(
      and(eq(parentsElevesTable.eleve_id, rawId), eq(parentsElevesTable.utilisateur_id, utilisateur_id))
    );
    if (existing) { res.status(400).json({ message: "Ce parent est déjà lié à cet élève." }); return; }

    await db.insert(parentsElevesTable).values({ eleve_id: rawId, utilisateur_id, lien, est_principal: est_principal ?? false });
    res.status(201).json({ message: "Parent lié avec succès." });
  }
);

/* ─── DELETE /eleves/:id/delier-parent/:parentId ─────────── */
router.delete(
  "/eleves/:id/delier-parent/:parentId",
  authMiddleware,
  verifierLicence,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const parentId = Array.isArray(req.params.parentId) ? req.params.parentId[0] : req.params.parentId;

    const existingLinks = await db.select().from(parentsElevesTable).where(eq(parentsElevesTable.eleve_id, rawId));
    if (existingLinks.length <= 1) {
      res.status(400).json({ message: "Impossible de supprimer : l'élève doit avoir au moins 1 parent." }); return;
    }

    const [link] = await db.select().from(parentsElevesTable).where(
      and(eq(parentsElevesTable.eleve_id, rawId), eq(parentsElevesTable.id, parentId))
    );
    if (!link) { res.status(404).json({ message: "Lien parent-élève introuvable." }); return; }

    await db.delete(parentsElevesTable).where(eq(parentsElevesTable.id, parentId));
    res.json({ message: "Parent délié avec succès." });
  }
);

/* ─── POST /eleves/:id/documents/upload ──────────────────── */
router.post(
  "/eleves/:id/documents/upload",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  upload.single("file"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const file = req.file;
    if (!file) { res.status(400).json({ message: "Fichier requis (PDF ou image, max 5 Mo)." }); return; }

    const typeDocument = (req.body.type_document as string) ?? "autre";
    const basePath = process.env.BASE_PATH ?? "/api";
    const relPath = file.path.replace(process.cwd(), "").replace(/\\/g, "/");
    const urlFichier = `${basePath}/uploads${relPath}`;

    const [doc] = await db.insert(documentsElevesTable).values({
      eleve_id: rawId,
      type_document: typeDocument,
      nom_fichier: file.originalname,
      url_fichier: urlFichier,
    }).returning();

    res.status(201).json(doc);
  }
);

/* ─── GET /eleves/:id/documents ──────────────────────────── */
router.get(
  "/eleves/:id/documents",
  authMiddleware,
  verifierLicence,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const docs = await db.select().from(documentsElevesTable).where(eq(documentsElevesTable.eleve_id, rawId));
    res.json(docs);
  }
);

/* ─── DELETE /eleves/:id/documents/:docId ─────────────────── */
router.delete(
  "/eleves/:id/documents/:docId",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const docId = Array.isArray(req.params.docId) ? req.params.docId[0] : req.params.docId;
    const [doc] = await db.select().from(documentsElevesTable).where(eq(documentsElevesTable.id, docId));
    if (!doc) { res.status(404).json({ message: "Document introuvable." }); return; }
    await db.delete(documentsElevesTable).where(eq(documentsElevesTable.id, docId));
    res.json({ message: "Document supprimé." });
  }
);

/* ─── Helper ─────────────────────────────────────────────── */
function mapEleve(e: typeof elevesTable.$inferSelect) {
  return {
    id: e.id,
    etablissement_id: e.etablissement_id,
    utilisateur_id: e.utilisateur_id,
    matricule: e.matricule,
    nom: e.nom,
    prenoms: e.prenoms,
    date_naissance: e.date_naissance,
    lieu_naissance: e.lieu_naissance,
    sexe: e.sexe,
    photo_url: e.photo_url,
    adresse: e.adresse,
    situation_familiale: e.situation_familiale,
    annee_inscription: e.annee_inscription,
    statut: e.statut,
    created_at: e.created_at,
  };
}

export default router;
