import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetExamensEpreuves,
  usePostExamensEpreuves,
  useGetExamensEpreuvesIdStats,
  usePostExamensEpreuvesIdResultats,
  getGetExamensEpreuvesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  ClipboardList, Plus, BarChart3, PenLine,
  X, Loader2, CheckCircle2, Clock, Calendar,
  Users, TrendingUp, Award,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Epreuve {
  id: string; matiere: string; titre: string; type_examen: string;
  classe_id: string; classe_nom: string; professeur_nom: string;
  date_epreuve: string; duree_minutes: number; bareme_total: string;
  statut: string; instructions: string | null; created_at: string;
}
interface Resultat {
  id?: string; eleve_id: string; eleve_nom: string; eleve_prenoms: string;
  note: string | null; present: boolean; appreciation: string | null;
}
interface StatsData {
  epreuve_id: string; nb_presents: number; nb_absents: number;
  moyenne: number; note_min: number; note_max: number;
  ecart_type: number; taux_reussite: number;
  distribution: Record<string, number>;
  resultats: Resultat[];
}

const STATUT_META: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  planifiee: { label: "Planifiée",  color: "#F5C842", bg: "rgba(245,200,66,0.12)", icon: Clock },
  en_cours:  { label: "En cours",  color: "#0080FF", bg: "rgba(0,128,255,0.12)",  icon: PenLine },
  terminee:  { label: "Terminée",  color: "#8B9DC3", bg: "rgba(139,157,195,0.12)", icon: CheckCircle2 },
  corrigee:  { label: "Corrigée",  color: "#00C9A7", bg: "rgba(0,201,167,0.12)",  icon: Award },
};

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

function StatutBadge({ statut }: { statut: string }) {
  const m = STATUT_META[statut] ?? STATUT_META.planifiee;
  const Icon = m.icon;
  return (
    <span style={{ color: m.color, background: m.bg }}
      className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 w-fit">
      <Icon size={11} />{m.label}
    </span>
  );
}

