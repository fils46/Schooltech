import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetExamensSujets,
  usePostExamensSujets,
  usePutExamensSujetsId,
  useDeleteExamensSujetsId,
  usePutExamensSujetsIdPublier,
  getGetExamensSujetsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, Plus, Download, Eye, Pencil, Trash2, Send,
  Search, Filter, CheckCircle2, FileText, Loader2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Sujet {
  id: string; matiere: string; titre: string; type_examen: string;
  serie: string | null; annee: number | null; niveau: string;
  fichier_url: string; fichier_nom: string; corrige_url: string | null;
  corrige_nom: string | null; publie: boolean; nb_telechargements: number;
  ajoute_par: string; auteur_nom: string; created_at: string;
}

const TYPES = [
  { id: "", label: "Tous les types" },
  { id: "BEPC", label: "BEPC" },
  { id: "BAC", label: "BAC" },
  { id: "blanc", label: "Épreuve blanche" },
  { id: "entrainement", label: "Entraînement" },
];
const NIVEAUX = [
  { id: "", label: "Tous les niveaux" },
  { id: "3eme", label: "3ème (BEPC)" },
  { id: "Tle", label: "Terminale (BAC)" },
];
const SERIES = [
  { id: "", label: "Toutes les séries" },
  { id: "A", label: "Série A" },
  { id: "C", label: "Série C" },
  { id: "D", label: "Série D" },
];

type COLOR = { text: string; bg: string };
const TYPE_COLORS: Record<string, COLOR> = {
  BEPC:         { text: "#00C9A7", bg: "rgba(0,201,167,0.12)" },
  BAC:          { text: "#F5C842", bg: "rgba(245,200,66,0.12)" },
  blanc:        { text: "#0080FF", bg: "rgba(0,128,255,0.12)" },
  entrainement: { text: "#8B9DC3", bg: "rgba(139,157,195,0.12)" },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_COLORS[type] ?? TYPE_COLORS.entrainement;
  return (
    <span style={{ color: c.text, background: c.bg }} className="text-xs px-2 py-0.5 rounded-full font-medium">
      {type.toUpperCase()}
    </span>
  );
}

