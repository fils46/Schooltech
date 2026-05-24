import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useListerMatieres, getListerMatieresQueryKey,
  useCreerMatiere, useModifierMatiere, useDesactiverMatiere,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  BookMarked, Plus, Search, Eye, EyeOff, Pencil,
  AlertTriangle, CheckCircle,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────── */
type Matiere = {
  id: string; nom: string; code: string;
  couleur?: string | null; actif: boolean;
};

/* ─── Couleurs prédéfinies ────────────────────────────────── */
const COULEURS = [
  "#00C9A7", "#00A3FF", "#F5C842", "#FF6B6B",
  "#A78BFA", "#34D399", "#FB923C", "#60A5FA",
  "#F472B6", "#4ADE80",
];

/* ─── Modal Matière ───────────────────────────────────────── */
function ModalMatiere({
  matiere, etablissementId, isDevRole, onClose,
}: {
  matiere?: Matiere;
  etablissementId: string | null;
  isDevRole: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const creerMut    = useCreerMatiere();
  const modifierMut = useModifierMatiere();

  const [nom,     setNom]     = useState(matiere?.nom ?? "");
  const [code,    setCode]    = useState(matiere?.code ?? "");
  const [couleur, setCouleur] = useState(matiere?.couleur ?? COULEURS[0]);
  const [etabId,  setEtabId]  = useState(etablissementId ?? "");

  const isEdit = !!matiere;

  const submit = async () => {
    if (!nom.trim() || !code.trim()) {
      toast({ title: "Nom et code requis", variant: "destructive" }); return;
    }
    try {
      if (isEdit) {
        await modifierMut.mutateAsync({ id: matiere.id, data: { nom: nom.trim(), code: code.trim(), couleur } });
      } else {
        await creerMut.mutateAsync({
          data: { nom: nom.trim(), code: code.trim(), couleur,
            ...(isDevRole ? { etablissement_id: etabId } : {}) },
        });
      }
      await qc.invalidateQueries({ queryKey: getListerMatieresQueryKey() });
      toast({ title: isEdit ? "Matière modifiée" : "Matière créée" });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: "Erreur", description: msg ?? "Opération impossible.", variant: "destructive" });
    }
  };

  const iStyle = { background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" };
  const lStyle = { color: "var(--m15-muted)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${couleur}22` }}>
            <BookMarked className="w-5 h-5" style={{ color: couleur }} />
          </div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            {isEdit ? "Modifier la matière" : "Nouvelle matière"}
          </h2>
        </div>

        <div className="space-y-4">
          {isDevRole && !isEdit && (
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={lStyle}>
                Établissement ID
              </label>
              <input value={etabId} onChange={e => setEtabId(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={iStyle} />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={lStyle}>
              Nom de la matière *
            </label>
            <input value={nom} onChange={e => setNom(e.target.value)}
              placeholder="ex: Mathématiques" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={iStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={lStyle}>
              Code * (abréviation)
            </label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ex: MATHS" maxLength={10}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none font-mono" style={iStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={lStyle}>
              Couleur
            </label>
            <div className="flex flex-wrap gap-2">
              {COULEURS.map(c => (
                <button key={c} onClick={() => setCouleur(c)}
                  className="w-7 h-7 rounded-lg transition-all"
                  style={{
                    background: c,
                    outline: couleur === c ? `2px solid ${c}` : "none",
                    outlineOffset: "2px",
                    transform: couleur === c ? "scale(1.15)" : "scale(1)",
                  }} />
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={creerMut.isPending || modifierMut.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#00C9A7,#00A3FF)", color: "#fff" }}>
            {creerMut.isPending || modifierMut.isPending ? "Enregistrement…" : isEdit ? "Modifier" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Carte Matière ───────────────────────────────────────── */
function CarteMatiere({
  matiere, canManage, onEdit, onRefresh,
}: { matiere: Matiere; canManage: boolean; onEdit: (m: Matiere) => void; onRefresh: () => void }) {
  const { toast } = useToast();
  const desactiverMut = useDesactiverMatiere();

  const desactiver = async () => {
    if (!confirm(`Désactiver la matière "${matiere.nom}" ?`)) return;
    try {
      await desactiverMut.mutateAsync({ id: matiere.id });
      toast({ title: "Matière désactivée" });
      onRefresh();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const couleur = matiere.couleur ?? "#8B9DC3";

  return (
    <div className="rounded-xl p-4 flex items-center gap-4 transition-all"
      style={{
        background: "var(--m15-card)",
        border: `1px solid ${matiere.actif ? "var(--m15-border)" : "rgba(255,107,107,0.2)"}`,
        opacity: matiere.actif ? 1 : 0.6,
      }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${couleur}22` }}>
        <span className="text-xs font-black" style={{ color: couleur }}>
          {matiere.code.slice(0, 3)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold truncate" style={{ color: "var(--m15-white)" }}>{matiere.nom}</p>
          {!matiere.actif && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,107,107,0.12)", color: "#FF6B6B" }}>
              Désactivée
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5 font-mono" style={{ color: "var(--m15-muted)" }}>{matiere.code}</p>
      </div>
      {matiere.actif && (
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: couleur }} />
      )}
      {canManage && (
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={() => onEdit(matiere)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
            style={{ background: "rgba(0,163,255,0.1)" }}>
            <Pencil className="w-3.5 h-3.5" style={{ color: "#00A3FF" }} />
          </button>
          {matiere.actif && (
            <button onClick={desactiver} disabled={desactiverMut.isPending}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
              style={{ background: "rgba(255,107,107,0.1)" }}>
              <EyeOff className="w-3.5 h-3.5" style={{ color: "#FF6B6B" }} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ─────────────────────────────────────── */
export default function GestionMatieres() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showInactives, setShowInactives] = useState(false);
  const [modalMatiere, setModalMatiere] = useState<Matiere | null | "new">(null);

  const canManage = ["dev", "directeur", "censeur"].includes(user?.role ?? "");
  const isDevRole = user?.role === "dev";

  const { data, isLoading, error } = useListerMatieres();
  const allMatieres: Matiere[] = (data?.matieres ?? []) as Matiere[];

  const invalidate = () => qc.invalidateQueries({ queryKey: getListerMatieresQueryKey() });

  const filtered = allMatieres.filter(m => {
    if (!showInactives && !m.actif) return false;
    if (search) {
      const q = search.toLowerCase();
      return m.nom.toLowerCase().includes(q) || m.code.toLowerCase().includes(q);
    }
    return true;
  });

  const actives   = filtered.filter(m => m.actif);
  const inactives = filtered.filter(m => !m.actif);

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "#00C9A7 transparent transparent" }} />
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64 gap-3" style={{ color: "#FF6B6B" }}>
      <AlertTriangle className="w-6 h-6" /><span>Impossible de charger les matières.</span>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-fade-in">
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Matières
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            {allMatieres.filter(m => m.actif).length} matière{allMatieres.filter(m => m.actif).length !== 1 ? "s" : ""} active{allMatieres.filter(m => m.actif).length !== 1 ? "s" : ""}
            {allMatieres.filter(m => !m.actif).length > 0 && ` · ${allMatieres.filter(m => !m.actif).length} désactivée${allMatieres.filter(m => !m.actif).length > 1 ? "s" : ""}`}
          </p>
        </div>
        {canManage && (
          <button onClick={() => setModalMatiere("new")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#00C9A7,#00A3FF)", color: "#fff" }}>
            <Plus className="w-4 h-4" /> Nouvelle matière
          </button>
        )}
      </div>

      {/* Barre de recherche + filtre */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--m15-muted)" }} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une matière…"
            className="w-full rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
        </div>
        <button onClick={() => setShowInactives(p => !p)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: showInactives ? "rgba(255,107,107,0.12)" : "var(--m15-card)",
            color: showInactives ? "#FF6B6B" : "var(--m15-muted)",
            border: "1px solid var(--m15-border)",
          }}>
          {showInactives ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          Désactivées
        </button>
      </div>

      {/* Matières actives */}
      {actives.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4" style={{ color: "#00C9A7" }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#00C9A7" }}>
              Actives ({actives.length})
            </h2>
          </div>
          {actives.map(m => (
            <CarteMatiere key={m.id} matiere={m} canManage={canManage}
              onEdit={setModalMatiere} onRefresh={invalidate} />
          ))}
        </section>
      )}

      {/* Matières inactives */}
      {showInactives && inactives.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <EyeOff className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />
            <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>
              Désactivées ({inactives.length})
            </h2>
          </div>
          {inactives.map(m => (
            <CarteMatiere key={m.id} matiere={m} canManage={canManage}
              onEdit={setModalMatiere} onRefresh={invalidate} />
          ))}
        </section>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(139,157,195,0.08)" }}>
            <BookMarked className="w-8 h-8" style={{ color: "var(--m15-muted)" }} />
          </div>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            {search ? "Aucune matière ne correspond à la recherche." : "Aucune matière configurée."}
          </p>
          {canManage && !search && (
            <button onClick={() => setModalMatiere("new")}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>
              Créer la première matière
            </button>
          )}
        </div>
      )}

      {(modalMatiere === "new" || (modalMatiere && typeof modalMatiere === "object")) && (
        <ModalMatiere
          matiere={typeof modalMatiere === "object" && modalMatiere !== null ? modalMatiere : undefined}
          etablissementId={user?.etablissement_id ?? null}
          isDevRole={isDevRole}
          onClose={() => setModalMatiere(null)} />
      )}
    </div>
  );
}