/* ── Modal création épreuve ── */
function ModalCreer({ onClose, onSave }: { onClose: () => void; onSave: (d: Record<string, unknown>) => Promise<void> }) {
  const [form, setForm] = useState({
    classe_id: "", matiere: "", titre: "", type_examen: "blanc",
    date_epreuve: "", duree_minutes: "120", bareme_total: "20",
    instructions: "", sujet_id: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({
      ...form,
      duree_minutes: parseInt(form.duree_minutes, 10),
      bareme_total: parseFloat(form.bareme_total),
      instructions: form.instructions || undefined,
      sujet_id: form.sujet_id || undefined,
    });
    setSaving(false);
  }

  function field(key: keyof typeof form, label: string, opts?: { type?: string; placeholder?: string; required?: boolean }) {
    return (
      <div>
        <label className="block text-xs text-[#8B9DC3] mb-1">{label}{opts?.required ? " *" : ""}</label>
        <input
          type={opts?.type ?? "text"}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={opts?.placeholder}
          required={opts?.required}
          className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00C9A7]"
        />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div style={{ background: "#111E35" }} className="w-full max-w-lg rounded-2xl p-6 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Planifier une épreuve blanche</h2>
          <button onClick={onClose} className="text-[#8B9DC3] hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {field("classe_id", "ID de la classe", { placeholder: "UUID de la classe", required: true })}
          {field("matiere", "Matière", { placeholder: "ex: Mathématiques", required: true })}
          {field("titre", "Titre de l'épreuve", { placeholder: "ex: Blanc #1 Maths 3ème", required: true })}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#8B9DC3] mb-1">Type</label>
              <select value={form.type_examen} onChange={e => setForm(f => ({ ...f, type_examen: e.target.value }))}
                className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00C9A7]">
                <option value="blanc">Épreuve blanche</option>
                <option value="BEPC">BEPC</option>
                <option value="BAC">BAC</option>
              </select>
            </div>
            {field("date_epreuve", "Date", { type: "date", required: true })}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {field("duree_minutes", "Durée (min)", { type: "number", placeholder: "120" })}
            {field("bareme_total", "Barème", { type: "number", placeholder: "20" })}
          </div>
          <div>
            <label className="block text-xs text-[#8B9DC3] mb-1">Instructions (optionnel)</label>
            <textarea
              value={form.instructions}
              onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
              rows={3}
              className="w-full bg-[#0A1628] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#00C9A7] resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 border-white/10 text-[#8B9DC3]" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold">
              {saving ? <Loader2 size={16} className="animate-spin" /> : "Planifier"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Modal saisie résultats ── */
function ModalResultats({
  epreuveId, bareme, onClose, onSaved,
}: {
  epreuveId: string; bareme: string; onClose: () => void; onSaved: () => void;
}) {
  const { toast } = useToast();
  const { data, isLoading } = useGetExamensEpreuvesIdStats(epreuveId);
  const submitMut = usePostExamensEpreuvesIdResultats();
  const statsData = data as StatsData | undefined;
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [presences, setPresences] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const resultats = (statsData?.resultats ?? []).map(r => ({
      eleve_id: r.eleve_id,
      note: notes[r.eleve_id] !== undefined ? (notes[r.eleve_id] === "" ? null : parseFloat(notes[r.eleve_id])) : (r.note !== null ? parseFloat(String(r.note)) : null),
      present: presences[r.eleve_id] !== undefined ? presences[r.eleve_id] : r.present,
      appreciation: null,
    }));
    try {
      await submitMut.mutateAsync({ id: epreuveId, data: { resultats } as Parameters<typeof submitMut.mutateAsync>[0]["data"] });
      toast({ title: "Résultats enregistrés." });
      onSaved();
    } catch {
      toast({ title: "Erreur lors de la saisie.", variant: "destructive" });
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div style={{ background: "#111E35" }} className="w-full max-w-2xl rounded-2xl p-6 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Saisir les résultats</h2>
          <button onClick={onClose} className="text-[#8B9DC3] hover:text-white"><X size={20} /></button>
        </div>
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : !statsData?.resultats?.length ? (
          <p className="text-[#8B9DC3] text-center py-8">Aucun élève inscrit à cette épreuve.</p>
        ) : (
          <>
            <div className="mb-3 text-xs text-[#8B9DC3]">Barème : {bareme} pts — {statsData.resultats.length} élèves</div>
            <div className="space-y-2 mb-6">
              {statsData.resultats.map(r => {
                const present = presences[r.eleve_id] !== undefined ? presences[r.eleve_id] : r.present;
                return (
                  <div key={r.eleve_id} className="flex items-center gap-3 p-3 bg-[#0A1628] rounded-lg">
                    <input
                      type="checkbox"
                      checked={present}
                      onChange={e => setPresences(p => ({ ...p, [r.eleve_id]: e.target.checked }))}
                      className="accent-[#00C9A7]"
                      title="Présent"
                    />
                    <span className="flex-1 text-white text-sm">{r.eleve_nom} {r.eleve_prenoms}</span>
                    <input
                      type="number"
                      min={0}
                      max={parseFloat(bareme)}
                      step={0.25}
                      disabled={!present}
                      value={notes[r.eleve_id] !== undefined ? notes[r.eleve_id] : (r.note !== null ? String(r.note) : "")}
                      onChange={e => setNotes(n => ({ ...n, [r.eleve_id]: e.target.value }))}
                      placeholder="Note"
                      className="w-20 bg-[#111E35] border border-white/10 rounded-lg px-2 py-1 text-white text-sm text-center focus:outline-none focus:border-[#00C9A7] disabled:opacity-40"
                    />
                    <span className="text-[#8B9DC3] text-sm">/ {bareme}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 border-white/10 text-[#8B9DC3]" onClick={onClose}>Annuler</Button>
              <Button disabled={saving} onClick={handleSave} className="flex-1 bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold">
                {saving ? <Loader2 size={16} className="animate-spin" /> : "Enregistrer les résultats"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ── Modal stats ── */
function ModalStats({ epreuveId, titre, onClose }: { epreuveId: string; titre: string; onClose: () => void }) {
  const { data, isLoading } = useGetExamensEpreuvesIdStats(epreuveId);
  const stats = data as StatsData | undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div style={{ background: "#111E35" }} className="w-full max-w-2xl rounded-2xl p-6 border border-white/10 shadow-2xl overflow-y-auto max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">{titre}</h2>
          <button onClick={onClose} className="text-[#8B9DC3] hover:text-white"><X size={20} /></button>
        </div>
        {isLoading ? (
          <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}</div>
        ) : !stats ? (
          <p className="text-[#8B9DC3] text-center py-8">Aucune donnée disponible.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Moyenne", value: stats.moyenne, color: "#00C9A7" },
                { label: "Taux réussite", value: `${stats.taux_reussite}%`, color: "#F5C842" },
                { label: "Note min", value: stats.note_min, color: "#FF4D6D" },
                { label: "Note max", value: stats.note_max, color: "#0080FF" },
              ].map(s => (
                <div key={s.label} style={{ background: "#0A1628" }} className="rounded-xl p-4 text-center">
                  <p className="text-xs text-[#8B9DC3] mb-1">{s.label}</p>
                  <p style={{ color: s.color }} className="text-2xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-[#8B9DC3] mb-3">Distribution des notes</h3>
            <div className="grid grid-cols-4 gap-3 mb-6">
              {Object.entries(stats.distribution).map(([range, count]) => (
                <div key={range} style={{ background: "#0A1628" }} className="rounded-xl p-3 text-center">
                  <p className="text-xs text-[#8B9DC3]">{range}</p>
                  <p className="text-xl font-bold text-white">{count}</p>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-semibold text-[#8B9DC3] mb-3">Résultats individuels</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {stats.resultats.sort((a, b) => parseFloat(String(b.note ?? 0)) - parseFloat(String(a.note ?? 0))).map((r, i) => (
                <div key={r.eleve_id} className="flex items-center gap-3 p-2 bg-[#0A1628] rounded-lg">
                  <span className="text-[#8B9DC3] text-xs w-6">{i + 1}</span>
                  <span className="flex-1 text-white text-sm">{r.eleve_nom} {r.eleve_prenoms}</span>
                  <span className={`font-bold text-sm ${r.present ? "text-white" : "text-[#8B9DC3]"}`}>
                    {r.present ? (r.note !== null ? `${r.note}` : "—") : "Abs."}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function EpreuvesBlanches() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filtreStatut, setFiltreStatut] = useState("");
  const [modalCreer, setModalCreer] = useState(false);
  const [modalResultats, setModalResultats] = useState<Epreuve | null>(null);
  const [modalStats, setModalStats] = useState<Epreuve | null>(null);

  const canManage = ["dev", "directeur", "censeur", "professeur"].includes(role);

  const params: Record<string, string> = {};
  if (filtreStatut) params.statut = filtreStatut;

  const epreuvesQk = getGetExamensEpreuvesQueryKey(params);
  const { data, isLoading } = useGetExamensEpreuves(params, { query: { queryKey: epreuvesQk, refetchOnWindowFocus: false } });
  const epreuves: Epreuve[] = (data as { epreuves?: Epreuve[] })?.epreuves ?? [];
  const createMut = usePostExamensEpreuves();

  function invalidate() { qc.invalidateQueries({ queryKey: getGetExamensEpreuvesQueryKey() }); }

  async function handleCreer(form: Record<string, unknown>) {
    try {
      await createMut.mutateAsync({ data: form as unknown as Parameters<typeof createMut.mutateAsync>[0]["data"] });
      toast({ title: "Épreuve planifiée, élèves notifiés." });
      invalidate();
      setModalCreer(false);
    } catch {
      toast({ title: "Erreur lors de la création.", variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Épreuves Blanches</h1>
          <p className="text-[#8B9DC3] text-sm">Planification, correction et résultats</p>
        </div>
        {canManage && (
          <Button
            onClick={() => setModalCreer(true)}
            className="bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold gap-2"
          >
            <Plus size={16} /> Planifier une épreuve
          </Button>
        )}
      </div>

      {/* Filtre statut */}
      <div style={{ background: "#111E35" }} className="rounded-xl p-4 border border-white/5">
        <div className="flex gap-2 flex-wrap">
          {[{ id: "", label: "Toutes" }, ...Object.entries(STATUT_META).map(([id, m]) => ({ id, label: m.label }))].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltreStatut(f.id)}
              style={filtreStatut === f.id ? { background: "#00C9A7", color: "#0A1628" } : { background: "#0A1628", color: "#8B9DC3" }}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : epreuves.length === 0 ? (
        <div style={{ background: "#111E35" }} className="rounded-xl p-12 border border-white/5 text-center">
          <ClipboardList size={40} className="text-[#8B9DC3] mx-auto mb-3" />
          <p className="text-[#8B9DC3]">Aucune épreuve blanche trouvée.</p>
          {canManage && (
            <Button onClick={() => setModalCreer(true)} className="mt-4 bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold">
              <Plus size={16} className="mr-2" /> Planifier la première épreuve
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {epreuves.map(e => (
            <div key={e.id} style={{ background: "#111E35" }} className="rounded-xl p-4 border border-white/5 hover:border-white/10 transition-all">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <StatutBadge statut={e.statut} />
                    <span className="text-xs text-[#8B9DC3]">{e.type_examen.toUpperCase()}</span>
                    <span className="text-xs text-[#8B9DC3]">{e.matiere}</span>
                  </div>
                  <p className="text-white font-medium">{e.titre}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                    <span className="text-xs text-[#8B9DC3] flex items-center gap-1">
                      <Calendar size={11} /> {fmtDate(e.date_epreuve)}
                    </span>
                    <span className="text-xs text-[#8B9DC3] flex items-center gap-1">
                      <Clock size={11} /> {e.duree_minutes} min
                    </span>
                    <span className="text-xs text-[#8B9DC3] flex items-center gap-1">
                      <Users size={11} /> {e.classe_nom || "Classe"}
                    </span>
                    <span className="text-xs text-[#8B9DC3]">Prof : {e.professeur_nom}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canManage && e.statut !== "corrigee" && (
                    <button
                      onClick={() => setModalResultats(e)}
                      title="Saisir résultats"
                      className="text-[#8B9DC3] hover:text-[#00C9A7] transition-colors"
                    >
                      <PenLine size={16} />
                    </button>
                  )}
                  {(canManage || e.statut === "corrigee") && (
                    <button
                      onClick={() => setModalStats(e)}
                      title="Voir statistiques"
                      className="text-[#8B9DC3] hover:text-[#F5C842] transition-colors"
                    >
                      <BarChart3 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalCreer && <ModalCreer onClose={() => setModalCreer(false)} onSave={handleCreer} />}
      {modalResultats && (
        <ModalResultats
          epreuveId={modalResultats.id}
          bareme={modalResultats.bareme_total}
          onClose={() => setModalResultats(null)}
          onSaved={() => { setModalResultats(null); invalidate(); }}
        />
      )}
      {modalStats && (
        <ModalStats epreuveId={modalStats.id} titre={modalStats.titre} onClose={() => setModalStats(null)} />
      )}
    </div>
  );
}
