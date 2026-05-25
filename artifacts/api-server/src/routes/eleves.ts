import { Router } from "express";
import { eq, and, count, isNull, or, ne, sql } from "drizzle-orm";
import { db, elevesTable, parentsElevesTable, documentsElevesTable, utilisateursTable, eleveClassesTable, anneesScolairesTable, classesTable } from "@workspace/db";
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
      matricule, matricule_statut, matricule_provisoire, classe_id,
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

    const matriculeValide = matricule?.trim() || null;

    if (matriculeValide) {
      const [existing] = await db
        .select({ id: elevesTable.id })
        .from(elevesTable)
        .where(and(eq(elevesTable.etablissement_id, etablissementId), eq(elevesTable.matricule, matriculeValide)));
      if (existing) {
        res.status(400).json({ message: `Le matricule "${matriculeValide}" est déjà utilisé dans cet établissement.` });
        return;
      }
    }

    const validStatuts = ["en_attente", "provisoire", "officiel"];
    const statutMatricule = validStatuts.includes(matricule_statut ?? "")
      ? matricule_statut
      : matriculeValide ? "officiel" : "en_attente";

    const annee2Chiffres = String(new Date().getFullYear()).slice(-2);
    const prenomSlug = prenoms.toLowerCase().split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const nomSlug = nom.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const baseEmail = `${prenomSlug}.${nomSlug}${annee2Chiffres}@m15.ci`;
    let emailEleve = baseEmail;
    const suffixes = "bcdefghjkmnpqrstuvwxyz";
    for (let i = 0; i < suffixes.length; i++) {
      const exists = await db.select({ id: utilisateursTable.id }).from(utilisateursTable).where(eq(utilisateursTable.email, emailEleve)).limit(1);
      if (exists.length === 0) break;
      emailEleve = `${prenomSlug}.${nomSlug}${annee2Chiffres}${suffixes[i]}@m15.ci`;
    }
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
        matricule: matriculeValide,
        matricule_statut: statutMatricule,
        matricule_provisoire: matricule_provisoire?.trim() || null,
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

    /* ── Affectation de classe (optionnelle) ───────────────── */
    let classeAffectee: { id: string; nom: string } | null = null;
    if (classe_id?.trim()) {
      const [classe] = await db
        .select({ id: classesTable.id, nom: classesTable.nom })
        .from(classesTable)
        .where(and(eq(classesTable.id, classe_id.trim()), eq(classesTable.etablissement_id, etablissementId)))
        .limit(1);

      if (classe) {
        const [anneeActive] = await db
          .select({ id: anneesScolairesTable.id })
          .from(anneesScolairesTable)
          .where(and(
            eq(anneesScolairesTable.etablissement_id, etablissementId),
            eq(anneesScolairesTable.est_active, true),
          ))
          .limit(1);

        if (anneeActive) {
          await db.insert(eleveClassesTable).values({
            eleve_id: eleve.id,
            classe_id: classe.id,
            annee_scolaire_id: anneeActive.id,
            date_affectation: new Date().toISOString().slice(0, 10),
            statut: "actif",
          }).onConflictDoNothing();
          classeAffectee = classe;
        }
      }
    }

    req.log.info({ eleveId: eleve.id, matricule: matriculeValide, statutMatricule, classeId: classeAffectee?.id }, "Élève inscrit");

    res.status(201).json({
      success: true,
      message: "Élève inscrit avec succès.",
      eleve: mapEleve(eleve),
      matricule: matriculeValide,
      matricule_statut: statutMatricule,
      email_eleve: emailEleve,
      password_eleve_temporaire: passwordEleve,
      ...(passwordParentTemporaire ? { email_parent: emailParentNorm, password_parent_temporaire: passwordParentTemporaire } : {}),
      ...(classeAffectee ? { classe_affectee: classeAffectee } : {}),
    });
  }
);

