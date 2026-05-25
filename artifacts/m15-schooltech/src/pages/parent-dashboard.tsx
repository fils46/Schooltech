import { useState } from "react";
import { useLocation } from "wouter";
import { useGetParentDashboard, getGetParentDashboardQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, MessageSquare, FileText, Clock,
  ChevronRight, CalendarDays, Award, UserCheck, BookOpen,
  UserCircle, GraduationCap, Loader2,
} from "lucide-react";

const JOURS = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
const MOIS = ["jan", "fév", "mar", "avr", "mai", "jun", "jul", "aoû", "sep", "oct", "nov", "déc"];

const STATUT_ABS: Record<string, { bg: string; color: string; label: string }> = {
  justifiee:     { bg: "rgba(0,201,167,0.12)",   color: "#00C9A7", label: "Justifiée" },
  en_attente:    { bg: "rgba(245,200,66,0.12)",   color: "#F5C842", label: "En attente" },
  non_justifiee: { bg: "rgba(255,77,109,0.12)",   color: "#FF4D6D", label: "Non justifiée" },
  rejetee:       { bg: "rgba(255,77,109,0.12)",   color: "#FF4D6D", label: "Rejetée" },
};

function noteColor(moy: number | null) {
  if (moy === null) return "#8B9DC3";
  if (moy >= 14) return "#00C9A7";
  if (moy >= 10) return "#F5C842";
  return "#FF4D6D";
}

function formatDate(s: string) {
  try {
    const d = new Date(s);
    return `${d.getDate()} ${MOIS[d.getMonth()]}`;
  } catch { return s; }
}

function KpiCard({ icon, label, value, sub, color, href, onClick }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; color: string; href?: string; onClick?: () => void;
}) {
  const el = (
    <div
      onClick={onClick}
      className={`rounded-2xl p-5 flex flex-col gap-2 transition-transform ${href || onClick ? "cursor-pointer hover:scale-[1.02]" : ""}`}
      style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        {(href || onClick) && <ChevronRight className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />}
      </div>
      <p className="text-2xl font-extrabold" style={{ color, fontFamily: "'Syne', sans-serif" }}>{value}</p>
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>{label}</p>
      {sub && <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{sub}</p>}
    </div>
  );
  if (href) return <a href={href}>{el}</a>;
  return el;
}

