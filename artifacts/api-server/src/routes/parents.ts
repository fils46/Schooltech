import { Router } from "express";
import bcrypt from "bcrypt";
import { eq, and, inArray, ne } from "drizzle-orm";
import {
  db,
  parentsElevesTable,
  utilisateursTable,
  elevesTable,
  eleveClassesTable,
  classesTable,
  anneesScolairesTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { generateTempPassword } from "../lib/auth";

const router = Router();

const LIEN_VALIDES = ["pere", "mere", "tuteur", "autre"];

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

/* ─── Helper : classe active d'un élève ──────────────────── */
async function getClasseEleve(eleveId: string) {
  const [ec] = await db
    .select()
    .from(eleveClassesTable)
    .where(and(eq(eleveClassesTable.eleve_id, eleveId), eq(eleveClassesTable.statut, "actif")))
    .limit(1);
  if (!ec) return null;
  const [classe] = await db.select().from(classesTable).where(eq(classesTable.id, ec.classe_id)).limit(1);
  const [annee] = await db.select().from(anneesScolairesTable).where(eq(anneesScolairesTable.id, ec.annee_scolaire_id)).limit(1);
  return { classe, annee };
}

/* ─── GET /api/parents ─────────────────────────────────────── */
router.get(
  "/api/parents",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const etabId = user.role === "dev" ? (req.query.etablissement_id as string | undefined) : user.etablissement_id ?? undefined;

    const parentsUsers = await db
      .select()
      .from(utilisateursTable)
      .where(
        etabId
          ? and(eq(utilisateursTable.role, "parent"), eq(utilisateursTable.etablissement_id, etabId))
          : eq(utilisateursTable.role, "parent")
      );

    const result = await Promise.all(
      parentsUsers.map(async (p) => {
        const liens = await db
          .select()
          .from(parentsElevesTable)
          .where(eq(parentsElevesTable.utilisateur_id, p.id));

        const enfants = await Promise.all(
          liens.map(async (l) => {
            const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, l.eleve_id)).limit(1);
            return eleve
              ? { id: eleve.id, nom: eleve.nom, prenoms: eleve.prenoms, lien: l.lien, est_principal: l.est_principal }
              : null;
          })
        );

        return {
          id: p.id,
          nom: p.nom,
          prenoms: p.prenoms,
          email: p.email,
          telephone: p.telephone,
          actif: p.actif,
          created_at: p.created_at,
          nb_enfants: liens.length,
          enfants: enfants.filter(Boolean),
        };
      })
    );

    res.json(result);
  }
);

/* ─── POST /api/parents/creer ──────────────────────────────── */
router.post(
  "/api/parents/creer",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { nom, prenoms, email, telephone, eleve_id, lien, est_principal } = req.body as {
      nom?: string;
      prenoms?: string;
      email?: string;
      telephone?: string;
      eleve_id?: string;
      lien?: string;
      est_principal?: boolean;
    };

    if (!nom || !prenoms || !email || !eleve_id || !lien) {
      res.status(400).json({ message: "Champs requis : nom, prenoms, email, eleve_id, lien." });
      return;
    }
    if (!LIEN_VALIDES.includes(lien)) {
      res.status(400).json({ message: "Lien invalide. Valeurs : père, mère, tuteur, autre." });
      return;
    }

    const etabId = user.etablissement_id;
    if (!etabId) { res.status(403).json({ message: "Aucun établissement associé." }); return; }

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, eleve_id)).limit(1);
    if (!eleve || eleve.etablissement_id !== etabId) {
      res.status(404).json({ message: "Élève introuvable ou hors établissement." });
      return;
    }

    const [existingUser] = await db
      .select()
      .from(utilisateursTable)
      .where(eq(utilisateursTable.email, email.toLowerCase().trim()))
      .limit(1);

    let parentUser = existingUser;
    let nouveau = false;
    let motDePasse: string | undefined;

    if (!parentUser) {
      motDePasse = generateTempPassword();
      const hashed = await bcrypt.hash(motDePasse, 10);
      const [created] = await db
        .insert(utilisateursTable)
        .values({
          nom: nom.trim(),
          prenoms: prenoms.trim(),
          email: email.toLowerCase().trim(),
          telephone: telephone?.trim() ?? null,
          password: hashed,
          role: "parent",
          etablissement_id: etabId,
          actif: true,
          premier_login: true,
        })
        .returning();
      parentUser = created;
      nouveau = true;
    } else {
      if (parentUser.role !== "parent") {
        res.status(400).json({ message: "Cet email appartient à un utilisateur avec un rôle différent." });
        return;
      }
    }

    const [existingLien] = await db
      .select()
      .from(parentsElevesTable)
      .where(and(eq(parentsElevesTable.eleve_id, eleve_id), eq(parentsElevesTable.utilisateur_id, parentUser.id)))
      .limit(1);

    if (existingLien) {
      res.status(400).json({ message: "Ce parent est déjà lié à cet élève." });
      return;
    }

    if (est_principal) {
      await db
        .update(parentsElevesTable)
        .set({ est_principal: false })
        .where(and(eq(parentsElevesTable.eleve_id, eleve_id), eq(parentsElevesTable.est_principal, true)));
    }

    const [liaison] = await db
      .insert(parentsElevesTable)
      .values({
        eleve_id,
        utilisateur_id: parentUser.id,
        etablissement_id: etabId,
        lien,
        est_principal: est_principal ?? false,
      })
      .returning();

    res.status(201).json({
      parent: { ...parentUser, password: undefined },
      liaison,
      nouveau,
      ...(motDePasse ? { mot_de_passe_temporaire: motDePasse } : {}),
    });
  }
);

