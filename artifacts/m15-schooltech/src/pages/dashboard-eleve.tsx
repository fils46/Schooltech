import { useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useGetEleaveDashboard, getGetEleaveDashboardQueryKey } from "@workspace/api-client-react";
import {
  Award, UserMinus, FileSpreadsheet, BookOpen,
  Calendar, Clock, ChevronRight, AlertCircle, CheckCircle2,
  Loader2, Trophy, Bell,
} from "lucide-react";

function KpiCard({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: string | number | null;
  sub?: string; color: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick}
      className={`rounded-2xl p-5 flex flex-col gap-2 ${onClick ? "cursor-pointer hover:scale-[1.02] transition-transform" : ""}`}
      style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <div className="flex items-center justify-between">
        <span style={{ color: "var(--m15-muted)" }}>{icon}</span>
        {onClick && <ChevronRight className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />}
      </div>
      <p className="text-3xl font-extrabold" style={{ color, fontFamily: "'Syne', sans-serif" }}>
        {value !== null && value !== undefined ? value : "—"}
      </p>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>{label}</p>
      {sub && <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{sub}</p>}
    </div>
  );
}

function DevoirUrgentBadge({ date }: { date: string }) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  if (date <= today) return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D" }}>Aujourd'hui</span>;
  if (date <= tomorrow) return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D" }}>Demain</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(245,200,66,0.12)", color: "#F5C842" }}>{date}</span>;
}

const TRIMESTRE_LABELS: Record<string, string> = { "1": "1er Trimestre", "2": "2ème Trimestre", "3": "3ème Trimestre" };
const STATUT_ABSENCE_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  non_justifiee: { bg: "rgba(255,77,109,0.12)", color: "#FF4D6D", label: "Non justifiée" },
  en_attente: { bg: "rgba(245,200,66,0.12)", color: "#F5C842", label: "En attente" },
  justifiee: { bg: "rgba(0,201,167,0.12)", color: "#00C9A7", label: "Justifiée" },
  rejetee: { bg: "rgba(255,77,109,0.12)", color: "#FF4D6D", label: "Rejetée" },
};

