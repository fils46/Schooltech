import { Router } from "express";
import { eq, and, asc } from "drizzle-orm";
import {
  db, matieresConfigTable, utilisateursTable, notesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

const ROLES_ADMIN = ["dev", "directeur", "censeur"];

/* ─── GET /api/matieres-config/classe/:classeId ─────────────── */
router.get(
  "/api/matieres-config/classe/:classeId",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const classeId = normalizeId(req.params.classeId);
    const user = req.user!;
    const { annee_scolaire_id } = req.query as Record<string, string>;

    const conditions = [
      eq(matieresConfigTable.classe_id, classeId),
      eq(matieresConfigTable.actif, true),
    ];
    if (user.role !== "dev") {
      conditions.push(eq(matieresConfigTable.etablissement_id, user.etablissement_id ?? ""));
    }
    if (annee_scolaire_id) {
      conditions.push(eq(matieresConfigTable.annee_scolaire_id, annee_scolaire_id));
    }

    const rows = await db
      .select()
      .from(matieresConfigTable)
      .where(and(...conditions))
      .orderBy(asc(matieresConfigTable.ordre_affichage));

    const enriched = await Promise.all(rows.map(async (r) => {
      let professeur_nom: string | null = null;
      if (r.professeur_id) {
        const [prof] = await db
          .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
          .from(utilisateursTable)
          .where(eq(utilisateursTable.id, r.professeur_id))
          .limit(1);
        if (prof) professeur_nom = `${prof.prenoms} ${prof.nom}`;
      }
      return {
        ...r,
        coefficient: Number(r.coefficient),
        professeur_nom,
      };
    }));

    res.json({ matieres: enriched });
  }
);

/* ─── POST /api/matieres-config/configurer ─────────────────── */
router.post(
  "/api/matieres-config/configurer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const { classe_id, annee_scolaire_id, matieres } = req.body as {
      classe_id: string;
      annee_scolaire_id: string;
      matieres: Array<{
        nom_matiere: string;
        coefficient: number;
        ordre_affichage: number;
        professeur_id?: string | null;
      }>;
    };

    if (!classe_id || !annee_scolaire_id || !Array.isArray(matieres) || matieres.length === 0) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    const etabId = user.etablissement_id ?? "";

    // Désactiver les anciennes configs
    await db
      .update(matieresConfigTable)
      .set({ actif: false })
      .where(
        and(
          eq(matieresConfigTable.classe_id, classe_id),
          eq(matieresConfigTable.annee_scolaire_id, annee_scolaire_id),
          eq(matieresConfigTable.etablissement_id, etabId)
        )
      );

    // Insérer ou réactiver chaque matière
    const results = [];
    for (const m of matieres) {
      // Chercher si déjà existante
      const [existing] = await db
        .select()
        .from(matieresConfigTable)
        .where(
          and(
            eq(matieresConfigTable.classe_id, classe_id),
            eq(matieresConfigTable.annee_scolaire_id, annee_scolaire_id),
            eq(matieresConfigTable.nom_matiere, m.nom_matiere),
            eq(matieresConfigTable.etablissement_id, etabId)
          )
        )
        .limit(1);

      if (existing) {
        const [updated] = await db
          .update(matieresConfigTable)
          .set({
            coefficient: String(m.coefficient),
            ordre_affichage: m.ordre_affichage,
            professeur_id: m.professeur_id ?? null,
            actif: true,
            updated_at: new Date(),
          })
          .where(eq(matieresConfigTable.id, existing.id))
          .returning();
        results.push(updated);
      } else {
        const [created] = await db
          .insert(matieresConfigTable)
          .values({
            etablissement_id: etabId,
            classe_id,
            annee_scolaire_id,
            nom_matiere: m.nom_matiere,
            coefficient: String(m.coefficient),
            ordre_affichage: m.ordre_affichage,
            professeur_id: m.professeur_id ?? null,
            actif: true,
          })
          .returning();
        results.push(created);
      }
    }

    res.json({
      matieres: results.map(r => ({ ...r, coefficient: Number(r.coefficient) })),
    });
  }
);

/* ─── PUT /api/matieres-config/:id/modifier ─────────────────── */
router.put(
  "/api/matieres-config/:id/modifier",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!ROLES_ADMIN.includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const id = normalizeId(req.params.id);
    const { nom_matiere, coefficient, ordre_affichage, professeur_id, actif } = req.body as Record<string, unknown>;

    const [existing] = await db
      .select()
      .from(matieresConfigTable)
      .where(eq(matieresConfigTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Matière introuvable." });
      return;
    }

    const updates: Partial<typeof matieresConfigTable.$inferInsert> = { updated_at: new Date() };
    if (nom_matiere !== undefined) updates.nom_matiere = String(nom_matiere);
    if (coefficient !== undefined) updates.coefficient = String(coefficient);
    if (ordre_affichage !== undefined) updates.ordre_affichage = Number(ordre_affichage);
    if (professeur_id !== undefined) updates.professeur_id = professeur_id ? String(professeur_id) : null;
    if (actif !== undefined) updates.actif = Boolean(actif);

    const [updated] = await db
      .update(matieresConfigTable)
      .set(updates)
      .where(eq(matieresConfigTable.id, id))
      .returning();

    res.json({ matiere: { ...updated, coefficient: Number(updated.coefficient) } });
  }
);

/* ─── DELETE /api/matieres-config/:id/supprimer ─────────────── */
router.delete(
  "/api/matieres-config/:id/supprimer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    if (!["dev", "directeur"].includes(user.role)) {
      res.status(403).json({ message: "Accès non autorisé." });
      return;
    }

    const id = normalizeId(req.params.id);
    const [existing] = await db
      .select()
      .from(matieresConfigTable)
      .where(eq(matieresConfigTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Matière introuvable." });
      return;
    }

    // Vérifier qu'aucune note n'existe pour cette matière
    const [note] = await db
      .select({ id: notesTable.id })
      .from(notesTable)
      .where(
        and(
          eq(notesTable.classe_id, existing.classe_id),
          eq(notesTable.matiere, existing.nom_matiere),
          eq(notesTable.annee_scolaire_id, existing.annee_scolaire_id)
        )
      )
      .limit(1);

    if (note) {
      res.status(409).json({ message: "Impossible de supprimer : des notes existent pour cette matière." });
      return;
    }

    await db.delete(matieresConfigTable).where(eq(matieresConfigTable.id, id));
    res.json({ message: "Matière supprimée." });
  }
);

export default router;
