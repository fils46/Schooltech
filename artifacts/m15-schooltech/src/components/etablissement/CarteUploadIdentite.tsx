import { useRef, useState } from "react";
import { Upload, Trash2, Loader2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL ?? "/";
const API_BASE = `${BASE}api`.replace(/\/+/g, "/").replace(/\/$/, "");

interface CarteUploadIdentiteProps {
  label: string;
  description: string;
  currentUrl?: string | null;
  onUpdated: () => void;
  endpoint: "logo" | "cachet" | "signature";
  token: string | null;
}

export function CarteUploadIdentite({
  label,
  description,
  currentUrl,
  onUpdated,
  endpoint,
  token,
}: CarteUploadIdentiteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Veuillez sélectionner une image (PNG, JPG, SVG, WebP).");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError("La taille maximale est de 3 Mo.");
      return;
    }

    setUploading(true);
    try {
      const urlRes = await fetch(`${API_BASE}/storage/uploads/request-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      if (!urlRes.ok) {
        const msg = await urlRes.text();
        throw new Error(msg || "Impossible d'obtenir l'URL d'upload.");
      }

      const { uploadURL, objectPath } = (await urlRes.json()) as {
        uploadURL: string;
        objectPath: string;
      };

      const uploadRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error("Échec de l'envoi vers le stockage.");
      }

      const saveRes = await fetch(`${API_BASE}/etablissement/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ objectPath }),
      });

      if (!saveRes.ok) {
        const msg = await saveRes.text();
        throw new Error(msg || "Impossible d'enregistrer le fichier.");
      }

      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`${API_BASE}/etablissement/${endpoint}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Impossible de supprimer le fichier.");
      }
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--m15-bg)", border: "1px solid var(--m15-border)" }}
    >
      <div>
        <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
          {label}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>
          {description}
        </p>
      </div>

      <div
        className="rounded-lg flex items-center justify-center overflow-hidden"
        style={{
          height: 96,
          background: "var(--m15-card)",
          border: "1px dashed var(--m15-border)",
        }}
      >
        {currentUrl ? (
          <img
            src={currentUrl}
            alt={label}
            className="max-h-full max-w-full object-contain"
            style={{ padding: 8 }}
          />
        ) : (
          <ImageIcon className="w-8 h-8" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
        )}
      </div>

      {error && (
        <p className="text-xs" style={{ color: "#FF4D6D" }}>
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 flex-1 text-xs"
          style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Upload className="w-3.5 h-3.5" />
          )}
          {uploading ? "Envoi…" : "Choisir"}
        </Button>
        {currentUrl && (
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            style={{ borderColor: "rgba(255,77,109,0.4)", color: "#FF4D6D" }}
            disabled={deleting}
            onClick={handleDelete}
          >
            {deleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
