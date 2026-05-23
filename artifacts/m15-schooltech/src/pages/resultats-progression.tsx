import { useState } from "react";
import {
  useGetExamensEleveEleveIdProgression,
  getGetExamensEleveEleveIdProgressionQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import {
  TrendingUp, TrendingDown, Minus, Award, AlertCircle,
  BarChart3, Calendar, ChevronDown, ChevronUp,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface MatiereStats {
  matiere: string;
  moyenne_blancs: number;
  nb_epreuves: number;
  meilleure_note: number;
  derniere_note: number;
  tendance: "hausse" | "baisse" | "stable";
}
interface HistoriqueEntry {
  date_epreuve: string; matiere: string;
  note: number; bareme_total: string; titre: string;
}
interface ProgressionData {
  eleve_id: string;
  par_matiere: MatiereStats[];
  points_forts: string[];
  points_faibles: string[];
  historique: HistoriqueEntry[];
}

const MATIERE_COLORS = [
  "#00C9A7", "#F5C842", "#0080FF", "#FF4D6D", "#A78BFA", "#FB923C", "#34D399",
];

function getMatiereColor(matiere: string, matieres: string[]): string {
  const idx = matieres.indexOf(matiere);
  return MATIERE_COLORS[idx % MATIERE_COLORS.length];
}

function getNoteBg(note: number, bareme: number): string {
  const ratio = note / bareme;
  if (ratio >= 0.7) return "rgba(0,201,167,0.12)";
  if (ratio >= 0.5) return "rgba(245,200,66,0.12)";
  return "rgba(255,77,109,0.12)";
}

function getNoteColor(note: number, bareme: number): string {
  const ratio = note / bareme;
  if (ratio >= 0.7) return "#00C9A7";
  if (ratio >= 0.5) return "#F5C842";
  return "#FF4D6D";
}

function TendanceIcon({ tendance }: { tendance: string }) {
  if (tendance === "hausse") return <TrendingUp size={14} className="text-[#00C9A7]" />;
  if (tendance === "baisse") return <TrendingDown size={14} className="text-[#FF4D6D]" />;
  return <Minus size={14} className="text-[var(--m15-muted)]" />;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/* Barre de progression avec note */
function NoteBarre({ note, bareme }: { note: number; bareme: number }) {
  const pct = Math.round((note / bareme) * 100);
  const color = getNoteColor(note, bareme);
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-[#0A1628] rounded-full h-2">
        <div style={{ width: `${pct}%`, background: color }} className="h-2 rounded-full transition-all duration-500" />
      </div>
      <span style={{ color }} className="text-sm font-bold w-14 text-right">
        {note}/{bareme}
      </span>
    </div>
  );
}

/* Mini sparkline (SVG) */
function Sparkline({ notes, bareme }: { notes: number[]; bareme: number }) {
  if (notes.length < 2) return null;
  const w = 80; const h = 30; const pad = 4;
  const max = bareme; const min = 0;
  const pts = notes.slice(-8).map((n, i, arr) => {
    const x = pad + (i / (arr.length - 1)) * (w - pad * 2);
    const y = h - pad - ((n - min) / (max - min)) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline fill="none" stroke="#00C9A7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

export default function ResultatsProgression() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const eleveId = user?.id ?? "";

  const [expanded, setExpanded] = useState<string | null>(null);
  const [viewHistorique, setViewHistorique] = useState(false);
  const [filtreMatiere, setFiltreMatiere] = useState("");

  const progressionQk = getGetExamensEleveEleveIdProgressionQueryKey(eleveId);
  const { data, isLoading } = useGetExamensEleveEleveIdProgression(
    eleveId,
    { query: { queryKey: progressionQk, enabled: !!eleveId } }
  );
  const progression = data as ProgressionData | undefined;

  const matieres = progression?.par_matiere.map(m => m.matiere) ?? [];
  const filteredMatieres = filtreMatiere
    ? progression?.par_matiere.filter(m => m.matiere === filtreMatiere) ?? []
    : progression?.par_matiere ?? [];

  const historiqueFiltred = filtreMatiere
    ? progression?.historique.filter(h => h.matiere === filtreMatiere) ?? []
    : progression?.historique ?? [];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--m15-white)]">Résultats & Progression</h1>
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      </div>
    );
  }

  if (!progression || progression.par_matiere.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--m15-white)]">Résultats & Progression</h1>
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-12 border border-[var(--m15-border)] text-center">
          <BarChart3 size={40} className="text-[var(--m15-muted)] mx-auto mb-3" />
          <p className="text-[var(--m15-white)] font-medium mb-1">Aucun résultat disponible</p>
          <p className="text-[var(--m15-muted)] text-sm">Les résultats apparaîtront après vos premières épreuves blanches corrigées.</p>
        </div>
      </div>
    );
  }

  const moy_generale = progression.par_matiere.length
    ? Math.round(progression.par_matiere.reduce((a, m) => a + m.moyenne_blancs, 0) / progression.par_matiere.length * 100) / 100
    : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--m15-white)]">Résultats & Progression</h1>
        <p className="text-[var(--m15-muted)] text-sm">Suivi de vos performances aux épreuves blanches</p>
      </div>

      {/* Stats résumé */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-4 border border-[var(--m15-border)]">
          <p className="text-xs text-[var(--m15-muted)] mb-1">Moyenne générale</p>
          <p style={{ color: getNoteColor(moy_generale, 20) }} className="text-2xl font-bold">{moy_generale}/20</p>
        </div>
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-4 border border-[var(--m15-border)]">
          <p className="text-xs text-[var(--m15-muted)] mb-1">Matières évaluées</p>
          <p className="text-2xl font-bold text-[var(--m15-white)]">{progression.par_matiere.length}</p>
        </div>
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-4 border border-[var(--m15-border)]">
          <p className="text-xs text-[var(--m15-muted)] mb-1">Points forts</p>
          <p className="text-2xl font-bold text-[#00C9A7]">{progression.points_forts.length}</p>
          <p className="text-xs text-[var(--m15-muted)] truncate">{progression.points_forts.join(", ") || "—"}</p>
        </div>
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-4 border border-[var(--m15-border)]">
          <p className="text-xs text-[var(--m15-muted)] mb-1">À améliorer</p>
          <p className="text-2xl font-bold text-[#FF4D6D]">{progression.points_faibles.length}</p>
          <p className="text-xs text-[var(--m15-muted)] truncate">{progression.points_faibles.join(", ") || "—"}</p>
        </div>
      </div>

      {/* Alertes points faibles */}
      {progression.points_faibles.length > 0 && (
        <div style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }}
          className="rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={18} className="text-[#FF4D6D] mt-0.5 shrink-0" />
          <div>
            <p className="text-[var(--m15-white)] font-medium text-sm">Matières à renforcer</p>
            <p className="text-[var(--m15-muted)] text-xs mt-0.5">
              {progression.points_faibles.join(", ")} — moyenne sous 10/20. Consacrez plus de temps à ces matières dans votre planning.
            </p>
          </div>
        </div>
      )}

      {/* Filtre matière + tabs */}
      <div style={{ background: "var(--m15-card)" }} className="rounded-xl p-4 border border-[var(--m15-border)]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setViewHistorique(false)}
              style={!viewHistorique ? { background: "#00C9A7", color: "var(--m15-navy)" } : { background: "var(--m15-navy)", color: "var(--m15-muted)" }}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
            >
              Par matière
            </button>
            <button
              onClick={() => setViewHistorique(true)}
              style={viewHistorique ? { background: "#00C9A7", color: "var(--m15-navy)" } : { background: "var(--m15-navy)", color: "var(--m15-muted)" }}
              className="text-xs px-3 py-1.5 rounded-full font-medium transition-all"
            >
              Historique
            </button>
          </div>
          <select
            value={filtreMatiere}
            onChange={e => setFiltreMatiere(e.target.value)}
            className="bg-[#0A1628] border border-[var(--m15-border)] rounded-lg px-3 py-1.5 text-[var(--m15-white)] text-xs focus:outline-none focus:border-[#00C9A7]"
          >
            <option value="">Toutes les matières</option>
            {matieres.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {/* Vue par matière */}
      {!viewHistorique && (
        <div className="space-y-3">
          {filteredMatieres.map((m) => {
            const color = getMatiereColor(m.matiere, matieres);
            const isOpen = expanded === m.matiere;
            const notesHistorique = historiqueFiltred
              .filter(h => h.matiere === m.matiere)
              .map(h => h.note);

            return (
              <div
                key={m.matiere}
                style={{ background: "var(--m15-card)", borderLeft: `3px solid ${color}` }}
                className="rounded-xl border border-[var(--m15-border)]"
              >
                <button
                  className="w-full p-4 text-left"
                  onClick={() => setExpanded(isOpen ? null : m.matiere)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[var(--m15-white)] font-medium text-sm">{m.matiere}</span>
                          <TendanceIcon tendance={m.tendance} />
                          {progression.points_forts.includes(m.matiere) && (
                            <Award size={13} className="text-[#F5C842]" />
                          )}
                          {progression.points_faibles.includes(m.matiere) && (
                            <AlertCircle size={13} className="text-[#FF4D6D]" />
                          )}
                        </div>
                        <p className="text-xs text-[var(--m15-muted)]">
                          {m.nb_epreuves} épreuve{m.nb_epreuves > 1 ? "s" : ""} · Dernière : {m.derniere_note}/20
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {notesHistorique.length > 1 && (
                        <Sparkline notes={notesHistorique.slice().reverse()} bareme={20} />
                      )}
                      <div className="text-right mr-2">
                        <p style={{ color }} className="text-xl font-bold">{m.moyenne_blancs}</p>
                        <p className="text-xs text-[var(--m15-muted)]">/20</p>
                      </div>
                      {isOpen ? <ChevronUp size={16} className="text-[var(--m15-muted)]" /> : <ChevronDown size={16} className="text-[var(--m15-muted)]" />}
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 border-t border-[var(--m15-border)] pt-4">
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[
                        { label: "Moyenne", value: m.moyenne_blancs, color },
                        { label: "Meilleure note", value: m.meilleure_note, color: "#F5C842" },
                        { label: "Dernière note", value: m.derniere_note, color: "#0080FF" },
                        { label: "Épreuves", value: m.nb_epreuves, color: "var(--m15-muted)" },
                      ].map(s => (
                        <div key={s.label} style={{ background: "var(--m15-navy)" }} className="rounded-lg p-3 text-center">
                          <p className="text-xs text-[var(--m15-muted)] mb-1">{s.label}</p>
                          <p style={{ color: s.color }} className="text-xl font-bold">{s.value}</p>
                        </div>
                      ))}
                    </div>
                    <NoteBarre note={m.moyenne_blancs} bareme={20} />
                    {/* Historique de la matière */}
                    <div className="mt-4 space-y-2">
                      {historiqueFiltred.filter(h => h.matiere === m.matiere).map((h, i) => (
                        <div key={i} style={{ background: "var(--m15-navy)" }} className="flex items-center gap-3 p-2 rounded-lg">
                          <Calendar size={12} className="text-[var(--m15-muted)] shrink-0" />
                          <span className="text-xs text-[var(--m15-muted)] w-28 shrink-0">{fmtDate(h.date_epreuve)}</span>
                          <span className="flex-1 text-xs text-[var(--m15-white)] truncate">{h.titre}</span>
                          <div style={{ background: getNoteBg(h.note, parseFloat(h.bareme_total)), color: getNoteColor(h.note, parseFloat(h.bareme_total)) }}
                            className="text-xs font-bold px-2 py-0.5 rounded-full">
                            {h.note}/{h.bareme_total}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Vue historique chronologique */}
      {viewHistorique && (
        <div style={{ background: "var(--m15-card)" }} className="rounded-xl border border-[var(--m15-border)] overflow-hidden">
          <div className="p-4 border-b border-[var(--m15-border)]">
            <h3 className="text-sm font-semibold text-[var(--m15-white)]">Historique chronologique</h3>
          </div>
          {historiqueFiltred.length === 0 ? (
            <p className="text-[var(--m15-muted)] text-center py-8 text-sm">Aucun résultat.</p>
          ) : (
            <div className="divide-y divide-white/5">
              {historiqueFiltred.map((h, i) => {
                const color = getMatiereColor(h.matiere, matieres);
                const bareme = parseFloat(h.bareme_total);
                return (
                  <div key={i} className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors">
                    <div style={{ background: `${color}20`, color }} className="p-2 rounded-lg shrink-0">
                      <BarChart3 size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[var(--m15-white)] text-sm font-medium truncate">{h.titre}</p>
                      <p className="text-xs text-[var(--m15-muted)]">{h.matiere} · {fmtDate(h.date_epreuve)}</p>
                    </div>
                    <div style={{ background: getNoteBg(h.note, bareme), color: getNoteColor(h.note, bareme) }}
                      className="text-sm font-bold px-3 py-1 rounded-full shrink-0">
                      {h.note}/{h.bareme_total}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
