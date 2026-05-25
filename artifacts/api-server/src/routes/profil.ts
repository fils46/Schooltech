import { Router } from "express";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db, utilisateursTable, etablissementsTable } from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

const DEFAULT_PREFS = {
  email_absences: true,
  email_notes: true,
  email_messages: true,
  email_annonces: false,
  push_absences: true,
  push_notes: true,
  push_messages: true,
  push_annonces: true,
};

/* ─── GET /api/profil ────────────────────────────────────────── */
router.get("/profil", authMiddleware, async (req, res) => {
  try {
    const [row] = await db
      .select({
        id: utilisateursTable.id,
        nom: utilisateursTable.nom,
        prenoms: utilisateursTable.prenoms,
        email: utilisateursTable.email,
        telephone: utilisateursTable.telephone,
        role: utilisateursTable.role,
        actif: utilisateursTable.actif,
        premier_login: utilisateursTable.premier_login,
        photo_url: utilisateursTable.photo_url,
        preferences_notifs: utilisateursTable.preferences_notifs,
        created_at: utilisateursTable.created_at,
        etablissement_id: utilisateursTable.etablissement_id,
        etablissement_nom: etablissementsTable.nom,
      })
      .from(utilisateursTable)
      .leftJoin(etablissementsTable, eq(etablissementsTable.id, utilisateursTable.etablissement_id))
      .where(eq(utilisateursTable.id, req.user!.id))
      .limit(1);

    if (!row) { res.status(404).json({ message: "Utilisateur introuvable" }); return; }

    res.json({
      ...row,
      preferences_notifs: (row.preferences_notifs as Record<string, boolean>) ?? DEFAULT_PREFS,
      etablissement: row.etablissement_nom
        ? { id: row.etablissement_id, nom: row.etablissement_nom }
        : null,
    });
  } catch (err) {
    req.log.error(err, "Erreur profil");
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ─── PUT /api/profil ────────────────────────────────────────── */
router.put("/profil", authMiddleware, async (req, res) => {
  const { nom, prenoms, telephone, email } = req.body as {
    nom?: string; prenoms?: string; telephone?: string; email?: string;
  };

  try {
    const updates: Record<string, unknown> = {};
    if (nom !== undefined) updates.nom = nom.trim();
    if (prenoms !== undefined) updates.prenoms = prenoms.trim();
    if (telephone !== undefined) updates.telephone = telephone.trim() || null;
    if (email !== undefined) {
      const emailTrimmed = email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
        res.status(400).json({ message: "Adresse email invalide" }); return;
      }
      updates.email = emailTrimmed;
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "Aucune donnée à modifier" }); return;
    }

    await db.update(utilisateursTable).set(updates).where(eq(utilisateursTable.id, req.user!.id));

    const [updated] = await db
      .select({
        id: utilisateursTable.id,
        nom: utilisateursTable.nom,
        prenoms: utilisateursTable.prenoms,
        email: utilisateursTable.email,
        telephone: utilisateursTable.telephone,
        role: utilisateursTable.role,
        photo_url: utilisateursTable.photo_url,
        preferences_notifs: utilisateursTable.preferences_notifs,
      })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.id, req.user!.id))
      .limit(1);

    res.json({ ...updated, message: "Profil mis à jour" });
  } catch (err) {
    req.log.error(err, "Erreur modifier profil");
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ─── POST /api/profil/photo ─────────────────────────────────── */
router.post("/profil/photo", authMiddleware, async (req, res) => {
  const { photo_base64 } = req.body as { photo_base64?: string };

  if (!photo_base64) {
    res.status(400).json({ message: "photo_base64 requis" }); return;
  }

  const isValidBase64Image = /^data:image\/(png|jpeg|jpg|webp);base64,/.test(photo_base64);
  if (!isValidBase64Image) {
    res.status(400).json({ message: "Format invalide. Utilisez une image base64 (PNG/JPG/WebP)." }); return;
  }

  const approxSizeKb = Math.ceil((photo_base64.length * 3) / 4 / 1024);
  if (approxSizeKb > 3072) {
    res.status(400).json({ message: "Image trop grande. Maximum 3 Mo." }); return;
  }

  try {
    await db.update(utilisateursTable).set({ photo_url: photo_base64 }).where(eq(utilisateursTable.id, req.user!.id));
    res.json({ photo_url: photo_base64, message: "Photo mise à jour" });
  } catch (err) {
    req.log.error(err, "Erreur upload photo");
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ─── PUT /api/profil/mot-de-passe ──────────────────────────── */
router.put("/profil/mot-de-passe", authMiddleware, async (req, res) => {
  const { mot_de_passe_actuel, nouveau_mot_de_passe, confirmation } = req.body as {
    mot_de_passe_actuel?: string;
    nouveau_mot_de_passe?: string;
    confirmation?: string;
  };

  if (!mot_de_passe_actuel || !nouveau_mot_de_passe || !confirmation) {
    res.status(400).json({ message: "Tous les champs sont requis" }); return;
  }
  if (nouveau_mot_de_passe !== confirmation) {
    res.status(400).json({ message: "Les mots de passe ne correspondent pas" }); return;
  }
  const mdpRegex = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
  if (!mdpRegex.test(nouveau_mot_de_passe)) {
    res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères, 1 majuscule et 1 chiffre" }); return;
  }

  try {
    const [user] = await db
      .select({ password: utilisateursTable.password })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.id, req.user!.id))
      .limit(1);

    if (!user) { res.status(404).json({ message: "Utilisateur introuvable" }); return; }

    const valid = await bcrypt.compare(mot_de_passe_actuel, user.password);
    if (!valid) { res.status(401).json({ message: "Mot de passe actuel incorrect" }); return; }

    const hashed = await bcrypt.hash(nouveau_mot_de_passe, 12);
    await db.update(utilisateursTable).set({ password: hashed, premier_login: false }).where(eq(utilisateursTable.id, req.user!.id));

    res.json({ success: true, message: "Mot de passe changé avec succès" });
  } catch (err) {
    req.log.error(err, "Erreur changement mot de passe");
    res.status(500).json({ message: "Erreur serveur" });
  }
});

/* ─── PUT /api/profil/preferences-notifs ────────────────────── */
router.put("/profil/preferences-notifs", authMiddleware, async (req, res) => {
  const { preferences_notifs } = req.body as { preferences_notifs?: Record<string, boolean> };

  if (!preferences_notifs || typeof preferences_notifs !== "object") {
    res.status(400).json({ message: "preferences_notifs requis" }); return;
  }

  const ALLOWED_KEYS = [
    "email_absences", "email_notes", "email_messages", "email_annonces",
    "push_absences", "push_notes", "push_messages", "push_annonces",
  ];
  const sanitized: Record<string, boolean> = {};
  for (const key of ALLOWED_KEYS) {
    if (key in preferences_notifs) sanitized[key] = Boolean(preferences_notifs[key]);
  }

  try {
    await db.update(utilisateursTable).set({ preferences_notifs: sanitized }).where(eq(utilisateursTable.id, req.user!.id));
    res.json({ preferences_notifs: sanitized, message: "Préférences mises à jour" });
  } catch (err) {
    req.log.error(err, "Erreur préférences notifs");
    res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;
