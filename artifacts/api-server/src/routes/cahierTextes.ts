import { Router } from "express";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import {
  db, cahierTextesTable, classesTable, utilisateursTable,
  professeurClassesTable, eleveClassesTable,
  parentsElevesTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

function normalizeId(v: string | string[]): string {
  return Array.isArray(v) ? v[0] : v;
}

async function enrichirSeance(s: typeof cahierTextesTable.$inferSelect) {
  const [prof] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, s.professeur_id))
    .limit(1);
  const [classe] = await db
    .select({ nom: classesTable.nom })
    .from(classesTable)
    .where(eq(classesTable.id, s.classe_id))
    .limit(1);
  return {
    ...s,
    professeur_nom: prof ? `${prof.prenoms} ${prof.nom}` : null,
    classe_nom: classe?.nom ?? null,
  };
}

/* ─── POST /api/cahier-textes/creer ─────────────────────── */
router.post(
  "/api/cahier-textes/creer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const {
      classe_id, annee_scolaire_id, matiere, date_seance,
      creneau_id, titre_lecon, contenu_lecon, travaux_donnes,
      devoir_a_rendre, date_remise_devoir,
    } = req.body as Record<string, string | boolean>;

    if (!classe_id || !matiere || !date_seance || !titre_lecon || !annee_scolaire_id) {
      res.status(400).json({ message: "Champs obligatoires manquants." });
      return;
    }

    // Vérifier date_seance <= aujourd'hui
    const today = new Date().toISOString().slice(0, 10);
    if (String(date_seance) > today) {
      res.status(400).json({ message: "La date de séance ne peut pas être dans le futur." });
      return;
    }

    // Vérifier devoir_a_rendre => date_remise_devoir obligatoire
    if (devoir_a_rendre && !date_remise_devoir) {
      res.status(400).json({ message: "La date de remise du devoir est obligatoire." });
      return;
    }

    // Vérifier que le professeur enseigne dans cette classe (sauf directeur/censeur/dev)
    if (user.role === "professeur") {
      const [assoc] = await db
        .select()
        .from(professeurClassesTable)
        .where(
          and(
            eq(professeurClassesTable.professeur_id, user.id),
            eq(professeurClassesTable.classe_id, String(classe_id)),
            eq(professeurClassesTable.matiere, String(matiere))
          )
        )
        .limit(1);
      if (!assoc) {
        res.status(403).json({ message: "Vous n'enseignez pas cette matière dans cette classe." });
        return;
      }
    }

    const [seance] = await db
      .insert(cahierTextesTable)
      .values({
        etablissement_id: user.etablissement_id ?? "",
        professeur_id: user.id,
        classe_id: String(classe_id),
        annee_scolaire_id: String(annee_scolaire_id),
        matiere: String(matiere),
        date_seance: String(date_seance),
        creneau_id: creneau_id ? String(creneau_id) : null,
        titre_lecon: String(titre_lecon),
        contenu_lecon: contenu_lecon ? String(contenu_lecon) : null,
        travaux_donnes: travaux_donnes ? String(travaux_donnes) : null,
        devoir_a_rendre: Boolean(devoir_a_rendre),
        date_remise_devoir: date_remise_devoir ? String(date_remise_devoir) : null,
      })
      .returning();

    res.status(201).json({ message: "Séance créée.", seance: await enrichirSeance(seance) });
  }
);

/* ─── GET /api/cahier-textes/devoirs-a-venir ─────────────── */
router.get(
  "/api/cahier-textes/devoirs-a-venir",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const today = new Date().toISOString().slice(0, 10);
    const { classe_id } = req.query as Record<string, string>;

    const conditions = [
      eq(cahierTextesTable.etablissement_id, user.etablissement_id ?? ""),
      eq(cahierTextesTable.devoir_a_rendre, true),
      gte(cahierTextesTable.date_remise_devoir, today),
    ];

    if (classe_id) conditions.push(eq(cahierTextesTable.classe_id, classe_id));

    if (user.role === "professeur") {
      conditions.push(eq(cahierTextesTable.professeur_id, user.id));
    }

    const seances = await db
      .select()
      .from(cahierTextesTable)
      .where(and(...conditions))
      .orderBy(cahierTextesTable.date_remise_devoir);

    const enriched = await Promise.all(seances.map(enrichirSeance));
    res.json({ devoirs: enriched });
  }
);

