import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, etablissementsTable } from "@workspace/db";

export async function verifierLicence(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Non authentifié." });
    return;
  }

  // Le rôle dev est toujours autorisé
  if (user.role === "dev") {
    next();
    return;
  }

  // Les utilisateurs sans établissement passent (cas edge)
  if (!user.etablissement_id) {
    next();
    return;
  }

  const [etab] = await db
    .select({ licence_active: etablissementsTable.licence_active })
    .from(etablissementsTable)
    .where(eq(etablissementsTable.id, user.etablissement_id));

  if (!etab || !etab.licence_active) {
    res.status(403).json({
      message:
        "L'accès à votre établissement a été suspendu. Veuillez contacter l'administration M15-SchoolTech.",
    });
    return;
  }

  next();
}