/* ─── POST /api/parents/lier ───────────────────────────────── */
router.post(
  "/api/parents/lier",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    const { utilisateur_id, eleve_id, lien, est_principal } = req.body as {
      utilisateur_id?: string;
      eleve_id?: string;
      lien?: string;
      est_principal?: boolean;
    };

    if (!utilisateur_id || !eleve_id || !lien) {
      res.status(400).json({ message: "Champs requis : utilisateur_id, eleve_id, lien." });
      return;
    }
    if (!LIEN_VALIDES.includes(lien)) {
      res.status(400).json({ message: "Lien invalide." });
      return;
    }

    const etabId = user.etablissement_id;
    if (!etabId) { res.status(403).json({ message: "Aucun établissement associé." }); return; }

    const [parent] = await db.select().from(utilisateursTable).where(eq(utilisateursTable.id, utilisateur_id)).limit(1);
    if (!parent || parent.role !== "parent") {
      res.status(400).json({ message: "Utilisateur introuvable ou rôle non parent." });
      return;
    }

    const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, eleve_id)).limit(1);
    if (!eleve || eleve.etablissement_id !== etabId) {
      res.status(404).json({ message: "Élève introuvable ou hors établissement." });
      return;
    }

    const [existing] = await db
      .select()
      .from(parentsElevesTable)
      .where(and(eq(parentsElevesTable.eleve_id, eleve_id), eq(parentsElevesTable.utilisateur_id, utilisateur_id)))
      .limit(1);
    if (existing) { res.status(400).json({ message: "Ce parent est déjà lié à cet élève." }); return; }

    if (est_principal) {
      await db
        .update(parentsElevesTable)
        .set({ est_principal: false })
        .where(and(eq(parentsElevesTable.eleve_id, eleve_id), eq(parentsElevesTable.est_principal, true)));
    }

    const [liaison] = await db
      .insert(parentsElevesTable)
      .values({ eleve_id, utilisateur_id, etablissement_id: etabId, lien, est_principal: est_principal ?? false })
      .returning();

    res.status(201).json(liaison);
  }
);

/* ─── GET /api/parents/eleve/:eleveId ─────────────────────── */
router.get(
  "/api/parents/eleve/:eleveId",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const eleveId = normalizeId(req.params.eleveId);
    const liens = await db.select().from(parentsElevesTable).where(eq(parentsElevesTable.eleve_id, eleveId));

    const result = await Promise.all(
      liens.map(async (l) => {
        const [u] = await db.select().from(utilisateursTable).where(eq(utilisateursTable.id, l.utilisateur_id)).limit(1);
        return {
          liaison_id: l.id,
          utilisateur_id: l.utilisateur_id,
          lien: l.lien,
          est_principal: l.est_principal,
          peut_consulter_notes: l.peut_consulter_notes,
          peut_consulter_absences: l.peut_consulter_absences,
          peut_envoyer_messages: l.peut_envoyer_messages,
          nom: u?.nom ?? "",
          prenoms: u?.prenoms ?? "",
          email: u?.email ?? "",
          telephone: u?.telephone ?? null,
          actif: u?.actif ?? false,
        };
      })
    );

    res.json(result);
  }
);

