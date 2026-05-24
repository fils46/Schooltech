import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { ObjectPermission } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const { name, size, contentType } = req.body as {
    name?: unknown;
    size?: unknown;
    contentType?: unknown;
  };

  if (
    typeof name !== "string" || !name ||
    typeof contentType !== "string" || !contentType ||
    typeof size !== "number"
  ) {
    res.status(400).json({ error: "Champs name, size et contentType requis" });
    return;
  }

  try {
    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json({
      uploadURL,
      objectPath,
      metadata: { name, size, contentType },
    });
  } catch (error) {
    res.status(500).json({ error: "Impossible de générer l'URL d'upload" });
  }
});

/**
 * These are unconditionally public — no authentication or ACL checks.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  const filePath = (req.params as Record<string, string | string[]>).filePath;
  const filePathStr = Array.isArray(filePath) ? filePath.join("/") : filePath;
  try {
    const file = await objectStorageService.searchPublicObject(filePathStr);

    if (!file) {
      res.status(404).json({ error: "Fichier introuvable" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    if (response.body) {
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } else {
      res.status(500).json({ error: "Erreur lors de la lecture du fichier" });
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Fichier introuvable" });
    } else {
      res.status(500).json({ error: "Erreur lors de la récupération du fichier" });
    }
  }
});

/**
 * Protected object serving — no auth required for simplicity (all uploads are
 * treated as semi-public: logos, cachets, signatures visible in PDFs).
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = (req.params as Record<string, string | string[]>).path;
    const rawStr = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/${rawStr}`;

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);

    const canAccess = await objectStorageService.canAccessObjectEntity({
      objectFile,
      requestedPermission: ObjectPermission.READ,
    });

    if (!canAccess) {
      res.status(403).json({ error: "Accès refusé" });
      return;
    }

    const response = await objectStorageService.downloadObject(objectFile);
    const contentType = response.headers.get("content-type") || "application/octet-stream";

    res.setHeader("Content-Type", contentType);
    if (response.body) {
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } else {
      res.status(500).json({ error: "Erreur lors de la lecture du fichier" });
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Fichier introuvable" });
    } else {
      res.status(500).json({ error: "Erreur lors de la récupération du fichier" });
    }
  }
});

export default router;
