import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetExamensPlanningEleveId,
  usePostExamensPlanningGenerer,
  usePutExamensPlanningSessionsId,
  useGetExamensPlanningEleveIdCompletion,
  getGetExamensPlanningEleveIdQueryKey,
  getGetExamensPlanningEleveIdCompletionQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Zap, CheckCircle2, XCircle, Clock,
  TrendingUp, Target, ChevronLeft, ChevronRight, Loader2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Session {
  id: string; eleve_id: string; matiere: string; titre_session: string;
  date_session: string; heure_debut: string; heure_fin: string;
  statut: "planifie" | "fait" | "saute"; notes_eleve: string | null;
}
interface CompletionData {
  total: number; fait: number; saute: number; planifie: number;
  taux_completion: number;
  par_matiere: { matiere: string; total: number; fait: number; taux: number }[];
}

const STATUT_CONFIG = {
  planifie: { label: "Planifié",  color: "var(--m15-muted)", bg: "rgba(139,157,195,0.12)" },
  fait:     { label: "Fait",      color: "#00C9A7", bg: "rgba(0,201,167,0.12)" },
  saute:    { label: "Sauté",     color: "#FF4D6D", bg: "rgba(255,77,109,0.12)" },
};

const MATIERE_COLORS = [
  "#00C9A7", "#F5C842", "#0080FF", "#FF4D6D", "#A78BFA", "#FB923C", "#34D399",
];