/* ─── GET /eleves/sans-matricule ─────────────────────────── */
router.get(
  "/eleves/sans-matricule",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const offset = (page - 1) * limit;

    const etabCondition = user.role !== "dev" && user.etablissement_id
      ? eq(elevesTable.etablissement_id, user.etablissement_id)
      : undefined;

    const sansMatriculeCondition = or(
      isNull(elevesTable.matricule),
      ne(elevesTable.matricule_statut, "officiel")
    );

    const whereClause = etabCondition
      ? and(etabCondition, sansMatriculeCondition)
      : sansMatriculeCondition;

    const [totalResult] = await db.select({ count: count() }).from(elevesTable).where(whereClause);
    const rows = await db.select().from(elevesTable).where(whereClause).limit(limit).offset(offset);

    res.json({
      success: true,
      eleves: rows.map(mapEleve),
      total: Number(totalResult?.count ?? 0),
      page,
      limit,
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
    const { q, statut, sexe, matricule_statut } = req.query as Record<string, string>;
    const annee = req.query.annee ? parseInt(req.query.annee as string) : undefined;

    const conditions: ReturnType<typeof eq>[] = [];

    if (user.role !== "dev" && user.etablissement_id) {
      conditions.push(eq(elevesTable.etablissement_id, user.etablissement_id));
    }
    if (statut) conditions.push(eq(elevesTable.statut, statut));
    if (sexe) conditions.push(eq(elevesTable.sexe, sexe));
    if (annee) conditions.push(eq(elevesTable.annee_inscription, annee));
    if (matricule_statut) conditions.push(eq(elevesTable.matricule_statut, matricule_statut));

    let rows = conditions.length
      ? await db.select().from(elevesTable).where(and(...conditions)).limit(50)
      : await db.select().from(elevesTable).limit(50);

    if (q) {
      const ql = q.toLowerCase();
      rows = rows.filter(
        (e) =>
          e.nom.toLowerCase().includes(ql) ||
          e.prenoms.toLowerCase().includes(ql) ||
          (e.matricule ?? "").toLowerCase().includes(ql)
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
    const { statut, sexe, matricule_statut, classe_id } = req.query as Record<string, string>;
    const annee = req.query.annee_inscription ? parseInt(req.query.annee_inscription as string) : undefined;
    const page = parseInt((req.query.page as string) || "1");
    const limit = parseInt((req.query.limit as string) || "20");
    const offset = (page - 1) * limit;

    const etablissementId = user.role !== "dev" ? (user.etablissement_id ?? null) : null;

    /* année scolaire active pour le JOIN classe */
    let activeYearId: string | null = null;
    if (etablissementId) {
      const [ay] = await db
        .select({ id: anneesScolairesTable.id })
        .from(anneesScolairesTable)
        .where(and(eq(anneesScolairesTable.etablissement_id, etablissementId), eq(anneesScolairesTable.est_active, true)))
        .limit(1);
      activeYearId = ay?.id ?? null;
    }

    const conditions: ReturnType<typeof eq>[] = [];
    if (etablissementId) conditions.push(eq(elevesTable.etablissement_id, etablissementId));
    if (statut) conditions.push(eq(elevesTable.statut, statut));
    if (sexe) conditions.push(eq(elevesTable.sexe, sexe));
    if (annee) conditions.push(eq(elevesTable.annee_inscription, annee));
    if (matricule_statut) conditions.push(eq(elevesTable.matricule_statut, matricule_statut));

    /* filtre par classe : force une INNER JOIN côté condition */
    const classeConditions = activeYearId
      ? [eq(eleveClassesTable.annee_scolaire_id, activeYearId)]
      : [];

    const whereClause = conditions.length ? and(...conditions) : undefined;

    /* count total */
    let totalCount = 0;
    if (classe_id && activeYearId) {
      const [r] = await db
        .select({ count: count() })
        .from(elevesTable)
        .innerJoin(eleveClassesTable, and(
          eq(eleveClassesTable.eleve_id, elevesTable.id),
          eq(eleveClassesTable.classe_id, classe_id),
          eq(eleveClassesTable.annee_scolaire_id, activeYearId),
        ))
        .where(whereClause);
      totalCount = Number(r?.count ?? 0);
    } else {
      const [r] = whereClause
        ? await db.select({ count: count() }).from(elevesTable).where(whereClause)
        : await db.select({ count: count() }).from(elevesTable);
      totalCount = Number(r?.count ?? 0);
    }

    /* rows avec LEFT JOIN classe */
    let rows: Array<{ eleve: typeof elevesTable.$inferSelect; classe: { id: string; nom: string } | null }>;

    const joinConditions = activeYearId
      ? and(eq(eleveClassesTable.eleve_id, elevesTable.id), ...classeConditions)
      : eq(eleveClassesTable.eleve_id, elevesTable.id);

    if (classe_id && activeYearId) {
      const rawRows = await db
        .select({ eleve: elevesTable, classeId: classesTable.id, classeNom: classesTable.nom })
        .from(elevesTable)
        .innerJoin(eleveClassesTable, and(
          eq(eleveClassesTable.eleve_id, elevesTable.id),
          eq(eleveClassesTable.classe_id, classe_id),
          eq(eleveClassesTable.annee_scolaire_id, activeYearId),
        ))
        .leftJoin(classesTable, eq(classesTable.id, eleveClassesTable.classe_id))
        .where(whereClause)
        .limit(limit)
        .offset(offset);
      rows = rawRows.map(r => ({ eleve: r.eleve, classe: r.classeId ? { id: r.classeId, nom: r.classeNom! } : null }));
    } else {
      const rawRows = await db
        .select({ eleve: elevesTable, classeId: classesTable.id, classeNom: classesTable.nom })
        .from(elevesTable)
        .leftJoin(eleveClassesTable, joinConditions)
        .leftJoin(classesTable, eq(classesTable.id, eleveClassesTable.classe_id))
        .where(whereClause)
        .limit(limit)
        .offset(offset);
      rows = rawRows.map(r => ({ eleve: r.eleve, classe: r.classeId ? { id: r.classeId, nom: r.classeNom! } : null }));
    }

    res.json({
      eleves: rows.map(({ eleve, classe }) => ({ ...mapEleve(eleve), classe_actuelle: classe ?? null })),
      total: totalCount,
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

    /* classe actuelle */
    let classeActuelle: { id: string; nom: string } | null = null;
    const etablissementIdEleve = eleve.etablissement_id;
    if (etablissementIdEleve) {
      const [ay] = await db
        .select({ id: anneesScolairesTable.id })
        .from(anneesScolairesTable)
        .where(and(eq(anneesScolairesTable.etablissement_id, etablissementIdEleve), eq(anneesScolairesTable.est_active, true)))
        .limit(1);
      if (ay) {
        const [ec] = await db
          .select({ classeId: eleveClassesTable.classe_id })
          .from(eleveClassesTable)
          .where(and(eq(eleveClassesTable.eleve_id, rawId), eq(eleveClassesTable.annee_scolaire_id, ay.id)))
          .limit(1);
        if (ec) {
          const [cl] = await db.select({ id: classesTable.id, nom: classesTable.nom }).from(classesTable).where(eq(classesTable.id, ec.classeId)).limit(1);
          if (cl) classeActuelle = cl;
        }
      }
    }

    res.json({
      ...mapEleve(eleve),
      classe_actuelle: classeActuelle,
      historique_statut: (eleve.historique_statut as Array<{ statut: string; motif?: string; date: string }>) ?? [],
      parents,
      documents,
    });
  }
);

/* ─── PUT /eleves/:id/matricule ──────────────────────────── */
router.put(
  "/eleves/:id/matricule",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;
    const { matricule, matricule_statut, matricule_provisoire } = req.body as {
      matricule?: string;
      matricule_statut?: string;
      matricule_provisoire?: string;
    };

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, rawId));
    if (!eleve) { res.status(404).json({ message: "Élève introuvable." }); return; }
    if (user.role !== "dev" && user.etablissement_id !== eleve.etablissement_id) {
      res.status(403).json({ message: "Accès refusé." }); return;
    }

    const validStatuts = ["en_attente", "provisoire", "officiel"];
    if (matricule_statut && !validStatuts.includes(matricule_statut)) {
      res.status(400).json({ message: `Statut invalide. Valeurs acceptées : ${validStatuts.join(", ")}` });
      return;
    }

    const matriculeValide = matricule?.trim() || null;

    if (matriculeValide) {
      const [conflict] = await db.select({ id: elevesTable.id })
        .from(elevesTable)
        .where(
          and(
            eq(elevesTable.etablissement_id, eleve.etablissement_id),
            eq(elevesTable.matricule, matriculeValide),
            ne(elevesTable.id, rawId)
          )
        );
      if (conflict) {
        res.status(400).json({ message: `Le matricule "${matriculeValide}" est déjà utilisé dans cet établissement.` });
        return;
      }
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
      matricule: matriculeValide,
      matricule_statut: matricule_statut ?? (matriculeValide ? "officiel" : "en_attente"),
      matricule_provisoire: matricule_provisoire?.trim() || null,
    };

    const [updated] = await db.update(elevesTable).set(updateData).where(eq(elevesTable.id, rawId)).returning();

    req.log.info({ eleveId: rawId, matricule: matriculeValide, par: user.id }, "Matricule mis à jour");

    res.json({ success: true, message: "Matricule mis à jour.", eleve: mapEleve(updated) });
  }
);

/* ─── PUT /eleves/:id/classe ─────────────────────────────── */
router.put(
  "/eleves/:id/classe",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;
    const { classe_id } = req.body as { classe_id?: string };

    if (!classe_id?.trim()) {
      res.status(400).json({ message: "L'identifiant de la classe est requis." });
      return;
    }

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, rawId));
    if (!eleve) { res.status(404).json({ message: "Élève introuvable." }); return; }
    if (user.role !== "dev" && user.etablissement_id !== eleve.etablissement_id) {
      res.status(403).json({ message: "Accès refusé." }); return;
    }

    const etablissementId = eleve.etablissement_id!;

    const [anneeActive] = await db
      .select({ id: anneesScolairesTable.id })
      .from(anneesScolairesTable)
      .where(and(eq(anneesScolairesTable.etablissement_id, etablissementId), eq(anneesScolairesTable.est_active, true)))
      .limit(1);

    if (!anneeActive) {
      res.status(400).json({ message: "Aucune année scolaire active pour cet établissement." });
      return;
    }

    const [classe] = await db
      .select({ id: classesTable.id, nom: classesTable.nom })
      .from(classesTable)
      .where(and(eq(classesTable.id, classe_id.trim()), eq(classesTable.etablissement_id, etablissementId)))
      .limit(1);

    if (!classe) {
      res.status(404).json({ message: "Classe introuvable dans cet établissement." });
      return;
    }

    await db
      .insert(eleveClassesTable)
      .values({
        eleve_id: eleve.id,
        classe_id: classe.id,
        annee_scolaire_id: anneeActive.id,
        date_affectation: new Date().toISOString().slice(0, 10),
        statut: "actif",
      })
      .onConflictDoUpdate({
        target: [eleveClassesTable.eleve_id, eleveClassesTable.annee_scolaire_id],
        set: {
          classe_id: classe.id,
          statut: "actif",
          date_affectation: new Date().toISOString().slice(0, 10),
          updated_at: new Date(),
        },
      });

    req.log.info({ eleveId: rawId, classeId: classe.id, par: user.id }, "Classe affectée");

    res.json({ success: true, message: `Élève affecté à la classe ${classe.nom}.`, classe });
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
    matricule_statut: e.matricule_statut,
    matricule_provisoire: e.matricule_provisoire,
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
