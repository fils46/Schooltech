import { useAuth } from "@/context/AuthContext";
import {
  useGetStatsGlobal, useListerEtablissements,
  getGetStatsGlobalQueryKey, getListerEtablissementsQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Building, Users, Activity, AlertCircle, TrendingUp, TrendingDown, Calendar, Bell } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* ─── Helpers ─────────────────────────────────────────────── */

function StatCard({
  label, value, icon: Icon, color, trend, trendLabel, loading,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down";
  trendLabel?: string;
  loading?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-3 transition-all duration-200 cursor-default"
      style={{
        background: "#111E35",
        border: "1px solid rgba(0,201,167,0.08)",
        borderTop: `3px solid ${color}`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
        (e.currentTarget as HTMLElement).style.borderColor = color;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.transform = "none";
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,201,167,0.08)";
        (e.currentTarget as HTMLElement).style.borderTopColor = color;
      }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#8B9DC3" }}>
          {label}
        </span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-20 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
      ) : (
        <span className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>
          {value}
        </span>
      )}
      {trendLabel && (
        <div className="flex items-center gap-1.5 text-xs font-medium">
          {trend === "up"
            ? <TrendingUp className="w-3.5 h-3.5" style={{ color: "#00C9A7" }} />
            : <TrendingDown className="w-3.5 h-3.5" style={{ color: "#FF4D6D" }} />}
          <span style={{ color: trend === "up" ? "#00C9A7" : "#FF4D6D" }}>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

function BadgeLicence({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
      style={active
        ? { background: "rgba(0,201,167,0.15)", color: "#00C9A7" }
        : { background: "rgba(255,77,109,0.15)", color: "#FF4D6D" }}>
      {active ? "Active" : "Expirée"}
    </span>
  );
}

/* ─── Dev Dashboard ──────────────────────────────────────── */

function DevDashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetStatsGlobal({
    query: { queryKey: getGetStatsGlobalQueryKey() },
  });
  const { data: etablissements, isLoading: etabsLoading } = useListerEtablissements({
    query: { queryKey: getListerEtablissementsQueryKey() },
  });

  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  const agenda = [
    { color: "#00C9A7", label: "Réunion équipe M15 Tech",   time: "09:00" },
    { color: "#F5C842", label: "Déploiement v1.1",           time: "14:00" },
    { color: "#0080FF", label: "Support Lycée Sainte-Marie", time: "16:30" },
  ];

  const alerts = [
    { icon: "⚠️", text: "3 licences expirent dans 30 jours",  color: "#F5C842" },
    { icon: "🔔", text: "2 nouveaux établissements en attente", color: "#0080FF" },
    { icon: "✅", text: "Sauvegarde base de données réussie",  color: "#00C9A7" },
  ];

  return (
    <div className="space-y-6 page-fade-in">

      {/* ── Bannière de bienvenue ── */}
      <div className="relative rounded-2xl p-6 md:p-8 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #162340 0%, rgba(0,201,167,0.08) 100%)",
          border: "1px solid rgba(0,201,167,0.15)",
        }}>
        {/* Glow radial */}
        <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(0,201,167,0.12) 0%, transparent 60%)" }} />

        <div className="relative z-10">
          <p className="text-sm font-medium mb-1" style={{ color: "#8B9DC3" }}>
            {today.charAt(0).toUpperCase() + today.slice(1)}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#00C9A7" }}>
            Bonjour, {user?.prenoms || "Dev"} 👋
          </h2>
          <p className="text-base" style={{ color: "#8B9DC3" }}>
            Voici l'aperçu global de la plateforme M15-SchoolTech.
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Établissements"
          value={stats?.totalEtablissements ?? 0}
          icon={Building}
          color="#00C9A7"
          trend="up"
          trendLabel="+1 ce mois"
          loading={statsLoading}
        />
        <StatCard
          label="Utilisateurs"
          value={stats?.totalUtilisateurs ?? 0}
          icon={Users}
          color="#F5C842"
          trend="up"
          trendLabel="+5 cette semaine"
          loading={statsLoading}
        />
        <StatCard
          label="Licences actives"
          value={stats?.etablissementsActifs ?? 0}
          icon={Activity}
          color="#0080FF"
          trend="up"
          trendLabel="Opérationnels"
          loading={statsLoading}
        />
        <StatCard
          label="Licences expirées"
          value={stats?.licencesExpirees ?? 0}
          icon={AlertCircle}
          color="#FF4D6D"
          trend="down"
          trendLabel="À renouveler"
          loading={statsLoading}
        />
      </div>

      {/* ── Panels du bas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Table établissements */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.08)" }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#F0F4FF" }}>
              Établissements récents
            </h3>
            <Link href="/etablissements" className="text-xs font-semibold hover:underline" style={{ color: "#00C9A7" }}>
              Voir tout
            </Link>
          </div>
          <div>
            {etabsLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.04)" }} />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#162340" }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "#8B9DC3" }}>Nom</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "#8B9DC3" }}>Ville</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "#8B9DC3" }}>Statut</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "#8B9DC3" }}>Expiration</th>
                  </tr>
                </thead>
                <tbody>
                  {(etablissements ?? []).slice(0, 5).map((etab, i) => (
                    <tr key={etab.id}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <td className="px-5 py-3.5 font-medium" style={{ color: "#F0F4FF" }}>{etab.nom}</td>
                      <td className="px-3 py-3.5" style={{ color: "#8B9DC3" }}>{etab.ville || "—"}</td>
                      <td className="px-3 py-3.5"><BadgeLicence active={!!etab.licence_active} /></td>
                      <td className="px-5 py-3.5" style={{ color: "#8B9DC3" }}>
                        {etab.date_expiration_licence ? format(new Date(etab.date_expiration_licence), "dd/MM/yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                  {!etablissements?.length && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: "#8B9DC3" }}>
                        Aucun établissement enregistré
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Agenda + Alertes */}
        <div className="space-y-4">

          {/* Agenda */}
          <div className="rounded-2xl p-5"
            style={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.08)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: "#00C9A7" }} />
                <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#F0F4FF" }}>Agenda du jour</h3>
              </div>
              <span className="text-xs font-semibold hover:underline cursor-pointer" style={{ color: "#00C9A7" }}>Voir tout</span>
            </div>
            <div className="space-y-3">
              {agenda.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs font-semibold tabular-nums flex-shrink-0 w-10" style={{ color: "#8B9DC3" }}>
                    {item.time}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-sm" style={{ color: "#F0F4FF" }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertes */}
          <div className="rounded-2xl p-5"
            style={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.08)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: "#F5C842" }} />
                <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#F0F4FF" }}>Alertes</h3>
              </div>
              <span className="text-xs font-semibold hover:underline cursor-pointer" style={{ color: "#00C9A7" }}>Voir tout</span>
            </div>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.text} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: `${alert.color}0A`, border: `1px solid ${alert.color}20` }}>
                  <span className="text-base leading-none mt-0.5">{alert.icon}</span>
                  <span className="text-sm" style={{ color: "#F0F4FF" }}>{alert.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Directeur Dashboard ────────────────────────────────── */
function DirecteurDashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="space-y-6 page-fade-in">
      <div className="relative rounded-2xl p-6 md:p-8 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #162340 0%, rgba(0,201,167,0.08) 100%)", border: "1px solid rgba(0,201,167,0.15)" }}>
        <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(0,201,167,0.12) 0%, transparent 60%)" }} />
        <div className="relative z-10">
          <p className="text-sm mb-1" style={{ color: "#8B9DC3" }}>{today.charAt(0).toUpperCase() + today.slice(1)}</p>
          <h2 className="text-4xl font-bold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#00C9A7" }}>
            Bonjour, {user?.prenoms} 👋
          </h2>
          <p className="text-base" style={{ color: "#8B9DC3" }}>Voici l'aperçu de votre établissement.</p>
        </div>
      </div>
      <div className="rounded-2xl p-6" style={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.08)" }}>
        <h3 className="font-bold mb-3" style={{ fontFamily: "'Syne', sans-serif", color: "#F0F4FF" }}>
          Tableau de bord Direction
        </h3>
        <p className="text-sm" style={{ color: "#8B9DC3" }}>
          Les modules académiques sont en cours de développement — disponibles en Module 02.
        </p>
      </div>
    </div>
  );
}

