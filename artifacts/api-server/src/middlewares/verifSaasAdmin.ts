import { Request, Response, NextFunction } from "express";

export function verifSaasAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = req.user;

  if (!user) {
    res.status(401).json({ success: false, message: "Non authentifié." });
    return;
  }

  if (user.role !== "dev") {
    res.status(403).json({
      success: false,
      message: "Accès réservé à l'administration SaaS.",
    });
    return;
  }

  next();
}
