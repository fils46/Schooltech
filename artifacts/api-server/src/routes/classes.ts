import { Router } from "express";
import { db } from "@workspace/db";
import {
  classesTable, eleveClassesTable, professeurClassesTable,
  elevesTable, utilisateursTable, filieresTable, anneesScolairesTable,
} from "@workspace/db";
import { eq, and, count, sql, type SQL } from "drizzle-orm";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";

const router = Router();

/* ─── Liste des classes ──────────────────────────────────── */
router.get(
  "/classes/liste",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { annee_scolaire, niveau, annee_scolaire_id } = req.query as Record<string, string>;

    try {
      const conditions: SQL<unknown>[] = [];

      if (user.role !== "dev") {
        if (!user.etablissement_id) { res.status(403).json({ message: "Accès refusé." }); return; }
        conditions.push(eq(classesTable.etablissement_id, user.etablissement_id));
      }
      if (annee_scolaire) {
        const yr = parseInt(annee_scolaire);
        if (!isNaN(yr)) conditions.push(eq(classesTable.annee_scolaire, yr));
      }
      if (annee_scolaire_id) {
        conditions.push(eq(classesTable.annee_scolaire_id, annee_scolaire_id));
      }
      if (niveau) {
        conditions.push(eq(classesTable.niveau, niveau));
      }

      const classesRaw = conditions.length > 0
        ? await db.select().from(classesTable).where(and(...conditions)).orderBy(classesTable.niveau, classesTable.nom)
        : await db.select().from(classesTable).orderBy(classesTable.niveau, classesTable.nom);

      // Enrichir avec nb_eleves, filiere, titulaire
      const enriched = await Promise.all(classesRaw.map(async (c) => {
        const [nbResult] = await db
          .select({ count: count() })
          .from(eleveClassesTable)
          .where(and(eq(eleveClassesTable.classe_id, c.id), eq(eleveClassesTable.statut, "actif")));

        let filiere_nom: string | null = null;
        let filiere_code: string | null = null;
        if (c.filiere_id) {
          const [f] = await db.select().from(filieresTable).where(eq(filieresTable.id, c.filiere_id)).limit(1);
          filiere_nom = f?.nom ?? null;
          filiere_code = f?.code ?? null;
        }

        let titulaire_nom: string | null = null;
        if (c.titulaire_id) {
          const [t] = await db.select().from(utilisateursTable).where(eq(utilisateursTable.id, c.titulaire_id)).limit(1);
          titulaire_nom = t ? `${t.prenoms} ${t.nom}` : null;
        }

        return { ...c, nb_eleves: Number(nbResult?.count ?? 0), filiere_nom, filiere_code, titulaire_nom };
      }));

      res.json({ classes: enriched, total: enriched.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Détail d'une classe ────────────────────────────────── */
router.get(
  "/classes/:id/detail",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      let filiere_nom: string | null = null;
      let filiere_code: string | null = null;
      if (classe.filiere_id) {
        const [f] = await db.select().from(filieresTable).where(eq(filieresTable.id, classe.filiere_id)).limit(1);
        filiere_nom = f?.nom ?? null;
        filiere_code = f?.code ?? null;
      }

      let titulaire_nom: string | null = null;
      if (classe.titulaire_id) {
        const [t] = await db.select().from(utilisateursTable).where(eq(utilisateursTable.id, classe.titulaire_id)).limit(1);
        titulaire_nom = t ? `${t.prenoms} ${t.nom}` : null;
      }

      // Élèves de la classe
      const elevesRows = await db
        .select({
          id: eleveClassesTable.id,
          eleve_id: eleveClassesTable.eleve_id,
          classe_id: eleveClassesTable.classe_id,
          annee_scolaire_id: eleveClassesTable.annee_scolaire_id,
          date_affectation: eleveClassesTable.date_affectation,
          statut: eleveClassesTable.statut,
          eleve_nom: elevesTable.nom,
          eleve_prenoms: elevesTable.prenoms,
          eleve_matricule: elevesTable.matricule,
          eleve_sexe: elevesTable.sexe,
        })
        .from(eleveClassesTable)
        .innerJoin(elevesTable, eq(eleveClassesTable.eleve_id, elevesTable.id))
        .where(and(eq(eleveClassesTable.classe_id, rawId), eq(eleveClassesTable.statut, "actif")));

      // Professeurs de la classe
      const profsRows = await db
        .select({
          id: professeurClassesTable.id,
          professeur_id: professeurClassesTable.professeur_id,
          classe_id: professeurClassesTable.classe_id,
          matiere: professeurClassesTable.matiere,
          annee_scolaire_id: professeurClassesTable.annee_scolaire_id,
          prof_nom: utilisateursTable.nom,
          prof_prenoms: utilisateursTable.prenoms,
          prof_email: utilisateursTable.email,
        })
        .from(professeurClassesTable)
        .innerJoin(utilisateursTable, eq(professeurClassesTable.professeur_id, utilisateursTable.id))
        .where(eq(professeurClassesTable.classe_id, rawId));

      res.json({
        ...classe,
        filiere_nom, filiere_code, titulaire_nom,
        nb_eleves: elevesRows.length,
        eleves: elevesRows,
        professeurs: profsRows,
      });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Élèves d'une classe ────────────────────────────────── */
router.get(
  "/classes/:id/eleves",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const eleves = await db
        .select({
          id: eleveClassesTable.id,
          eleve_id: eleveClassesTable.eleve_id,
          classe_id: eleveClassesTable.classe_id,
          annee_scolaire_id: eleveClassesTable.annee_scolaire_id,
          date_affectation: eleveClassesTable.date_affectation,
          statut: eleveClassesTable.statut,
          eleve_nom: elevesTable.nom,
          eleve_prenoms: elevesTable.prenoms,
          eleve_matricule: elevesTable.matricule,
          eleve_sexe: elevesTable.sexe,
        })
        .from(eleveClassesTable)
        .innerJoin(elevesTable, eq(eleveClassesTable.eleve_id, elevesTable.id))
        .where(and(eq(eleveClassesTable.classe_id, rawId), eq(eleveClassesTable.statut, "actif")));

      res.json({ eleves, total: eleves.length });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Statistiques d'une classe ─────────────────────────── */
router.get(
  "/classes/:id/statistiques",
  authMiddleware,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const elevesActifs = await db
        .select({ sexe: elevesTable.sexe })
        .from(eleveClassesTable)
        .innerJoin(elevesTable, eq(eleveClassesTable.eleve_id, elevesTable.id))
        .where(and(eq(eleveClassesTable.classe_id, rawId), eq(eleveClassesTable.statut, "actif")));

      const nb_eleves = elevesActifs.length;
      const nb_garcons = elevesActifs.filter((e) => e.sexe === "M").length;
      const nb_filles = elevesActifs.filter((e) => e.sexe === "F").length;
      const capacite_max = classe.capacite_max ?? 60;
      const taux_remplissage = capacite_max > 0 ? Math.round((nb_eleves / capacite_max) * 100) : 0;

      res.json({ classe_id: rawId, nb_eleves, nb_garcons, nb_filles, capacite_max, taux_remplissage });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Affecter un élève ──────────────────────────────────── */
router.post(
  "/classes/:id/affecter-eleve",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { eleve_id, annee_scolaire_id } = req.body as Record<string, unknown>;

    if (typeof eleve_id !== "string" || typeof annee_scolaire_id !== "string") {
      res.status(400).json({ message: "eleve_id et annee_scolaire_id sont requis." }); return;
    }

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      // Vérifier que l'élève n'est pas déjà dans une classe pour cette année
      const existing = await db
        .select({ id: eleveClassesTable.id })
        .from(eleveClassesTable)
        .where(
          and(
            eq(eleveClassesTable.eleve_id, eleve_id),
            eq(eleveClassesTable.annee_scolaire_id, annee_scolaire_id),
            eq(eleveClassesTable.statut, "actif")
          )
        )
        .limit(1);

      if (existing.length > 0) {
        res.status(400).json({ message: "Cet élève est déjà affecté à une classe pour cette année scolaire." }); return;
      }

      // Vérifier la capacité
      const [nbResult] = await db
        .select({ count: count() })
        .from(eleveClassesTable)
        .where(and(eq(eleveClassesTable.classe_id, rawId), eq(eleveClassesTable.statut, "actif")));
      const nbEleves = Number(nbResult?.count ?? 0);
      const capaciteMax = classe.capacite_max ?? 60;

      if (nbEleves >= capaciteMax) {
        res.status(400).json({ message: `Capacité maximale de la classe atteinte (${capaciteMax} élèves).` }); return;
      }

      await db.insert(eleveClassesTable).values({
        eleve_id,
        classe_id: rawId,
        annee_scolaire_id,
        date_affectation: new Date().toISOString().split("T")[0] as string,
        statut: "actif",
      });

      res.status(201).json({ message: "Élève affecté avec succès." });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Retirer un élève ───────────────────────────────────── */
router.delete(
  "/classes/:id/retirer-eleve/:eleveId",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rawEleveId = Array.isArray(req.params.eleveId) ? req.params.eleveId[0] : req.params.eleveId;

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      // Passer statut = 'transfere' pour conserver l'historique
      await db
        .update(eleveClassesTable)
        .set({ statut: "transfere", updated_at: new Date() })
        .where(
          and(
            eq(eleveClassesTable.classe_id, rawId),
            eq(eleveClassesTable.eleve_id, rawEleveId),
            eq(eleveClassesTable.statut, "actif")
          )
        );

      res.json({ message: "Élève retiré de la classe." });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Affecter un professeur ─────────────────────────────── */
router.post(
  "/classes/:id/affecter-professeur",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { professeur_id, matiere, annee_scolaire_id } = req.body as Record<string, unknown>;

    if (
      typeof professeur_id !== "string" ||
      typeof matiere !== "string" || !matiere.trim() ||
      typeof annee_scolaire_id !== "string"
    ) {
      res.status(400).json({ message: "professeur_id, matiere et annee_scolaire_id sont requis." }); return;
    }

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      // Vérifier que l'utilisateur est bien un professeur
      const [prof] = await db
        .select({ role: utilisateursTable.role })
        .from(utilisateursTable)
        .where(eq(utilisateursTable.id, professeur_id))
        .limit(1);

      if (!prof || prof.role !== "professeur") {
        res.status(400).json({ message: "L'utilisateur n'est pas un professeur." }); return;
      }

      await db.insert(professeurClassesTable).values({
        professeur_id,
        classe_id: rawId,
        matiere: matiere.trim(),
        annee_scolaire_id,
      });

      res.status(201).json({ message: "Professeur affecté avec succès." });
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("unique")) {
        res.status(400).json({ message: "Ce professeur enseigne déjà cette matière dans cette classe." }); return;
      }
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Retirer un professeur ──────────────────────────────── */
router.delete(
  "/classes/:id/retirer-professeur/:profId",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rawProfId = Array.isArray(req.params.profId) ? req.params.profId[0] : req.params.profId;

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      await db
        .delete(professeurClassesTable)
        .where(
          and(
            eq(professeurClassesTable.classe_id, rawId),
            eq(professeurClassesTable.id, rawProfId)
          )
        );

      res.json({ message: "Professeur retiré de la classe." });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Classes d'un professeur ────────────────────────────── */
router.get(
  "/professeurs/:id/classes",
  authMiddleware,
  requireRole("directeur", "censeur", "dev"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const profId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const rows = await db
        .select({
          id: professeurClassesTable.id,
          classe_id: professeurClassesTable.classe_id,
          classe_nom: classesTable.nom,
          classe_niveau: classesTable.niveau,
          matiere: professeurClassesTable.matiere,
          annee_scolaire_id: professeurClassesTable.annee_scolaire_id,
          annee_label: anneesScolairesTable.libelle,
        })
        .from(professeurClassesTable)
        .innerJoin(classesTable, eq(professeurClassesTable.classe_id, classesTable.id))
        .leftJoin(anneesScolairesTable, eq(professeurClassesTable.annee_scolaire_id, anneesScolairesTable.id))
        .where(
          user.role === "dev"
            ? eq(professeurClassesTable.professeur_id, profId)
            : and(
                eq(professeurClassesTable.professeur_id, profId),
                eq(classesTable.etablissement_id, user.etablissement_id!)
              )
        );
      res.json({ success: true, data: rows });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Montée de classe ───────────────────────────────────── */
router.post(
  "/classes/montee",
  authMiddleware,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { ancienne_annee_id, nouvelle_annee_id, mappings } = req.body as {
      ancienne_annee_id: string;
      nouvelle_annee_id: string;
      mappings: { classe_source_id: string; classe_destination_id: string }[];
    };

    if (!ancienne_annee_id || !nouvelle_annee_id || !Array.isArray(mappings) || mappings.length === 0) {
      res.status(400).json({ message: "ancienne_annee_id, nouvelle_annee_id et mappings sont requis." }); return;
    }

    try {
      let totalTransferes = 0;
      const dateAffectation = new Date().toISOString().split("T")[0] as string;

      await db.transaction(async (tx) => {
        for (const mapping of mappings) {
          const { classe_source_id, classe_destination_id } = mapping;

          if (user.role !== "dev") {
            const [src] = await tx.select().from(classesTable).where(eq(classesTable.id, classe_source_id)).limit(1);
            if (!src || src.etablissement_id !== user.etablissement_id) {
              throw new Error("Accès refusé à la classe source.");
            }
          }

          const elevesActifs = await tx
            .select({ eleve_id: eleveClassesTable.eleve_id })
            .from(eleveClassesTable)
            .where(
              and(
                eq(eleveClassesTable.classe_id, classe_source_id),
                eq(eleveClassesTable.annee_scolaire_id, ancienne_annee_id),
                eq(eleveClassesTable.statut, "actif")
              )
            );

          for (const { eleve_id } of elevesActifs) {
            const existing = await tx
              .select({ id: eleveClassesTable.id })
              .from(eleveClassesTable)
              .where(
                and(
                  eq(eleveClassesTable.eleve_id, eleve_id),
                  eq(eleveClassesTable.annee_scolaire_id, nouvelle_annee_id)
                )
              )
              .limit(1);

            if (existing.length === 0) {
              await tx.insert(eleveClassesTable).values({
                eleve_id,
                classe_id: classe_destination_id,
                annee_scolaire_id: nouvelle_annee_id,
                date_affectation: dateAffectation,
                statut: "actif",
              });
              totalTransferes++;
            }
          }
        }
      });

      res.json({ message: "Montée de classe effectuée.", eleves_transferes: totalTransferes });
    } catch (err) {
      req.log.error(err);
      const msg = err instanceof Error ? err.message : "Erreur serveur.";
      res.status(500).json({ message: msg });
    }
  }
);

/* ─── Créer une classe ───────────────────────────────────── */
router.post(
  "/classes/creer",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const {
      nom, niveau, section, annee_scolaire, annee_scolaire_id,
      filiere_id, titulaire_id, capacite_max, etablissement_id,
    } = req.body as Record<string, unknown>;

    if (typeof nom !== "string" || !nom.trim() || typeof niveau !== "string" || !niveau.trim()) {
      res.status(400).json({ message: "nom et niveau sont obligatoires." }); return;
    }

    const etabId = user.role === "dev"
      ? (typeof etablissement_id === "string" ? etablissement_id : null)
      : user.etablissement_id;

    if (!etabId) { res.status(400).json({ message: "Établissement requis." }); return; }

    const anneeInt = annee_scolaire != null ? Number(annee_scolaire) : new Date().getFullYear();

    try {
      const existing = await db.select({ id: classesTable.id })
        .from(classesTable)
        .where(
          and(
            eq(classesTable.etablissement_id, etabId),
            eq(classesTable.nom, nom.trim()),
            eq(classesTable.annee_scolaire, anneeInt)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        res.status(400).json({ message: `La classe "${nom.trim()}" existe déjà pour cette année scolaire.` }); return;
      }

      const [classe] = await db.insert(classesTable).values({
        etablissement_id: etabId,
        nom: nom.trim(),
        niveau: niveau.trim(),
        section: typeof section === "string" ? section.trim() : "",
        annee_scolaire: anneeInt,
        annee_scolaire_id: typeof annee_scolaire_id === "string" ? annee_scolaire_id : null,
        filiere_id: typeof filiere_id === "string" ? filiere_id : null,
        titulaire_id: typeof titulaire_id === "string" ? titulaire_id : null,
        capacite_max: capacite_max != null ? Number(capacite_max) : 60,
        actif: true,
      }).returning();

      res.status(201).json(classe);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Modifier une classe ────────────────────────────────── */
router.put(
  "/classes/:id",
  authMiddleware,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const {
      nom, niveau, section, annee_scolaire, annee_scolaire_id,
      filiere_id, titulaire_id, capacite_max, actif,
    } = req.body as Record<string, unknown>;

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const [updated] = await db.update(classesTable).set({
        nom: typeof nom === "string" ? nom.trim() : classe.nom,
        niveau: typeof niveau === "string" ? niveau.trim() : classe.niveau,
        section: typeof section === "string" ? section.trim() : classe.section,
        annee_scolaire: annee_scolaire != null ? Number(annee_scolaire) : classe.annee_scolaire,
        annee_scolaire_id: typeof annee_scolaire_id === "string" ? annee_scolaire_id : classe.annee_scolaire_id,
        filiere_id: typeof filiere_id === "string" ? filiere_id : classe.filiere_id,
        titulaire_id: typeof titulaire_id === "string" ? titulaire_id : classe.titulaire_id,
        capacite_max: capacite_max != null ? Number(capacite_max) : classe.capacite_max,
        actif: typeof actif === "boolean" ? actif : classe.actif,
        updated_at: new Date(),
      }).where(eq(classesTable.id, rawId)).returning();

      res.json(updated);
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

/* ─── Supprimer une classe ───────────────────────────────── */
router.delete(
  "/classes/:id",
  authMiddleware,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const rows = await db.select().from(classesTable).where(eq(classesTable.id, rawId)).limit(1);
      const classe = rows[0];
      if (!classe) { res.status(404).json({ message: "Classe introuvable." }); return; }
      if (user.role !== "dev" && user.etablissement_id !== classe.etablissement_id) {
        res.status(403).json({ message: "Accès refusé." }); return;
      }

      const [nbResult] = await db
        .select({ count: count() })
        .from(eleveClassesTable)
        .where(and(eq(eleveClassesTable.classe_id, rawId), eq(eleveClassesTable.statut, "actif")));

      if (Number(nbResult?.count ?? 0) > 0) {
        res.status(400).json({ message: "Impossible de supprimer une classe avec des élèves affectés." }); return;
      }

      await db.delete(classesTable).where(eq(classesTable.id, rawId));
      res.json({ message: "Classe supprimée." });
    } catch (err) {
      req.log.error(err);
      res.status(500).json({ message: "Erreur serveur." });
    }
  }
);

export default router;
