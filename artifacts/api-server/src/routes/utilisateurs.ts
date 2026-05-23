import { Router } from "express";
import bcrypt from "bcrypt";
import { eq, and } from "drizzle-orm";
import { db, utilisateursTable } from "@workspace/db";
import { CreerUtilisateurBody } from "@workspace/api-zod";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { generateTempPassword } from "../lib/auth";

const router = Router();

// Rôles qui peuvent créer des utilisateurs
// Dev ne crée que les directeurs ; c'est le directeur qui crée les membres de son école.
const CREATION_PERMISSIONS: Record<string, string[]> = {
  dev: ["directeur"],
  directeur: ["censeur", "professeur", "eleve", "parent"],
  censeur: ["professeur", "eleve", "parent"],
};

// POST /utilisateurs/creer
router.post(
  "/utilisateurs/creer",
  authMiddleware,
  verifierLicence,
  async (req, res): Promise<void> => {
    const parsed = CreerUtilisateurBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Données invalides : " + parsed.error.message });
      return;
    }

    const { nom, prenoms, email, telephone, role, etablissement_id } = parsed.data;
    const createur = req.user!;

    // Vérifier les permissions de création
    const rolesAutorisés = CREATION_PERMISSIONS[createur.role] ?? [];
    if (!rolesAutorisés.includes(role)) {
      res.status(403).json({
        message: `Le rôle '${createur.role}' ne peut pas créer un utilisateur de rôle '${role}'.`,
      });
      return;
    }

    // Déterminer l'établissement
    const etabId =
      createur.role === "dev"
        ? (etablissement_id ?? null)
        : createur.etablissement_id;

    // Vérifier unicité de l'email
    const [existing] = await db
      .select()
      .from(utilisateursTable)
      .where(eq(utilisateursTable.email, email.toLowerCase()));

    if (existing) {
      res.status(400).json({ message: "Un utilisateur avec cet email existe déjà." });
      return;
    }

    // Générer mot de passe temporaire
    const passwordTemporaire = generateTempPassword(10);
    const hashedPassword = await bcrypt.hash(passwordTemporaire, 10);

    const [newUser] = await db
      .insert(utilisateursTable)
      .values({
        nom,
        prenoms: prenoms ?? null,
        email: email.toLowerCase(),
        telephone: telephone ?? null,
        password: hashedPassword,
        role,
        etablissement_id: etabId ?? null,
        actif: true,
        premier_login: true,
      })
      .returning();

    req.log.info({ userId: newUser.id, role }, "Nouvel utilisateur créé");

    res.status(201).json({
      utilisateur: {
        id: newUser.id,
        etablissement_id: newUser.etablissement_id,
        nom: newUser.nom,
        prenoms: newUser.prenoms,
        email: newUser.email,
        telephone: newUser.telephone,
        role: newUser.role,
        actif: newUser.actif,
        premier_login: newUser.premier_login,
        created_at: newUser.created_at,
      },
      passwordTemporaire,
    });
  }
);

// GET /utilisateurs/liste
router.get(
  "/utilisateurs/liste",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const { role: filterRole, actif, etablissement_id } = req.query as Record<string, string>;
    const user = req.user!;

    let query = db.select().from(utilisateursTable);

    // Isolation par établissement (sauf dev)
    const conditions = [];
    if (user.role !== "dev") {
      if (user.etablissement_id) {
        conditions.push(eq(utilisateursTable.etablissement_id, user.etablissement_id));
      }
    } else if (etablissement_id) {
      conditions.push(eq(utilisateursTable.etablissement_id, etablissement_id));
    }

    if (filterRole) {
      conditions.push(eq(utilisateursTable.role, filterRole));
    }

    if (actif !== undefined) {
      conditions.push(eq(utilisateursTable.actif, actif === "true"));
    }

    const utilisateurs =
      conditions.length > 0
        ? await query.where(and(...conditions))
        : await query;

    res.json(
      utilisateurs.map((u) => ({
        id: u.id,
        etablissement_id: u.etablissement_id,
        nom: u.nom,
        prenoms: u.prenoms,
        email: u.email,
        telephone: u.telephone,
        role: u.role,
        actif: u.actif,
        premier_login: u.premier_login,
        created_at: u.created_at,
      }))
    );
  }
);

// PUT /utilisateurs/:id/activer
router.put(
  "/utilisateurs/:id/activer",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [user] = await db
      .update(utilisateursTable)
      .set({ actif: true })
      .where(eq(utilisateursTable.id, rawId))
      .returning();

    if (!user) {
      res.status(404).json({ message: "Utilisateur introuvable." });
      return;
    }

    res.json({ message: "Compte activé avec succès." });
  }
);

// PUT /utilisateurs/:id/desactiver
router.put(
  "/utilisateurs/:id/desactiver",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [user] = await db
      .update(utilisateursTable)
      .set({ actif: false })
      .where(eq(utilisateursTable.id, rawId))
      .returning();

    if (!user) {
      res.status(404).json({ message: "Utilisateur introuvable." });
      return;
    }

    res.json({ message: "Compte désactivé avec succès." });
  }
);

export default router;
