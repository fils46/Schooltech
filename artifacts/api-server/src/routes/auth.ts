import { Router } from "express";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";
import { db, utilisateursTable, resetTokensTable } from "@workspace/db";
import {
  LoginBody,
  ForgotPasswordBody,
  ResetPasswordBody,
  ChangePasswordBody,
} from "@workspace/api-zod";
import { signToken, signRefreshToken, verifyToken, generateTempPassword } from "../lib/auth";
import { authMiddleware } from "../middlewares/authMiddleware";

const router = Router();

// POST /auth/login
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Email et mot de passe requis." });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(utilisateursTable)
    .where(eq(utilisateursTable.email, email.toLowerCase()));

  if (!user) {
    res.status(401).json({ message: "Identifiants incorrects." });
    return;
  }

  if (!user.actif) {
    res.status(401).json({
      message: "Votre compte a été désactivé. Veuillez contacter l'administration.",
    });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    res.status(401).json({ message: "Identifiants incorrects." });
    return;
  }

  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    etablissement_id: user.etablissement_id ?? null,
    nom: user.nom,
    actif: user.actif,
    premier_login: user.premier_login,
  };

  const token = signToken(payload);
  const refreshToken = signRefreshToken({ id: user.id, email: user.email });

  res.json({
    token,
    refreshToken,
    utilisateur: {
      id: user.id,
      etablissement_id: user.etablissement_id,
      nom: user.nom,
      prenoms: user.prenoms,
      email: user.email,
      telephone: user.telephone,
      role: user.role,
      actif: user.actif,
      premier_login: user.premier_login,
      created_at: user.created_at,
    },
    premierLogin: user.premier_login,
  });
});

// POST /auth/logout
router.post("/auth/logout", authMiddleware, async (_req, res): Promise<void> => {
  res.json({ message: "Déconnexion réussie." });
});

// GET /auth/me
router.get("/auth/me", authMiddleware, async (req, res): Promise<void> => {
  const [user] = await db
    .select()
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, req.user!.id));

  if (!user) {
    res.status(404).json({ message: "Utilisateur introuvable." });
    return;
  }

  res.json({
    id: user.id,
    etablissement_id: user.etablissement_id,
    nom: user.nom,
    prenoms: user.prenoms,
    email: user.email,
    telephone: user.telephone,
    role: user.role,
    actif: user.actif,
    premier_login: user.premier_login,
    created_at: user.created_at,
  });
});

// POST /auth/forgot-password
router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const parsed = ForgotPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Email requis." });
    return;
  }

  const { email } = parsed.data;
  const [user] = await db
    .select()
    .from(utilisateursTable)
    .where(eq(utilisateursTable.email, email.toLowerCase()));

  // Répondre toujours positivement pour éviter l'énumération des comptes
  if (!user) {
    res.json({ message: "Si ce compte existe, un email de réinitialisation a été envoyé." });
    return;
  }

  // Générer un token de reset
  const resetToken = generateTempPassword(32);
  const expireAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

  await db.insert(resetTokensTable).values({
    utilisateur_id: user.id,
    token: resetToken,
    expire_at: expireAt,
  });

  req.log.info({ userId: user.id }, "Reset token généré (envoi email désactivé)");

  res.json({ message: "Si ce compte existe, un email de réinitialisation a été envoyé." });
});

// POST /auth/reset-password
router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const parsed = ResetPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Token et nouveau mot de passe requis (min. 8 caractères)." });
    return;
  }

  const { token, newPassword } = parsed.data;

  const [resetRecord] = await db
    .select()
    .from(resetTokensTable)
    .where(eq(resetTokensTable.token, token));

  if (!resetRecord || resetRecord.used || resetRecord.expire_at < new Date()) {
    res.status(400).json({ message: "Token invalide ou expiré." });
    return;
  }

  const hashed = await bcrypt.hash(newPassword, 10);

  await db
    .update(utilisateursTable)
    .set({ password: hashed, premier_login: false })
    .where(eq(utilisateursTable.id, resetRecord.utilisateur_id));

  await db
    .update(resetTokensTable)
    .set({ used: true })
    .where(eq(resetTokensTable.id, resetRecord.id));

  res.json({ message: "Mot de passe réinitialisé avec succès." });
});

// POST /auth/change-password
router.post("/auth/change-password", authMiddleware, async (req, res): Promise<void> => {
  const parsed = ChangePasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      message: "Ancien et nouveau mot de passe requis (nouveau: min. 8 caractères).",
    });
    return;
  }

  const { ancienPassword, nouveauPassword } = parsed.data;

  const [user] = await db
    .select()
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, req.user!.id));

  if (!user) {
    res.status(404).json({ message: "Utilisateur introuvable." });
    return;
  }

  const match = await bcrypt.compare(ancienPassword, user.password);
  if (!match) {
    res.status(400).json({ message: "L'ancien mot de passe est incorrect." });
    return;
  }

  const hashed = await bcrypt.hash(nouveauPassword, 10);

  await db
    .update(utilisateursTable)
    .set({ password: hashed, premier_login: false })
    .where(eq(utilisateursTable.id, user.id));

  res.json({ message: "Mot de passe changé avec succès." });
});

export default router;