function ModalSujet({
  initial, onClose, onSave,
}: {
  initial?: Partial<Sujet>;
  onClose: () => void;
  onSave: (data: Partial<Sujet>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    matiere: initial?.matiere ?? "",
    titre: initial?.titre ?? "",
    type_examen: initial?.type_examen ?? "BEPC",
    serie: initial?.serie ?? "",
    annee: initial?.annee ? String(initial.annee) : "",
    niveau: initial?.niveau ?? "3eme",
    fichier_url: initial?.fichier_url ?? "",
    fichier_nom: initial?.fichier_nom ?? "",
    corrige_url: initial?.corrige_url ?? "",
    corrige_nom: initial?.corrige_nom ?? "",
    publie: initial?.publie ?? false,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...form,
      annee: form.annee ? parseInt(form.annee, 10) : undefined,
      serie: form.serie || undefined,
      corrige_url: form.corrige_url || undefined,
      corrige_nom: form.corrige_nom || undefined,
    });
    setSaving(false);
  }

  function field(key: keyof typeof form, label: string, opts?: { type?: string; placeholder?: string }) {
    return (
      <div>
        <label className="block text-xs text-[var(--m15-muted)] mb-1">{label}</label>
        <input
          type={opts?.type ?? "text"}
          value={String(form[key])}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={opts?.placeholder}
          className="w-full bg-[var(--m15-navy)] border border-[var(--m15-border)] rounded-lg px-3 py-2 text-[var(--m15-white)] text-sm focus:outline-none focus:border-[#00C9A7]"
        />
      </div>
    );
  }

  function sel(key: keyof typeof form, label: string, options: { id: string; label: string }[]) {
    return (
      <div>
        <label className="block text-xs text-[var(--m15-muted)] mb-1">{label}</label>
        <select
          value={String(form[key])}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          className="w-full bg-[var(--m15-navy)] border border-[var(--m15-border)] rounded-lg px-3 py-2 text-[var(--m15-white)] text-sm focus:outline-none focus:border-[#00C9A7]"
        >
          {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        style={{ background: "var(--m15-card)" }}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6 border border-[var(--m15-border)] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[var(--m15-white)]">
            {initial?.id ? "Modifier le sujet" : "Ajouter un sujet"}
          </h2>
          <button onClick={onClose} className="text-[var(--m15-muted)] hover:text-[var(--m15-white)]">
            <X size={20} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {field("matiere", "Matière *", { placeholder: "ex: Mathématiques" })}
          {field("titre", "Titre *", { placeholder: "ex: Épreuve BEPC 2024" })}
          <div className="grid grid-cols-2 gap-4">
            {sel("type_examen", "Type *", TYPES.slice(1))}
            {sel("niveau", "Niveau *", NIVEAUX.slice(1))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {sel("serie", "Série", SERIES)}
            {field("annee", "Année", { type: "number", placeholder: "ex: 2024" })}
          </div>
          {field("fichier_url", "URL du fichier sujet *", { placeholder: "https://..." })}
          {field("fichier_nom", "Nom du fichier *", { placeholder: "ex: bepc_maths_2024.pdf" })}
          {field("corrige_url", "URL du corrigé (optionnel)", { placeholder: "https://..." })}
          {field("corrige_nom", "Nom du corrigé (optionnel)", { placeholder: "ex: corrige_bepc_maths_2024.pdf" })}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.publie}
              onChange={e => setForm(f => ({ ...f, publie: e.target.checked }))}
              className="accent-[#00C9A7]"
            />
            <span className="text-sm text-[var(--m15-muted)]">Publier immédiatement</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold">
              {saving ? <Loader2 size={16} className="animate-spin" /> : (initial?.id ? "Enregistrer" : "Ajouter")}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BibliothequeSujets() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [niveauFilter, setNiveauFilter] = useState("");
  const [serieFilter, setSerieFilter] = useState("");
  const [pubFilter, setPubFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sujet | null>(null);

  const canManage = ["dev", "directeur", "censeur", "professeur"].includes(role);
  const canPublish = ["dev", "directeur", "censeur"].includes(role);

  const params: Record<string, string> = {};
  if (q)           params.q = q;
  if (typeFilter)  params.type_examen = typeFilter;
  if (niveauFilter) params.niveau = niveauFilter;
  if (serieFilter) params.serie = serieFilter;
  if (pubFilter)   params.publie = pubFilter;
  else if (!canManage) params.publie = "true";

  const sujetsQk = getGetExamensSujetsQueryKey(params);
  const { data, isLoading } = useGetExamensSujets(params, { query: { queryKey: sujetsQk, refetchOnWindowFocus: false } });
  const sujets: Sujet[] = (data as { sujets?: Sujet[] })?.sujets ?? [];

  const createMut  = usePostExamensSujets();
  const updateMut  = usePutExamensSujetsId();
  const deleteMut  = useDeleteExamensSujetsId();
  const publishMut = usePutExamensSujetsIdPublier();

  function invalidate() { qc.invalidateQueries({ queryKey: getGetExamensSujetsQueryKey() }); }

  async function handleSave(form: Partial<Sujet>) {
    try {
      if (editing?.id) {
        await updateMut.mutateAsync({ id: editing.id, data: form as Parameters<typeof updateMut.mutateAsync>[0]["data"] });
        toast({ title: "Sujet mis à jour." });
      } else {
        await createMut.mutateAsync({ data: form as Parameters<typeof createMut.mutateAsync>[0]["data"] });
        toast({ title: "Sujet ajouté." });
      }
      invalidate();
      setModalOpen(false);
      setEditing(null);
    } catch {
      toast({ title: "Erreur lors de la sauvegarde.", variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Supprimer ce sujet ?")) return;
    try {
      await deleteMut.mutateAsync({ id });
      invalidate();
      toast({ title: "Sujet supprimé." });
    } catch {
      toast({ title: "Erreur lors de la suppression.", variant: "destructive" });
    }
  }

  async function handlePublier(id: string) {
    try {
      await publishMut.mutateAsync({ id });
      invalidate();
      toast({ title: "Sujet publié, élèves notifiés." });
    } catch {
      toast({ title: "Erreur lors de la publication.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)]">Bibliothèque de Sujets</h1>
          <p className="text-[var(--m15-muted)] text-sm">Sujets BEPC/BAC et entraînements</p>
        </div>
        {canManage && (
          <Button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold gap-2"
          >
            <Plus size={16} /> Ajouter un sujet
          </Button>
        )}
      </div>

      {/* Filtres */}
      <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-4 border border-[var(--m15-border)]">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--m15-muted)]" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Rechercher..."
              className="w-full bg-[var(--m15-navy)] border border-[var(--m15-border)] rounded-lg pl-9 pr-3 py-2 text-[var(--m15-white)] text-sm focus:outline-none focus:border-[#00C9A7]"
            />
          </div>
          {[
            { state: typeFilter, set: setTypeFilter, opts: TYPES, label: "Type" },
            { state: niveauFilter, set: setNiveauFilter, opts: NIVEAUX, label: "Niveau" },
            { state: serieFilter, set: setSerieFilter, opts: SERIES, label: "Série" },
          ].map(f => (
            <select
              key={f.label}
              value={f.state}
              onChange={e => f.set(e.target.value)}
              className="bg-[var(--m15-navy)] border border-[var(--m15-border)] rounded-lg px-3 py-2 text-[var(--m15-white)] text-sm focus:outline-none focus:border-[#00C9A7]"
            >
              {f.opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          ))}
          {canManage && (
            <select
              value={pubFilter}
              onChange={e => setPubFilter(e.target.value)}
              className="bg-[var(--m15-navy)] border border-[var(--m15-border)] rounded-lg px-3 py-2 text-[var(--m15-white)] text-sm focus:outline-none focus:border-[#00C9A7]"
            >
              <option value="">Tous</option>
              <option value="true">Publiés</option>
              <option value="false">Brouillons</option>
            </select>
          )}
        </div>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : sujets.length === 0 ? (
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-12 border border-[var(--m15-border)] text-center">
          <BookOpen size={40} className="text-[var(--m15-muted)] mx-auto mb-3" />
          <p className="text-[var(--m15-muted)]">Aucun sujet trouvé.</p>
          {canManage && (
            <Button
              onClick={() => { setEditing(null); setModalOpen(true); }}
              className="mt-4 bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold"
            >
              <Plus size={16} className="mr-2" /> Ajouter le premier sujet
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sujets.map((s) => (
            <div
              key={s.id}
              style={{ background: "var(--m15-card)" }}
              className="rounded-xl p-4 border border-[var(--m15-border)] hover:border-[var(--m15-border)] transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div style={{ background: "rgba(0,201,167,0.12)" }} className="p-2 rounded-lg shrink-0">
                    <FileText size={16} className="text-[#00C9A7]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <TypeBadge type={s.type_examen} />
                      <span className="text-xs text-[var(--m15-muted)]">{s.niveau}</span>
                      {s.serie && <span className="text-xs text-[var(--m15-muted)]">Série {s.serie}</span>}
                      {s.annee && <span className="text-xs text-[var(--m15-muted)]">{s.annee}</span>}
                      {!s.publie && canManage && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400">
                          Brouillon
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--m15-white)] font-medium text-sm truncate">{s.titre}</p>
                    <p className="text-[var(--m15-muted)] text-xs mt-0.5">
                      {s.matiere} · Ajouté par {s.auteur_nom} · {fmtDate(s.created_at)}
                      {s.nb_telechargements > 0 && ` · ${s.nb_telechargements} téléch.`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={s.fichier_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--m15-muted)] hover:text-[#00C9A7] transition-colors"
                    title="Télécharger le sujet"
                  >
                    <Download size={16} />
                  </a>
                  {s.corrige_url && (
                    <a
                      href={s.corrige_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[var(--m15-muted)] hover:text-[#F5C842] transition-colors"
                      title="Voir le corrigé"
                    >
                      <Eye size={16} />
                    </a>
                  )}
                  {canManage && (
                    <button
                      onClick={() => { setEditing(s); setModalOpen(true); }}
                      className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                  )}
                  {canPublish && !s.publie && (
                    <button
                      onClick={() => handlePublier(s.id)}
                      className="text-[var(--m15-muted)] hover:text-[#00C9A7] transition-colors"
                      title="Publier"
                    >
                      <Send size={15} />
                    </button>
                  )}
                  {["dev", "directeur"].includes(role) && (
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="text-[var(--m15-muted)] hover:text-[#FF4D6D] transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <ModalSujet
          initial={editing ?? undefined}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