/* ─── Default Dashboard ──────────────────────────────────── */
function DefaultDashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });

  return (
    <div className="space-y-6 page-fade-in">
      <div className="relative rounded-2xl p-6 md:p-8 overflow-hidden"
        style={{ background: "linear-gradient(135deg, #162340 0%, rgba(0,201,167,0.08) 100%)", border: "1px solid rgba(0,201,167,0.15)" }}>
        <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(0,201,167,0.12) 0%, transparent 60%)" }} />
        <div className="relative z-10">
          <p className="text-sm mb-1" style={{ color: "#8B9DC3" }}>{today.charAt(0).toUpperCase() + today.slice(1)}</p>
          <h2 className="text-4xl font-bold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#00C9A7" }}>
            Bonjour, {user?.prenoms} 👋
          </h2>
          <p className="text-base" style={{ color: "#8B9DC3" }}>Connecté en tant que <strong style={{ color: "#F5C842" }}>{user?.role}</strong>.</p>
        </div>
      </div>
      <div className="rounded-2xl p-6" style={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.08)" }}>
        <p className="text-sm" style={{ color: "#8B9DC3" }}>Votre espace personnel sera disponible dans le Module 02.</p>
      </div>
    </div>
  );
}

/* ─── Export ─────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "dev") return <DevDashboard />;
  if (user?.role === "directeur") return <DirecteurDashboard />;
  return <DefaultDashboard />;
}