export default function ParentDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeIdx, setActiveIdx] = useState(0);

  const now = new Date();
  const today = JOURS[now.getDay()];

  const { data, isLoading } = useGetParentDashboard({
    query: { queryKey: getGetParentDashboardQueryKey(), staleTime: 60_000 },
  });

  const enfants: Record<string, unknown>[] = (data as any)?.enfants ?? [];
  const enfant = enfants[activeIdx] as Record<string, unknown> | undefined;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-5">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (enfants.length === 0) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(0,201,167,0.12)" }}>
            <UserCheck className="w-7 h-7" style={{ color: "#00C9A7" }} />
          </div>
          <p className="text-lg font-bold mb-2" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            Aucun enfant lié à votre compte
          </p>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Contactez l'établissement pour associer vos enfants à votre compte parent.
          </p>
        </div>
      </div>
    );
  }

  const moy = enfant?.moyenne_generale != null ? Number(enfant.moyenne_generale) : null;
  const coursAuj = (enfant?.cours_du_jour as Record<string, unknown>[]) ?? [];
  const absences = (enfant?.dernieres_absences as Record<string, unknown>[]) ?? [];
  const devoirs = (enfant?.prochains_devoirs as Record<string, unknown>[]) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-5 page-fade-in">

      {/* ── Hero ── */}
      <div className="relative rounded-2xl p-6 overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--m15-card2) 0%, rgba(0,201,167,0.08) 100%)", border: "1px solid rgba(0,201,167,0.15)" }}>
        <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(0,201,167,0.12) 0%, transparent 60%)" }} />
        <div className="relative z-10">
          <p className="text-sm mb-1" style={{ color: "var(--m15-muted)" }}>
            {today.charAt(0).toUpperCase() + today.slice(1)} {now.getDate()} {MOIS[now.getMonth()]}
          </p>
          <h2 className="text-3xl font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: "#00C9A7" }}>
            Bonjour, {user?.prenoms} 👋
          </h2>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Espace parent · {enfants.length} enfant{enfants.length > 1 ? "s" : ""} suivi{enfants.length > 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ── Sélecteur enfant ── */}
      {enfants.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {enfants.map((e, i) => (
            <button key={String(e.eleve_id ?? i)} onClick={() => setActiveIdx(i)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all"
              style={i === activeIdx
                ? { background: "linear-gradient(135deg, #0080FF, #00C9A7)", color: "#fff" }
                : { background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: i === activeIdx ? "rgba(255,255,255,0.25)" : "rgba(0,201,167,0.15)", color: i === activeIdx ? "#fff" : "#00C9A7" }}>
                {String(e.prenoms ?? "?")[0]}
              </div>
              {String(e.prenoms ?? "")} {String(e.nom ?? "")}
            </button>
          ))}
        </div>
      )}

      {/* ── Fiche enfant ── */}
      {enfant && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="h-1" style={{ background: "linear-gradient(90deg, #0080FF, #00C9A7, #F5C842)" }} />
          <div className="flex items-center gap-4 p-5">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold flex-shrink-0"
              style={{ background: "linear-gradient(135deg, rgba(0,128,255,0.15), rgba(0,201,167,0.15))", border: "1px solid rgba(0,201,167,0.25)", color: "#00C9A7", fontFamily: "'Syne', sans-serif" }}>
              {String(enfant.prenoms ?? "?")[0]}{String(enfant.nom ?? "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                {String(enfant.prenoms ?? "")} {String(enfant.nom ?? "")}
              </h3>
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
                {String(enfant.classe_nom ?? "—")}
                {enfant.filiere_nom ? ` · ${String(enfant.filiere_nom)}` : ""}
                {enfant.annee_scolaire ? ` · ${String(enfant.annee_scolaire)}` : ""}
              </p>
              {!!enfant.matricule && (
                <p className="text-xs mt-1 font-mono" style={{ color: "var(--m15-muted)" }}>
                  Matricule : {String(enfant.matricule)}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0 hidden sm:block">
              <p className="text-3xl font-extrabold" style={{ color: noteColor(moy), fontFamily: "'Syne', sans-serif" }}>
                {moy !== null ? moy.toFixed(2) : "—"}
              </p>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                {moy !== null ? "/20" : "Moy. n/d"}
              </p>
              {!!enfant.rang && (
                <p className="text-xs mt-0.5" style={{ color: "#F5C842" }}>
                  Rang {String(enfant.rang)}/{String(enfant.effectif ?? "?")}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs ── */}
      {enfant && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            icon={<Award className="w-4 h-4" />}
            label="Moyenne"
            value={moy !== null ? `${moy.toFixed(2)}/20` : "—"}
            sub={enfant.rang ? `Rang ${String(enfant.rang)}/${String(enfant.effectif ?? "?")}` : undefined}
            color={noteColor(moy)}
            href="/bulletins-parent"
          />
          <KpiCard
            icon={<AlertTriangle className="w-4 h-4" />}
            label="Absences NJ"
            value={String(Number(enfant.nb_absences ?? 0))}
            sub="non justifiées"
            color={Number(enfant.nb_absences ?? 0) > 3 ? "#FF4D6D" : "#00C9A7"}
            href="/absences-parent"
          />
          <KpiCard
            icon={<MessageSquare className="w-4 h-4" />}
            label="Messages"
            value={String(Number(enfant.nb_messages_non_lus ?? 0))}
            sub="non lus"
            color={Number(enfant.nb_messages_non_lus ?? 0) > 0 ? "#F5C842" : "#00C9A7"}
            href="/messagerie"
          />
          <KpiCard
            icon={<FileText className="w-4 h-4" />}
            label="Bulletins"
            value={String(Number(enfant.bulletins_disponibles ?? 0))}
            sub="disponibles"
            color="#00C9A7"
            href="/bulletins-parent"
          />
        </div>
      )}

      {/* ── Cours du jour + Devoirs ── */}
      {enfant && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Cours du jour */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0,128,255,0.12)" }}>
                <Clock className="w-4 h-4" style={{ color: "#0080FF" }} />
              </div>
              <span className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>
                Cours aujourd'hui — {today}
              </span>
            </div>
            {coursAuj.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--m15-muted)" }}>
                Pas de cours aujourd'hui
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
                {coursAuj.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-1 h-8 rounded-full flex-shrink-0"
                      style={{ background: String(c.couleur ?? "#0080FF") }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--m15-white)" }}>
                        {String(c.matiere ?? "")}
                      </p>
                      {!!c.heure_debut && (
                        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                          {String(c.heure_debut)} – {String(c.heure_fin ?? "")}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Devoirs à venir */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center gap-2 px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(0,201,167,0.12)" }}>
                <BookOpen className="w-4 h-4" style={{ color: "#00C9A7" }} />
              </div>
              <span className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>Devoirs à rendre</span>
            </div>
            {devoirs.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--m15-muted)" }}>
                Aucun devoir à venir
              </p>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
                {devoirs.slice(0, 4).map((d, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center"
                      style={{ background: "rgba(245,200,66,0.1)" }}>
                      <CalendarDays className="w-4 h-4" style={{ color: "#F5C842" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: "var(--m15-white)" }}>
                        {String(d.matiere ?? "")}
                      </p>
                      {!!d.date_remise_devoir && (
                        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                          Pour le {formatDate(String(d.date_remise_devoir))}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Dernières absences ── */}
      {enfant && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(245,200,66,0.12)" }}>
                <AlertTriangle className="w-4 h-4" style={{ color: "#F5C842" }} />
              </div>
              <span className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>Dernières absences</span>
            </div>
            <button onClick={() => setLocation("/absences-parent")}
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: "#00C9A7" }}>
              Voir tout <ChevronRight className="w-3 h-3" />
            </button>
          </div>
          {absences.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: "var(--m15-muted)" }}>
              Aucune absence récente ✓
            </p>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
              {absences.map((a, i) => {
                const st = STATUT_ABS[String(a.statut ?? "")] ?? { bg: "rgba(139,157,195,0.1)", color: "#8B9DC3", label: String(a.statut ?? "") };
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>
                        {String(a.matiere ?? "—")}
                      </p>
                      {!!a.date_absence && (
                        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                          {formatDate(String(a.date_absence))}
                        </p>
                      )}
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Raccourcis ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Bulletins",      icon: <FileText className="w-5 h-5" />,      href: "/bulletins-parent",  color: "#00C9A7" },
          { label: "Absences",       icon: <AlertTriangle className="w-5 h-5" />, href: "/absences-parent",   color: "#F5C842" },
          { label: "Emploi du temps",icon: <CalendarDays className="w-5 h-5" />,  href: "/edt-parent",        color: "#0080FF" },
          { label: "Infirmerie",     icon: <GraduationCap className="w-5 h-5" />, href: "/infirmerie/parent", color: "#A78BFA" },
        ].map(item => (
          <a key={item.label} href={item.href}
            className="rounded-2xl p-4 flex flex-col items-center gap-2 text-center transition-transform hover:scale-[1.02]"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `${item.color}18`, border: `1px solid ${item.color}30` }}>
              <span style={{ color: item.color }}>{item.icon}</span>
            </div>
            <span className="text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>{item.label}</span>
          </a>
        ))}
      </div>

    </div>
  );
}
