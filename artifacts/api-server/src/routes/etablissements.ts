import { Router } from "express";
import { eq, count } from "drizzle-orm";
import { db, etablissementsTable, utilisateursTable, licencesTable } from "@workspace/db";
import { CreerEtablissementBody, UpdateEtablissementBody } from "@workspace/api-zod";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";
import { objectStorageService } from "../lib/objectStorage";

const router = Router();

// GET /etablissements
router.get(
  "/etablissements",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;

    if (user.role === "directeur") {
      // Un directeur ne voit que son établissement
      if (!user.etablissement_id) {
        res.json([]);
        return;
      }

      const [etab] = await db
        .select()
        .from(etablissementsTable)
        .where(eq(etablissementsTable.id, user.etablissement_id));

      if (!etab) {
        res.json([]);
        return;
      }

      const [countResult] = await db
        .select({ count: count() })
        .from(utilisateursTable)
        .where(eq(utilisateursTable.etablissement_id, etab.id));

      res.json([{ ...etab, nbUtilisateurs: Number(countResult?.count ?? 0) }]);
      return;
    }

    // dev: tous les établissements avec compte
    const etablissements = await db.select().from(etablissementsTable);

    const withCounts = await Promise.all(
      etablissements.map(async (etab) => {
        const [countResult] = await db
          .select({ count: count() })
          .from(utilisateursTable)
          .where(eq(utilisateursTable.etablissement_id, etab.id));
        return { ...etab, nbUtilisateurs: Number(countResult?.count ?? 0) };
      })
    );

    res.json(withCounts);
  }
);

// POST /etablissements
router.post(
  "/etablissements",
  authMiddleware,
  requireRole("dev"),
  async (req, res): Promise<void> => {
    const parsed = CreerEtablissementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Données invalides : " + parsed.error.message });
      return;
    }

    const [etab] = await db
      .insert(etablissementsTable)
      .values({
        nom: parsed.data.nom,
        type: parsed.data.type ?? null,
        ville: parsed.data.ville ?? null,
        telephone: parsed.data.telephone ?? null,
        email: parsed.data.email ?? null,
        date_expiration_licence: parsed.data.date_expiration_licence ?? null,
      })
      .returning();

    res.status(201).json({ ...etab, nbUtilisateurs: 0 });
  }
);

// GET /etablissements/:id
router.get(
  "/etablissements/:id",
  authMiddleware,
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;

    // Isolation : un non-dev ne peut voir que son propre établissement
    if (user.role !== "dev" && user.etablissement_id !== rawId) {
      res.status(403).json({ message: "Accès refusé." });
      return;
    }

    const [etab] = await db
      .select()
      .from(etablissementsTable)
      .where(eq(etablissementsTable.id, rawId));

    if (!etab) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.etablissement_id, etab.id));

    res.json({ ...etab, nbUtilisateurs: Number(countResult?.count ?? 0) });
  }
);

// PUT /etablissements/:id
router.put(
  "/etablissements/:id",
  authMiddleware,
  requireRole("dev", "directeur"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const user = req.user!;

    if (user.role === "directeur" && user.etablissement_id !== rawId) {
      res.status(403).json({ message: "Vous ne pouvez modifier que votre établissement." });
      return;
    }

    const parsed = UpdateEtablissementBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Données invalides." });
      return;
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.nom !== undefined) updateData.nom = parsed.data.nom;
    if (parsed.data.type !== undefined) updateData.type = parsed.data.type;
    if (parsed.data.ville !== undefined) updateData.ville = parsed.data.ville;
    if (parsed.data.telephone !== undefined) updateData.telephone = parsed.data.telephone;
    if (parsed.data.email !== undefined) updateData.email = parsed.data.email;
    if (parsed.data.licence_active !== undefined) updateData.licence_active = parsed.data.licence_active;
    if (parsed.data.date_expiration_licence !== undefined)
      updateData.date_expiration_licence = parsed.data.date_expiration_licence;

    const [etab] = await db
      .update(etablissementsTable)
      .set(updateData)
      .where(eq(etablissementsTable.id, rawId))
      .returning();

    if (!etab) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    const [countResult] = await db
      .select({ count: count() })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.etablissement_id, etab.id));

    res.json({ ...etab, nbUtilisateurs: Number(countResult?.count ?? 0) });
  }
);

// DELETE /etablissements/:id
router.delete(
  "/etablissements/:id",
  authMiddleware,
  requireRole("dev"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    // Vérifier s'il y a des utilisateurs actifs
    const [activeCount] = await db
      .select({ count: count() })
      .from(utilisateursTable)
      .where(eq(utilisateursTable.etablissement_id, rawId));

    if (Number(activeCount?.count ?? 0) > 0) {
      res.status(400).json({
        message:
          "Impossible de supprimer cet établissement : il possède encore des utilisateurs. Désactivez d'abord la licence et supprimez les comptes.",
      });
      return;
    }

    const [deleted] = await db
      .delete(etablissementsTable)
      .where(eq(etablissementsTable.id, rawId))
      .returning();

    if (!deleted) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    res.json({ message: "Établissement supprimé avec succès." });
  }
);