export default function DashboardEleve() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const topRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useGetEleaveDashboard({
    query: { queryKey: getGetEleaveDashboardQueryKey() },
  });

  const d = data as Record<string, unknown> | undefined;
  const eleve = d?.eleve as Record<string, unknown> | null | undefined;
  const classe = d?.classe as Record<string, unknown> | null | undefined;
  const kpis = d?.kpis as Record<string, unknown> | undefined;
  const notesRecentes = (d?.notes_recentes as Array<Record<string, unknown>>) ?? [];
  const absencesRecentes = (d?.absences_recentes as Array<Record<string, unknown>>) ?? [];
  const bulletins = (d?.bulletins as Array<Record<string, unknown>>) ?? [];
  const devoirsUrgents = (d?.devoirs_urgents as Array<Record<string, unknown>>) ?? [];

  const prenom = String(user?.prenoms ?? user?.nom ?? "");
  const moyenne = kpis?.moyenne_generale ? String(kpis.moyenne_generale) : null;
  const moyenneNum = moyenne ? parseFloat(moyenne) : null;
  const moyenneColor = moyenneNum === null ? "#F5C842" : moyenneNum >= 14 ? "#00C9A7" : moyenneNum >= 10 ? "#F5C842" : "#FF4D6D";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#00C9A7" }} />
      </div>
    );
  }

  return (
    <div ref={topRef} className="max-w-6xl mx-auto space-y-6 page-fade-in">

      {/* ── Header ── */}
      <div className="rounded-2xl p-6" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-extrabold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Bonjour {prenom} 👋
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
              {classe ? `${String(classe.nom_classe ?? "")} · ${String(classe.niveau ?? "")}` : "Classe non assignée"}
            </p>
            {!!eleve?.matricule && (
              <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>Matricule : {String(eleve.matricule)}</p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {kpis?.notifs_non_lues && Number(kpis.notifs_non_lues) > 0 ? (
              <button onClick={() => setLocation("/notifications")}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.2)" }}>
                <Bell className="w-4 h-4" />
                {String(kpis.notifs_non_lues)} non lue{Number(kpis.notifs_non_lues) > 1 ? "s" : ""}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Award className="w-5 h-5" />}
          label="Moyenne générale"
          value={moyenne ? `${moyenne}/20` : null}
          sub="Notes saisies ce trimestre"
          color={moyenneColor}
          onClick={() => setLocation("/notes")}
        />
        <KpiCard
          icon={<UserMinus className="w-5 h-5" />}
          label="Absences"
          value={kpis?.absences_non_justifiees !== undefined ? String(kpis.absences_non_justifiees) : null}
          sub="Non justifiées"
          color={Number(kpis?.absences_non_justifiees ?? 0) > 5 ? "#FF4D6D" : "#00C9A7"}
          onClick={() => setLocation("/mes-absences")}
        />
        <KpiCard
          icon={<FileSpreadsheet className="w-5 h-5" />}
          label="Bulletins"
          value={kpis?.bulletins_disponibles !== undefined ? String(kpis.bulletins_disponibles) : null}
          sub="Disponibles"
          color="#0080FF"
          onClick={() => setLocation("/mes-bulletins")}
        />
        <KpiCard
          icon={<BookOpen className="w-5 h-5" />}
          label="Devoirs urgents"
          value={kpis?.devoirs_urgents !== undefined ? String(kpis.devoirs_urgents) : null}
          sub="Dans les 7 prochains jours"
          color="#F5C842"
        />
      </div>

      {/* ── Contenu principal ── */}
      <div className="grid lg:grid-cols-5 gap-5">

        {/* Section gauche (60%) */}
        <div className="lg:col-span-3 space-y-5">

          {/* Devoirs urgents */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" style={{ color: "#F5C842" }} />
                <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Devoirs urgents</h2>
              </div>
              <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842" }}>7 jours</span>
            </div>
            {devoirsUrgents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8">
                <CheckCircle2 className="w-8 h-8" style={{ color: "#00C9A7" }} />
                <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun devoir urgent à rendre</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
                {devoirsUrgents.map((d, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: "var(--m15-white)" }}>{String(d.titre_lecon ?? "")}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{String(d.matiere ?? "")} · {String(d.travaux_donnes ?? "")}</p>
                    </div>
                    <DevoirUrgentBadge date={String(d.date_remise_devoir ?? "")} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Mes résultats récents */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4" style={{ color: "#F5C842" }} />
                <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Mes résultats récents</h2>
              </div>
              <button onClick={() => setLocation("/notes")} className="text-xs" style={{ color: "#00C9A7" }}>Voir tout</button>
            </div>
            {notesRecentes.length === 0 ? (
              <p className="text-center text-sm py-8" style={{ color: "var(--m15-muted)" }}>Aucune note saisie</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
                {notesRecentes.slice(0, 6).map((n, i) => {
                  const note = Number(n.note);
                  const noteSur = Number(n.note_sur);
                  const pct = noteSur > 0 ? note / noteSur : 0;
                  const noteColor = pct >= 0.7 ? "#00C9A7" : pct >= 0.5 ? "#F5C842" : "#FF4D6D";
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate" style={{ color: "var(--m15-white)" }}>{String(n.intitule ?? "")}</p>
                        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{String(n.matiere ?? "")} · {TRIMESTRE_LABELS[String(n.trimestre)] ?? `T${n.trimestre}`}</p>
                      </div>
                      <p className="text-lg font-extrabold flex-shrink-0" style={{ color: noteColor, fontFamily: "'Syne', sans-serif" }}>
                        {note}/{noteSur}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Emploi du temps placeholder */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: "#0080FF" }} />
                <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Cours aujourd'hui</h2>
              </div>
              <button onClick={() => setLocation("/emploi-du-temps")} className="text-xs" style={{ color: "#00C9A7" }}>Voir la semaine</button>
            </div>
            <div className="flex flex-col items-center gap-3 py-8">
              <Calendar className="w-8 h-8" style={{ color: "var(--m15-muted)" }} />
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Consultez l'emploi du temps complet</p>
              <button onClick={() => setLocation("/emploi-du-temps")}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF", border: "1px solid rgba(0,128,255,0.2)" }}>
                <Calendar className="w-4 h-4" />Voir mon emploi du temps
              </button>
            </div>
          </div>
        </div>

        {/* Section droite (40%) */}
        <div className="lg:col-span-2 space-y-5">

          {/* Absences récentes */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <div className="flex items-center gap-2">
                <UserMinus className="w-4 h-4" style={{ color: "#FF4D6D" }} />
                <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Mes absences</h2>
              </div>
              <button onClick={() => setLocation("/mes-absences")} className="text-xs" style={{ color: "#00C9A7" }}>Voir tout</button>
            </div>
            {absencesRecentes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <CheckCircle2 className="w-7 h-7" style={{ color: "#00C9A7" }} />
                <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucune absence récente</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
                {absencesRecentes.map((a, i) => {
                  const st = STATUT_ABSENCE_STYLE[String(a.statut ?? "non_justifiee")] ?? STATUT_ABSENCE_STYLE.non_justifiee;
                  return (
                    <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>{String(a.matiere ?? "—")}</p>
                        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{String(a.date_absence ?? "")}</p>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bulletins disponibles */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4" style={{ color: "#0080FF" }} />
                <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Bulletins</h2>
              </div>
            </div>
            {bulletins.length === 0 ? (
              <p className="text-center text-sm py-6" style={{ color: "var(--m15-muted)" }}>Aucun bulletin disponible</p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
                {bulletins.slice(0, 3).map((b, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>{TRIMESTRE_LABELS[String(b.trimestre)] ?? `Trimestre ${b.trimestre}`}</p>
                      {!!b.moyenne_generale && <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Moy. : {String(b.moyenne_generale)}/20</p>}
                    </div>
                    <button onClick={() => setLocation(`/mes-bulletins`)}
                      className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                      style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF", border: "1px solid rgba(0,128,255,0.2)" }}>
                      Consulter
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clubs */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4" style={{ color: "#F5C842" }} />
                <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Mes clubs</h2>
              </div>
              <button onClick={() => setLocation("/mes-clubs")} className="text-xs" style={{ color: "#00C9A7" }}>Voir tout</button>
            </div>
            <div className="flex flex-col items-center gap-3 py-6">
              <Trophy className="w-7 h-7" style={{ color: "var(--m15-muted)" }} />
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Consultez vos clubs et activités</p>
              <button onClick={() => setLocation("/mes-clubs")}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.2)" }}>
                Voir mes clubs
              </button>
            </div>
          </div>

          {/* Planning révision */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" style={{ color: "#00C9A7" }} />
                <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Planning révision</h2>
              </div>
              <button onClick={() => setLocation("/planning-revision")} className="text-xs" style={{ color: "#00C9A7" }}>Voir</button>
            </div>
            <div className="flex flex-col items-center gap-3 py-6">
              <AlertCircle className="w-7 h-7" style={{ color: "var(--m15-muted)" }} />
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Gérez vos sessions de révision</p>
              <button onClick={() => setLocation("/planning-revision")}
                className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
                Mon planning
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
