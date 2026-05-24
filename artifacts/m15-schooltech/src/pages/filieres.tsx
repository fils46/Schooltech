import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useListerFilieres, getListerFilieresQueryKey,
  useCreerFiliere, useModifierFiliere, useDesactiverFiliere,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, Plus, Pencil, Power, CheckCircle, XCircle } from "lucide-react";

const TYPE_OPTIONS = [
  { value: "lycee",   label: "Lycée" },
  { value: "college", label: "Collège" },
  { value: "mixte",   label: "Mixte" },
];

const TYPE_LABELS: Record<string, string> = {
  lycee: "Lycée", college: "Collège", mixte: "Mixte",
};
const TYPE_COLORS: Record<string, string> = {
  lycee: "#F5C842", college: "#0080FF", mixte: "#A78BFA",
};

/* ─── Modal Filière ───────────────────────────────────────── */
function ModalFiliere({
  initial, onClose, etablissementId, isDevRole,
}: {
  initial?: { id: string; nom: string; code: string; description?: string | null; type_etablissement?: string | null };
  onClose: () => void;
  etablissementId: string | null;
  isDevRole: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const creerMut   = useCreerFiliere();
  const modifMut   = useModifierFiliere();

  const [nom, setNom]       = useState(initial?.nom ?? "");
  const [code, setCode]     = useState(initial?.code ?? "");
  const [desc, setDesc]     = useState(initial?.description ?? "");
  const [type, setType]     = useState(initial?.type_etablissement ?? "lycee");
  const [etabId, setEtabId] = useState(etablissementId ?? "");

  const isEdit = !!initial;

  const submit = async () => {
    if (!nom.trim() || !code.trim()) {
      toast({ title: "Champs requis", description: "Nom et code sont obligatoires.", variant: "destructive" }); return;
    }
    try {
      const payload = {
        nom: nom.trim(),
        code: code.trim().toUpperCase(),
        description: desc || undefined,
        type_etablissement: type,
        ...(isDevRole && !isEdit ? { etablissement_id: etabId } : {}),
      };

      if (isEdit && initial) {
        await modifMut.mutateAsync({ id: initial.id, data: payload });
        toast({ title: "Filière modifiée" });
      } else {
        await creerMut.mutateAsync({ data: payload });
        toast({ title: "Filière créée", description: `Filière ${nom} ajoutée.` });
      }
      await qc.invalidateQueries({ queryKey: getListerFilieresQueryKey() });
      onClose();
    } catch {
      toast({ title: "Erreur", description: "Opération impossible.", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,200,66,0.15)" }}>
            <BookOpen className="w-5 h-5" style={{ color: "#F5C842" }} />
          </div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            {isEdit ? "Modifier la filière" : "Nouvelle filière"}
          </h2>
        </div>

        <div className="space-y-4">
          {isDevRole && !isEdit && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>
                Établissement ID
              </label>
              <input value={etabId} onChange={e => setEtabId(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Nom *</label>
              <input value={nom} onChange={e => setNom(e.target.value)} placeholder="ex : Série D"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Code *</label>
              <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="ex : D"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Type d'établissement</label>
            <select value={type} onChange={e => setType(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              {TYPE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Description</label>
            <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={2}
              placeholder="Description optionnelle..."
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none resize-none"
              style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={creerMut.isPending || modifMut.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#F5C842", color: "var(--m15-navy)" }}>
            {creerMut.isPending || modifMut.isPending ? "..." : isEdit ? "Modifier" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page principale ─────────────────────────────────────── */
export default function Filieres() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal]                       = useState(false);
  const [editFiliere, setEditFiliere]                   = useState<null | {
    id: string; nom: string; code: string; description?: string | null; type_etablissement?: string | null;
  }>(null);
  const [confirmDesactiver, setConfirmDesactiver]       = useState<string | null>(null);

  const { data, isLoading } = useListerFilieres({
    query: { queryKey: getListerFilieresQueryKey() },
  });

  const desactiverMut = useDesactiverFiliere();

  const handleDesactiver = async (id: string) => {
    try {
      await desactiverMut.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: getListerFilieresQueryKey() });
      toast({ title: "Filière désactivée" });
      setConfirmDesactiver(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur.";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  const filieres = data?.filieres ?? [];
  const isDevRole = user?.role === "dev";
  const canEdit = user?.role === "dev" || user?.role === "directeur";

  return (
    <div className="space-y-6 page-fade-in">

      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Filières
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Gérez les filières et séries de votre établissement.
          </p>
        </div>
        {canEdit && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#F5C842", color: "var(--m15-navy)" }}>
            <Plus className="w-4 h-4" />
            Nouvelle filière
          </button>
        )}
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {["lycee", "college", "mixte"].map((type) => {
          const cnt = filieres.filter(f => f.type_etablissement === type).length;
          const color = TYPE_COLORS[type];
          return (
            <div key={type} className="rounded-2xl p-4 flex flex-col gap-2"
              style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", borderTop: `3px solid ${color}` }}>
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>
                {TYPE_LABELS[type]}
              </span>
              <span className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>
                {isLoading ? "—" : cnt}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Grille des filières ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--m15-card)" }} />
          ))}
        </div>
      ) : filieres.length === 0 ? (
        <div className="rounded-2xl py-16 text-center"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: "var(--m15-muted)" }} />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--m15-white)" }}>Aucune filière créée</p>
          <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Créez vos filières (Série D, A, G2, etc.)</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filieres.map((filiere) => {
            const color = TYPE_COLORS[filiere.type_etablissement ?? "lycee"] ?? "#F5C842";
            return (
              <div key={filiere.id}
                className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-150"
                style={{
                  background: "var(--m15-card)",
                  border: "1px solid var(--m15-border)",
                  borderTop: `3px solid ${filiere.actif ? color : "#8B9DC3"}`,
                  opacity: filiere.actif ? 1 : 0.65,
                }}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: filiere.actif ? color : "#8B9DC3" }}>
                        {filiere.code}
                      </span>
                      {!filiere.actif && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(139,157,195,0.15)", color: "var(--m15-muted)" }}>
                          Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>{filiere.nom}</p>
                    {filiere.type_etablissement && (
                      <p className="text-xs mt-0.5" style={{ color }}>{TYPE_LABELS[filiere.type_etablissement]}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => setEditFiliere(filiere)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                        style={{ background: "var(--m15-card2)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,201,167,0.15)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--m15-card2)"; }}>
                        <Pencil className="w-3.5 h-3.5" style={{ color: "#00C9A7" }} />
                      </button>
                      {filiere.actif && (
                        <button onClick={() => setConfirmDesactiver(filiere.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                          style={{ background: "var(--m15-card2)" }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,77,109,0.15)"; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "var(--m15-card2)"; }}>
                          <Power className="w-3.5 h-3.5" style={{ color: "#FF4D6D" }} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {filiere.description && (
                  <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{filiere.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {(showModal || editFiliere) && (
        <ModalFiliere
          initial={editFiliere ?? undefined}
          onClose={() => { setShowModal(false); setEditFiliere(null); }}
          etablissementId={user?.etablissement_id ?? null}
          isDevRole={isDevRole}
        />
      )}

      {confirmDesactiver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) setConfirmDesactiver(null); }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "var(--m15-card)", border: "1px solid rgba(255,77,109,0.3)" }}>
            <div className="flex items-center gap-3">
              <XCircle className="w-8 h-8" style={{ color: "#FF4D6D" }} />
              <div>
                <p className="font-bold" style={{ color: "var(--m15-white)" }}>Désactiver la filière ?</p>
                <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                  Les classes existantes ne seront pas supprimées.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDesactiver(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--m15-card2)", color: "var(--m15-muted)" }}>
                Annuler
              </button>
              <button onClick={() => handleDesactiver(confirmDesactiver)}
                disabled={desactiverMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "#FF4D6D", color: "#fff" }}>
                {desactiverMut.isPending ? "..." : "Désactiver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