// PUT /etablissements/:id/activer
router.put(
  "/etablissements/:id/activer",
  authMiddleware,
  requireRole("dev"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [etab] = await db
      .update(etablissementsTable)
      .set({ licence_active: true })
      .where(eq(etablissementsTable.id, rawId))
      .returning();

    if (!etab) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    // Réactivation en cascade de tous les comptes de l'établissement
    await db
      .update(utilisateursTable)
      .set({ actif: true })
      .where(eq(utilisateursTable.etablissement_id, rawId));

    res.json({
      message: "Licence activée et tous les comptes de l'établissement réactivés.",
    });
  }
);

// PUT /etablissements/:id/desactiver
router.put(
  "/etablissements/:id/desactiver",
  authMiddleware,
  requireRole("dev"),
  async (req, res): Promise<void> => {
    const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const [etab] = await db
      .update(etablissementsTable)
      .set({ licence_active: false })
      .where(eq(etablissementsTable.id, rawId))
      .returning();

    if (!etab) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    // Suspension en cascade de tous les comptes de l'établissement
    await db
      .update(utilisateursTable)
      .set({ actif: false })
      .where(eq(utilisateursTable.etablissement_id, rawId));

    res.json({
      message: "Établissement désactivé et tous ses comptes suspendus.",
    });
  }
);

// GET /etablissement/moi
router.get(
  "/etablissement/moi",
  authMiddleware,
  verifierLicence,
  requireRole("directeur", "censeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!user.etablissement_id) {
      res.status(404).json({ message: "Aucun établissement associé à ce compte." });
      return;
    }

    const [etab] = await db
      .select()
      .from(etablissementsTable)
      .where(eq(etablissementsTable.id, user.etablissement_id));

    if (!etab) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    const [licence] = await db
      .select()
      .from(licencesTable)
      .where(eq(licencesTable.etablissement_id, user.etablissement_id));

    res.json({
      id: etab.id,
      nom: etab.nom,
      type: etab.type,
      ville: etab.ville,
      telephone: etab.telephone,
      email: etab.email,
      adresse: etab.adresse,
      logo_url: etab.logo_url,
      cachet_url: etab.cachet_url,
      signature_directeur_url: etab.signature_directeur_url,
      email_contact: etab.email_contact,
      bp: etab.bp,
      site_web: etab.site_web,
      devise: etab.devise,
      licence_active: etab.licence_active,
      date_expiration_licence: etab.date_expiration_licence,
      licence: licence
        ? {
            id: licence.id,
            type: licence.type,
            date_debut: licence.date_debut,
            date_expiration: licence.date_expiration,
            actif: licence.actif,
            montant: licence.montant,
            renouvellement_auto: licence.renouvellement_auto,
          }
        : null,
    });
  }
);

// PUT /etablissement/moi
router.put(
  "/etablissement/moi",
  authMiddleware,
  verifierLicence,
  requireRole("directeur"),
  async (req, res): Promise<void> => {
    const user = req.user!;
    if (!user.etablissement_id) {
      res.status(404).json({ message: "Aucun établissement associé à ce compte." });
      return;
    }

    const { nom, ville, telephone, email, adresse, email_contact, bp, site_web, devise } = req.body as {
      nom?: string;
      ville?: string | null;
      telephone?: string | null;
      email?: string | null;
      adresse?: string | null;
      email_contact?: string | null;
      bp?: string | null;
      site_web?: string | null;
      devise?: string | null;
    };

    const updates: Record<string, unknown> = {};
    if (nom !== undefined) updates.nom = nom;
    if (ville !== undefined) updates.ville = ville;
    if (telephone !== undefined) updates.telephone = telephone;
    if (email !== undefined) updates.email = email;
    if (adresse !== undefined) updates.adresse = adresse;
    if (email_contact !== undefined) updates.email_contact = email_contact;
    if (bp !== undefined) updates.bp = bp;
    if (site_web !== undefined) updates.site_web = site_web;
    if (devise !== undefined) updates.devise = devise;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ message: "Aucun champ à mettre à jour." });
      return;
    }

    const [updated] = await db
      .update(etablissementsTable)
      .set(updates)
      .where(eq(etablissementsTable.id, user.etablissement_id))
      .returning();

    if (!updated) {
      res.status(404).json({ message: "Établissement introuvable." });
      return;
    }

    const [licence] = await db
      .select()
      .from(licencesTable)
      .where(eq(licencesTable.etablissement_id, user.etablissement_id));

    req.log.info({ etabId: updated.id }, "Établissement mis à jour");

    res.json({
      id: updated.id,
      nom: updated.nom,
      type: updated.type,
      ville: updated.ville,
      telephone: updated.telephone,
      email: updated.email,
      adresse: updated.adresse,
      logo_url: updated.logo_url,
      cachet_url: updated.cachet_url,
      signature_directeur_url: updated.signature_directeur_url,
      email_contact: updated.email_contact,
      bp: updated.bp,
      site_web: updated.site_web,
      devise: updated.devise,
      licence_active: updated.licence_active,
      date_expiration_licence: updated.date_expiration_licence,
      licence: licence
        ? {
            id: licence.id,
            type: licence.type,
            date_debut: licence.date_debut,
            date_expiration: licence.date_expiration,
            actif: licence.actif,
            montant: licence.montant,
            renouvellement_auto: licence.renouvellement_auto,
          }
        : null,
    });
  }
);