/* ─── GET /api/parents/:parentId/enfants ──────────────────── */
router.get(
  "/api/parents/:parentId/enfants",
  authMiddleware,
  verifierLicence,
  async (req, res): Promise<void> => {
    const user = req.user!;
    const parentId = normalizeId(req.params.parentId);

    const autorise =
      ["directeur", "censeur"].includes(user.role) ||
      (user.role === "parent" && user.id === parentId);
    if (!autorise) { res.status(403).json({ message: "Accès refusé." }); return; }

    const liens = await db.select().from(parentsElevesTable).where(eq(parentsElevesTable.utilisateur_id, parentId));

    const enfants = await Promise.all(
      liens.map(async (l) => {
        const [eleve] = await db.select().from(elevesTable).where(eq(elevesTable.id, l.eleve_id)).limit(1);
        const ctx = await getClasseEleve(l.eleve_id);
        return {
          liaison_id: l.id,
          eleve_id: l.eleve_id,
          lien: l.lien,
          est_principal: l.est_principal,
          peut_consulter_notes: l.peut_consulter_notes,
          peut_consulter_absences: l.peut_consulter_absences,
          peut_envoyer_messages: l.peut_envoyer_messages,
          nom: eleve?.nom ?? "",
          prenoms: eleve?.prenoms ?? "",
          matricule: eleve?.matricule ?? "",
          statut: eleve?.statut ?? "",
          classe: ctx?.classe?.nom ?? null,
          classe_id: ctx?.classe?.id ?? null,
          annee: ctx?.annee?.libelle ?? null,
        };
      })
    );

    res.json(enfants);
  }
);

/* ─── PUT /api/parents/liaison/:id ────────────────────────── */
router.put(
  "/api/parents/liaison/:id",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const liaId = normalizeId(req.params.id);
    const { lien, est_principal, peut_consulter_notes, peut_consulter_absences, peut_envoyer_messages } = req.body as {
      lien?: string;
      est_principal?: boolean;
      peut_consulter_notes?: boolean;
      peut_consulter_absences?: boolean;
      peut_envoyer_messages?: boolean;
    };

    const [liaison] = await db.select().from(parentsElevesTable).where(eq(parentsElevesTable.id, liaId)).limit(1);
    if (!liaison) { res.status(404).json({ message: "Liaison introuvable." }); return; }

    if (lien && !LIEN_VALIDES.includes(lien)) {
      res.status(400).json({ message: "Lien invalide." }); return;
    }

    if (est_principal === true) {
      await db
        .update(parentsElevesTable)
        .set({ est_principal: false })
        .where(and(
          eq(parentsElevesTable.eleve_id, liaison.eleve_id),
          ne(parentsElevesTable.id, liaId)
        ));
    }

    const setData: Partial<typeof parentsElevesTable.$inferInsert> & { updated_at: Date } = {
      updated_at: new Date(),
    };
    if (lien !== undefined) setData.lien = lien;
    if (est_principal !== undefined) setData.est_principal = est_principal;
    if (peut_consulter_notes !== undefined) setData.peut_consulter_notes = peut_consulter_notes;
    if (peut_consulter_absences !== undefined) setData.peut_consulter_absences = peut_consulter_absences;
    if (peut_envoyer_messages !== undefined) setData.peut_envoyer_messages = peut_envoyer_messages;

    const [updated] = await db.update(parentsElevesTable).set(setData).where(eq(parentsElevesTable.id, liaId)).returning();
    res.json(updated);
  }
);

/* ─── DELETE /api/parents/liaison/:id ─────────────────────── */
router.delete(
  "/api/parents/liaison/:id",
  authMiddleware,
  verifierLicence,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const liaId = normalizeId(req.params.id);

    const [liaison] = await db.select().from(parentsElevesTable).where(eq(parentsElevesTable.id, liaId)).limit(1);
    if (!liaison) { res.status(404).json({ message: "Liaison introuvable." }); return; }

    await db.delete(parentsElevesTable).where(eq(parentsElevesTable.id, liaId));

    const restants = await db
      .select()
      .from(parentsElevesTable)
      .where(eq(parentsElevesTable.utilisateur_id, liaison.utilisateur_id));

    if (restants.length === 0) {
      await db
        .update(utilisateursTable)
        .set({ actif: false })
        .where(eq(utilisateursTable.id, liaison.utilisateur_id));
    }

    res.json({ message: "Liaison supprimée.", parent_desactive: restants.length === 0 });
  }
);

/* ─── POST /api/parents/:id/reinitialiser-mdp ─────────────── */
router.post(
  "/api/parents/:id/reinitialiser-mdp",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const parentId = normalizeId(req.params.id);

    const [parent] = await db.select().from(utilisateursTable).where(eq(utilisateursTable.id, parentId)).limit(1);
    if (!parent || parent.role !== "parent") {
      res.status(404).json({ message: "Parent introuvable." }); return;
    }

    const motDePasse = generateTempPassword();
    const hashed = await bcrypt.hash(motDePasse, 10);

    await db
      .update(utilisateursTable)
      .set({ password: hashed, premier_login: true })
      .where(eq(utilisateursTable.id, parentId));

    res.json({ message: "Mot de passe réinitialisé.", nouveau_mot_de_passe: motDePasse });
  }
);

export default router;