function getMatiereColor(matiere: string, matieres: string[]): string {
  const idx = matieres.indexOf(matiere);
  return MATIERE_COLORS[idx % MATIERE_COLORS.length];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function getWeekDays(weekStart: string): string[] {
  return Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
}

function getMondayOf(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" });
}

function fmtDateShort(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

/* ── Modal génération planning ── */
function ModalGenerer({ eleveId, onClose, onGenerated }: { eleveId: string; onClose: () => void; onGenerated: () => void }) {
  const { toast } = useToast();
  const generateMut = usePostExamensPlanningGenerer();
  const [form, setForm] = useState({
    date_examen: "",
    nb_heures_par_jour: "3",
    matieres: "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.date_examen) return;
    setSaving(true);
    try {
      const matieres_prioritaires = form.matieres
        ? form.matieres.split(",").map(m => m.trim()).filter(Boolean)
        : [];
      await generateMut.mutateAsync({
        data: {
          eleve_id: eleveId,
          date_examen: form.date_examen,
          nb_heures_par_jour: parseInt(form.nb_heures_par_jour, 10),
          matieres_prioritaires,
        } as Parameters<typeof generateMut.mutateAsync>[0]["data"],
      });
      toast({ title: "Planning généré avec succès !" });
      onGenerated();
    } catch {
      toast({ title: "Erreur lors de la génération.", variant: "destructive" });
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div style={{ background: "var(--m15-card)" }} className="w-full max-w-md rounded-2xl p-6 border border-[var(--m15-border)] shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-[var(--m15-white)]">Générer mon planning</h2>
          <button onClick={onClose} className="text-[var(--m15-muted)] hover:text-[var(--m15-white)]"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[var(--m15-muted)] mb-1">Date de l'examen *</label>
            <input
              type="date"
              required
              value={form.date_examen}
              onChange={e => setForm(f => ({ ...f, date_examen: e.target.value }))}
              min={new Date().toISOString().split("T")[0]}
              className="w-full bg-[var(--m15-navy)] border border-[var(--m15-border)] rounded-lg px-3 py-2 text-[var(--m15-white)] text-sm focus:outline-none focus:border-[#00C9A7]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--m15-muted)] mb-1">Heures de révision par jour</label>
            <select
              value={form.nb_heures_par_jour}
              onChange={e => setForm(f => ({ ...f, nb_heures_par_jour: e.target.value }))}
              className="w-full bg-[var(--m15-navy)] border border-[var(--m15-border)] rounded-lg px-3 py-2 text-[var(--m15-white)] text-sm focus:outline-none focus:border-[#00C9A7]"
            >
              {[1.5, 2, 3, 4, 5, 6].map(h => (
                <option key={h} value={String(h)}>{h}h / jour</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--m15-muted)] mb-1">Matières prioritaires (optionnel)</label>
            <input
              type="text"
              value={form.matieres}
              onChange={e => setForm(f => ({ ...f, matieres: e.target.value }))}
              placeholder="ex: Mathématiques, Physique-Chimie, SVT"
              className="w-full bg-[var(--m15-navy)] border border-[var(--m15-border)] rounded-lg px-3 py-2 text-[var(--m15-white)] text-sm focus:outline-none focus:border-[#00C9A7]"
            />
            <p className="text-xs text-[var(--m15-muted)] mt-1">Séparées par des virgules. Si vide, basé sur vos résultats.</p>
          </div>
          <div style={{ background: "rgba(0,201,167,0.08)", border: "1px solid rgba(0,201,167,0.2)" }} className="rounded-lg p-3 text-xs text-[var(--m15-muted)]">
            ✨ Le planning est intelligent : les matières où vous êtes moins performant auront plus de sessions.
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1 border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={onClose}>Annuler</Button>
            <Button type="submit" disabled={saving} className="flex-1 bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold">
              {saving ? <Loader2 size={16} className="animate-spin mr-1" /> : <Zap size={16} className="mr-1" />}
              Générer
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function PlanningRevision() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const eleveId = user?.id ?? "";
  const role = user?.role ?? "";
  const isEleve = role === "eleve";

  const today = new Date().toISOString().split("T")[0];
  const [weekStart, setWeekStart] = useState(() => getMondayOf(today));
  const [modalGenerer, setModalGenerer] = useState(false);

  const planningQk   = getGetExamensPlanningEleveIdQueryKey(eleveId);
  const completionQk = getGetExamensPlanningEleveIdCompletionQueryKey(eleveId);

  const { data, isLoading } = useGetExamensPlanningEleveId(eleveId, {}, { query: { queryKey: planningQk, enabled: !!eleveId } });
  const { data: completionData } = useGetExamensPlanningEleveIdCompletion(eleveId, { query: { queryKey: completionQk, enabled: !!eleveId } });
  const updateMut = usePutExamensPlanningSessionsId();

  const sessions: Session[] = (data as { sessions?: Session[] })?.sessions ?? [];
  const completion = completionData as CompletionData | undefined;

  const matieres = [...new Set(sessions.map(s => s.matiere))];

  function invalidate() {
    qc.invalidateQueries({ queryKey: getGetExamensPlanningEleveIdQueryKey(eleveId) });
    qc.invalidateQueries({ queryKey: getGetExamensPlanningEleveIdCompletionQueryKey(eleveId) });
  }

  async function toggleStatut(session: Session) {
    const next: Session["statut"] = session.statut === "planifie" ? "fait" : session.statut === "fait" ? "saute" : "planifie";
    try {
      await updateMut.mutateAsync({
        id: session.id,
        data: { statut: next } as Parameters<typeof updateMut.mutateAsync>[0]["data"],
      });
      invalidate();
    } catch {
      toast({ title: "Erreur lors de la mise à jour.", variant: "destructive" });
    }
  }

  const weekDays = getWeekDays(weekStart);
  const sessionsThisWeek = sessions.filter(s => weekDays.includes(s.date_session));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)]">Planning de Révision</h1>
          <p className="text-[var(--m15-muted)] text-sm">Votre programme de révision personnalisé</p>
        </div>
        {isEleve && (
          <Button
            onClick={() => setModalGenerer(true)}
            className="bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold gap-2"
          >
            <Zap size={16} /> Générer un planning
          </Button>
        )}
      </div>

      {/* Stats de complétion */}
      {completion && completion.total > 0 && (
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-5 border border-[var(--m15-border)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[var(--m15-white)]">Progression globale</h3>
            <span style={{ color: "#00C9A7" }} className="text-2xl font-bold">{completion.taux_completion}%</span>
          </div>
          <div className="w-full bg-[var(--m15-navy)] rounded-full h-2 mb-4">
            <div
              style={{ width: `${completion.taux_completion}%`, background: "#00C9A7" }}
              className="h-2 rounded-full transition-all duration-500"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: "Faites", val: completion.fait,     color: "#00C9A7" },
              { label: "Planifiées", val: completion.planifie, color: "var(--m15-muted)" },
              { label: "Sautées", val: completion.saute,   color: "#FF4D6D" },
            ].map(s => (
              <div key={s.label} style={{ background: "var(--m15-navy)" }} className="rounded-lg p-3 text-center">
                <p style={{ color: s.color }} className="text-xl font-bold">{s.val}</p>
                <p className="text-xs text-[var(--m15-muted)]">{s.label}</p>
              </div>
            ))}
          </div>
          {completion.par_matiere.length > 0 && (
            <div className="mt-4 space-y-2">
              {completion.par_matiere.map(m => {
                const color = getMatiereColor(m.matiere, matieres);
                return (
                  <div key={m.matiere} className="flex items-center gap-3">
                    <span className="text-xs text-[var(--m15-muted)] w-36 truncate">{m.matiere}</span>
                    <div className="flex-1 bg-[var(--m15-navy)] rounded-full h-1.5">
                      <div style={{ width: `${m.taux}%`, background: color }} className="h-1.5 rounded-full transition-all" />
                    </div>
                    <span className="text-xs font-medium" style={{ color }}>{m.taux}%</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Calendrier hebdomadaire */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : sessions.length === 0 ? (
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-12 border border-[var(--m15-border)] text-center">
          <Calendar size={40} className="text-[var(--m15-muted)] mx-auto mb-3" />
          <p className="text-[var(--m15-white)] font-medium mb-1">Aucun planning généré</p>
          <p className="text-[var(--m15-muted)] text-sm mb-4">Générez votre planning personnalisé pour commencer à réviser.</p>
          {isEleve && (
            <Button onClick={() => setModalGenerer(true)} className="bg-[#00C9A7] hover:bg-[#00a88a] text-[#0A1628] font-semibold">
              <Zap size={16} className="mr-2" /> Générer mon planning
            </Button>
          )}
        </div>
      ) : (
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl border border-[var(--m15-border)] overflow-hidden">
          {/* Header navigation semaine */}
          <div className="flex items-center justify-between p-4 border-b border-[var(--m15-border)]">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] p-1"
            >
              <ChevronLeft size={20} />
            </button>
            <span className="text-[var(--m15-white)] font-medium text-sm">
              {fmtDateShort(weekStart)} — {fmtDateShort(addDays(weekStart, 5))}
            </span>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] p-1"
            >
              <ChevronRight size={20} />
            </button>
          </div>

          {/* Grille semaine */}
          <div className="p-4">
            {weekDays.map(day => {
              const daySessions = sessionsThisWeek.filter(s => s.date_session === day);
              const isToday = day === today;
              const isPast = day < today;
              return (
                <div key={day} className="mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      style={isToday ? { background: "#00C9A7", color: "var(--m15-navy)" } : { color: isPast ? "#4B5563" : "#8B9DC3" }}
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${isToday ? "" : ""}`}
                    >
                      {fmtDate(day)}
                    </span>
                    {daySessions.length === 0 && (
                      <span className="text-xs text-[var(--m15-muted)]">Repos</span>
                    )}
                  </div>
                  {daySessions.length > 0 && (
                    <div className="space-y-2 pl-2">
                      {daySessions.map(s => {
                        const color = getMatiereColor(s.matiere, matieres);
                        const sc = STATUT_CONFIG[s.statut];
                        return (
                          <div
                            key={s.id}
                            style={{ borderLeft: `3px solid ${color}`, background: "var(--m15-navy)" }}
                            className="rounded-r-lg p-3 flex items-center justify-between"
                          >
                            <div>
                              <p className="text-[var(--m15-white)] text-sm font-medium">{s.matiere}</p>
                              <p className="text-xs text-[var(--m15-muted)] flex items-center gap-1">
                                <Clock size={10} /> {s.heure_debut} – {s.heure_fin}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span style={{ color: sc.color, background: sc.bg }} className="text-xs px-2 py-0.5 rounded-full">
                                {sc.label}
                              </span>
                              {isEleve && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => updateMut.mutateAsync({ id: s.id, data: { statut: "fait" } as Parameters<typeof updateMut.mutateAsync>[0]["data"] }).then(invalidate)}
                                    title="Marquer fait"
                                    className={`p-1 rounded transition-colors ${s.statut === "fait" ? "text-[#00C9A7]" : "text-[var(--m15-muted)] hover:text-[#00C9A7]"}`}
                                  >
                                    <CheckCircle2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => updateMut.mutateAsync({ id: s.id, data: { statut: "saute" } as Parameters<typeof updateMut.mutateAsync>[0]["data"] }).then(invalidate)}
                                    title="Marquer sauté"
                                    className={`p-1 rounded transition-colors ${s.statut === "saute" ? "text-[#FF4D6D]" : "text-[var(--m15-muted)] hover:text-[#FF4D6D]"}`}
                                  >
                                    <XCircle size={16} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modalGenerer && (
        <ModalGenerer
          eleveId={eleveId}
          onClose={() => setModalGenerer(false)}
          onGenerated={() => { setModalGenerer(false); invalidate(); }}
        />
      )}
    </div>
  );
}