/* ────────────────────────────────────────────────────────────
   Helpers upload identité visuelle
   ──────────────────────────────────────────────────────────── */

type AssetField = "logo" | "cachet" | "signature";

const ASSET_FIELDS: Record<AssetField, { url: string; path: string }> = {
  logo:      { url: "logo_url",                   path: "logo_path" },
  cachet:    { url: "cachet_url",                 path: "cachet_path" },
  signature: { url: "signature_directeur_url",    path: "signature_directeur_path" },
};

function assetFields(asset: AssetField) {
  return ASSET_FIELDS[asset];
}

function buildServingUrl(objectPath: string): string {
  return `/api/storage/objects${objectPath}`;
}

async function deleteAssetFromStorage(objectPath: string): Promise<void> {
  try {
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    await file.delete();
  } catch {
    // Fichier déjà supprimé ou inexistant — OK
  }
}

/* ── POST /etablissement/:asset  (logo | cachet | signature) ── */
for (const asset of ["logo", "cachet", "signature"] as AssetField[]) {
  router.post(
    `/etablissement/${asset}`,
    authMiddleware,
    verifierLicence,
    requireRole("directeur"),
    async (req, res): Promise<void> => {
      const user = req.user!;
      if (!user.etablissement_id) {
        res.status(404).json({ message: "Aucun établissement associé." });
        return;
      }

      const { objectPath } = req.body as { objectPath?: string };
      if (!objectPath || typeof objectPath !== "string") {
        res.status(400).json({ message: "objectPath requis." });
        return;
      }

      const fields = assetFields(asset);

      // Supprimer l'ancien fichier si existant
      const [current] = await db.select().from(etablissementsTable)
        .where(eq(etablissementsTable.id, user.etablissement_id)).limit(1);

      if (current?.[fields.path as keyof typeof current]) {
        await deleteAssetFromStorage(current[fields.path as keyof typeof current] as string);
      }

      const servingUrl = buildServingUrl(objectPath);

      await db.update(etablissementsTable)
        .set({
          [fields.url]: servingUrl,
          [fields.path]: objectPath,
          updated_at: new Date(),
        })
        .where(eq(etablissementsTable.id, user.etablissement_id));

      req.log.info({ etabId: user.etablissement_id, asset }, `${asset} mis à jour`);
      res.json({ [fields.url]: servingUrl, [fields.path]: objectPath });
    }
  );
}

/* ── DELETE /etablissement/:asset  (logo | cachet | signature) ── */
for (const asset of ["logo", "cachet", "signature"] as AssetField[]) {
  router.delete(
    `/etablissement/${asset}`,
    authMiddleware,
    verifierLicence,
    requireRole("directeur"),
    async (req, res): Promise<void> => {
      const user = req.user!;
      if (!user.etablissement_id) {
        res.status(404).json({ message: "Aucun établissement associé." });
        return;
      }

      const fields = assetFields(asset);

      const [current] = await db.select().from(etablissementsTable)
        .where(eq(etablissementsTable.id, user.etablissement_id)).limit(1);

      if (!current) {
        res.status(404).json({ message: "Établissement introuvable." });
        return;
      }

      const currentPath = current[fields.path as keyof typeof current] as string | null;
      if (currentPath) {
        await deleteAssetFromStorage(currentPath);
      }

      await db.update(etablissementsTable)
        .set({
          [fields.url]: null,
          [fields.path]: null,
          updated_at: new Date(),
        })
        .where(eq(etablissementsTable.id, user.etablissement_id));

      req.log.info({ etabId: user.etablissement_id, asset }, `${asset} supprimé`);
      res.json({ message: `${asset} supprimé.` });
    }
  );
}

export default router;