/* ─── GET /api/cahier-textes/liste ──────────────────────── */
router.get(
  "/api/cahier-textes/liste",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const user = req.user!;
    const { classe_id, matiere, date_debut, date_fin, annee_scolaire_id } =
      req.query as Record<string, string>;

    const conditions = [
      eq(cahierTextesTable.etablissement_id, user.etablissement_id ?? ""),
    ];

    if (user.role === "professeur") {
      conditions.push(eq(cahierTextesTable.professeur_id, user.id));
    }
    if (classe_id) conditions.push(eq(cahierTextesTable.classe_id, classe_id));
    if (matiere) conditions.push(eq(cahierTextesTable.matiere, matiere));
    if (annee_scolaire_id)
      conditions.push(eq(cahierTextesTable.annee_scolaire_id, annee_scolaire_id));
    if (date_debut) conditions.push(gte(cahierTextesTable.date_seance, date_debut));
    if (date_fin) conditions.push(lte(cahierTextesTable.date_seance, date_fin));

    const seances = await db
      .select()
      .from(cahierTextesTable)
      .where(and(...conditions))
      .orderBy(desc(cahierTextesTable.date_seance));

    const enriched = await Promise.all(seances.map(enrichirSeance));
    res.json({ seances: enriched, total: enriched.length });
  }
);

/* ─── GET /api/cahier-textes/:id ────────────────────────── */
router.get(
  "/api/cahier-textes/:id",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;

    const [seance] = await db
      .select()
      .from(cahierTextesTable)
      .where(
        and(
          eq(cahierTextesTable.id, id),
          eq(cahierTextesTable.etablissement_id, user.etablissement_id ?? "")
        )
      )
      .limit(1);

    if (!seance) {
      res.status(404).json({ message: "Séance introuvable." });
      return;
    }

    res.json({ seance: await enrichirSeance(seance) });
  }
);

/* ─── PUT /api/cahier-textes/:id/modifier ───────────────── */
router.put(
  "/api/cahier-textes/:id/modifier",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;

    const [existing] = await db
      .select()
      .from(cahierTextesTable)
      .where(eq(cahierTextesTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Séance introuvable." });
      return;
    }

    if (user.role === "professeur" && existing.professeur_id !== user.id) {
      res.status(403).json({ message: "Non autorisé." });
      return;
    }

    // Limite 48h
    if (user.role === "professeur") {
      const limite = new Date(existing.created_at);
      limite.setHours(limite.getHours() + 48);
      if (new Date() > limite) {
        res.status(403).json({
          message: "La modification est limitée à 48h après la création.",
        });
        return;
      }
    }

    const {
      titre_lecon, contenu_lecon, travaux_donnes,
      devoir_a_rendre, date_remise_devoir,
    } = req.body as Record<string, string | boolean>;

    if (devoir_a_rendre && !date_remise_devoir) {
      res.status(400).json({ message: "La date de remise du devoir est obligatoire." });
      return;
    }

    const [updated] = await db
      .update(cahierTextesTable)
      .set({
        titre_lecon: titre_lecon ? String(titre_lecon) : existing.titre_lecon,
        contenu_lecon: contenu_lecon !== undefined ? String(contenu_lecon) : existing.contenu_lecon,
        travaux_donnes: travaux_donnes !== undefined ? String(travaux_donnes) : existing.travaux_donnes,
        devoir_a_rendre: devoir_a_rendre !== undefined ? Boolean(devoir_a_rendre) : existing.devoir_a_rendre,
        date_remise_devoir: date_remise_devoir ? String(date_remise_devoir) : existing.date_remise_devoir,
        updated_at: new Date(),
      })
      .where(eq(cahierTextesTable.id, id))
      .returning();

    res.json({ message: "Séance modifiée.", seance: await enrichirSeance(updated) });
  }
);

/* ─── DELETE /api/cahier-textes/:id/supprimer ───────────── */
router.delete(
  "/api/cahier-textes/:id/supprimer",
  authMiddleware, verifierLicence,
  async (req, res) => {
    const id = normalizeId(req.params.id);
    const user = req.user!;

    const [existing] = await db
      .select()
      .from(cahierTextesTable)
      .where(eq(cahierTextesTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ message: "Séance introuvable." });
      return;
    }

    const canDelete =
      user.role === "directeur" ||
      user.role === "dev" ||
      (user.role === "professeur" && existing.professeur_id === user.id);

    if (!canDelete) {
      res.status(403).json({ message: "Non autorisé." });
      return;
    }

    await db.delete(cahierTextesTable).where(eq(cahierTextesTable.id, id));
    res.json({ message: "Séance supprimée." });
  }
);

// Unused import suppression
void parentsElevesTable;
void eleveClassesTable;

export default router;
