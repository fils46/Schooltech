import { useAuth } from "@/context/AuthContext";
import {
  useGetStatsGlobal, useListerEtablissements,
  getGetStatsGlobalQueryKey, getListerEtablissementsQueryKey,
  useGetStatsEtablissement, getGetStatsEtablissementQueryKey,
  useListerClasses, getListerClassesQueryKey,
  useListerEleves, getListerElevesQueryKey,
  useGetEtablissement, getGetEtablissementQueryKey,
} from "@workspace/api-client-react";
import { Link } from "wouter";
import { Building, Users, Activity, AlertCircle, TrendingUp, TrendingDown, Calendar, Bell, GraduationCap, UserSquare, BookOpen, UsersRound, ChevronRight, ArrowRight, School } from "lucide-react";
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
        background: "var(--m15-card)",
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
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>
          {label}
        </span>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      {loading ? (
        <div className="h-8 w-20 rounded-lg animate-pulse" style={{ background: "var(--elevate-2)" }} />
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
          background: "linear-gradient(135deg, var(--m15-card2) 0%, rgba(0,201,167,0.08) 100%)",
          border: "1px solid rgba(0,201,167,0.15)",
        }}>
        <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(0,201,167,0.12) 0%, transparent 60%)" }} />

        <div className="relative z-10">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--m15-muted)" }}>
            {today.charAt(0).toUpperCase() + today.slice(1)}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#00C9A7" }}>
            Bonjour, {user?.prenoms || "Dev"} 👋
          </h2>
          <p className="text-base" style={{ color: "var(--m15-muted)" }}>
            Voici l'aperçu global de la plateforme M15-SchoolTech.
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
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
        <StatCard
          label="Élèves actifs"
          value={stats?.totalElevesActifs ?? 0}
          icon={GraduationCap}
          color="#A78BFA"
          trend="up"
          trendLabel="En cours"
          loading={statsLoading}
        />
        <StatCard
          label={`Inscrits ${new Date().getFullYear()}`}
          value={stats?.inscriptionsAnneeEnCours ?? 0}
          icon={UserSquare}
          color="#F472B6"
          trend="up"
          trendLabel="Cette année"
          loading={statsLoading}
        />
      </div>

      {/* ── Panels du bas ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Table établissements */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--m15-border)" }}>
            <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
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
                  <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--elevate-1)" }} />
                ))}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--m15-card2)" }}>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>Nom</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>Ville</th>
                    <th className="text-left px-3 py-3 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>Statut</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>Expiration</th>
                  </tr>
                </thead>
                <tbody>
                  {(etablissements ?? []).slice(0, 5).map((etab) => (
                    <tr key={etab.id}
                      style={{ borderBottom: "1px solid var(--m15-border)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <td className="px-5 py-3.5 font-medium" style={{ color: "var(--m15-white)" }}>{etab.nom}</td>
                      <td className="px-3 py-3.5" style={{ color: "var(--m15-muted)" }}>{etab.ville || "—"}</td>
                      <td className="px-3 py-3.5"><BadgeLicence active={!!etab.licence_active} /></td>
                      <td className="px-5 py-3.5" style={{ color: "var(--m15-muted)" }}>
                        {etab.date_expiration_licence ? format(new Date(etab.date_expiration_licence), "dd/MM/yyyy") : "—"}
                      </td>
                    </tr>
                  ))}
                  {!etablissements?.length && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm" style={{ color: "var(--m15-muted)" }}>
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
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" style={{ color: "#00C9A7" }} />
                <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Agenda du jour</h3>
              </div>
              <span className="text-xs font-semibold hover:underline cursor-pointer" style={{ color: "#00C9A7" }}>Voir tout</span>
            </div>
            <div className="space-y-3">
              {agenda.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-xs font-semibold tabular-nums flex-shrink-0 w-10" style={{ color: "var(--m15-muted)" }}>
                    {item.time}
                  </span>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                  <span className="text-sm" style={{ color: "var(--m15-white)" }}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alertes */}
          <div className="rounded-2xl p-5"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: "#F5C842" }} />
                <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Alertes</h3>
              </div>
              <span className="text-xs font-semibold hover:underline cursor-pointer" style={{ color: "#00C9A7" }}>Voir tout</span>
            </div>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div key={alert.text} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: `${alert.color}0A`, border: `1px solid ${alert.color}20` }}>
                  <span className="text-base leading-none mt-0.5">{alert.icon}</span>
                  <span className="text-sm" style={{ color: "var(--m15-white)" }}>{alert.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Quick Action Button ────────────────────────────────── */
function QuickAction({ href, icon: Icon, label, color }: { href: string; icon: React.ElementType; label: string; color: string }) {
  return (
    <Link href={href}>
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-150"
        style={{ background: `${color}10`, border: `1px solid ${color}20` }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = `${color}1E`;
          (e.currentTarget as HTMLElement).style.borderColor = `${color}50`;
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = `${color}10`;
          (e.currentTarget as HTMLElement).style.borderColor = `${color}20`;
        }}
      >
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}25` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-sm font-medium flex-1" style={{ color: "var(--m15-white)" }}>{label}</span>
        <ArrowRight className="w-3.5 h-3.5" style={{ color: "var(--m15-muted)" }} />
      </div>
    </Link>
  );
}

/* ─── Niveau badge ───────────────────────────────────────── */
const NIVEAU_COLORS: Record<string, string> = {
  "6ème": "#00C9A7", "5ème": "#0080FF", "4ème": "#A78BFA",
  "3ème": "#F472B6", "2nde": "#F5C842", "1ère": "#FF8C42", "Terminale": "#FF4D6D",
};

/* ─── Directeur Dashboard ────────────────────────────────── */
function DirecteurDashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const etabId = user?.etablissement_id ?? "";
  const anneeEnCours = new Date().getFullYear();

  const { data: etab } = useGetEtablissement(etabId, {
    query: { queryKey: getGetEtablissementQueryKey(etabId), enabled: !!etabId },
  });

  const { data: stats, isLoading: statsLoading } = useGetStatsEtablissement(etabId, {
    query: { queryKey: getGetStatsEtablissementQueryKey(etabId), enabled: !!etabId },
  });

  const { data: classesData, isLoading: classesLoading } = useListerClasses(
    { annee_scolaire: anneeEnCours },
    { query: { queryKey: getListerClassesQueryKey({ annee_scolaire: anneeEnCours }) } }
  );

  const { data: elevesData, isLoading: elevesLoading } = useListerEleves(
    { limit: 5, page: 1 },
    { query: { queryKey: getListerElevesQueryKey({ limit: 5, page: 1 }) } }
  );

  const getRoleCount = (role: string) =>
    stats?.repartitionRoles?.find((r) => r.role === role)?.count ?? 0;

  const niveauGroups = (classesData?.classes ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.niveau] = (acc[c.niveau] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 page-fade-in">

      {/* ── Bannière ── */}
      <div className="relative rounded-2xl p-6 md:p-8 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--m15-card2) 0%, rgba(0,201,167,0.08) 100%)",
          border: "1px solid rgba(0,201,167,0.15)",
        }}>
        <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(0,201,167,0.12) 0%, transparent 60%)" }} />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--m15-muted)" }}>
              {today.charAt(0).toUpperCase() + today.slice(1)}
            </p>
            <h2 className="text-4xl font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: "#00C9A7" }}>
              Bonjour, {user?.prenoms} 👋
            </h2>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
              {etab ? (
                <span>Direction de <strong style={{ color: "var(--m15-white)" }}>{etab.nom}</strong></span>
              ) : (
                "Voici l'aperçu de votre établissement."
              )}
            </p>
          </div>
          {etab && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl flex-shrink-0"
              style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.2)" }}>
              <School className="w-4 h-4" style={{ color: "#00C9A7" }} />
              <span className="text-sm font-medium" style={{ color: "#00C9A7" }}>{etab.ville || "Côte d'Ivoire"}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Élèves inscrits"
          value={elevesData?.total ?? 0}
          icon={GraduationCap}
          color="#00C9A7"
          trend="up"
          trendLabel={`Année ${anneeEnCours}`}
          loading={elevesLoading}
        />
        <StatCard
          label="Classes ouvertes"
          value={classesData?.total ?? 0}
          icon={BookOpen}
          color="#0080FF"
          trendLabel={`${Object.keys(niveauGroups).length} niveaux`}
          loading={classesLoading}
        />
        <StatCard
          label="Professeurs"
          value={getRoleCount("professeur")}
          icon={UserSquare}
          color="#F5C842"
          trendLabel="Corps enseignant"
          loading={statsLoading}
        />
        <StatCard
          label="Censeurs"
          value={getRoleCount("censeur")}
          icon={UsersRound}
          color="#A78BFA"
          trendLabel="Encadrement"
          loading={statsLoading}
        />
      </div>

      {/* ── Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Classes par niveau */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--m15-border)" }}>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" style={{ color: "#0080FF" }} />
              <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                Classes — {anneeEnCours}
              </h3>
            </div>
            <Link href="/classes" className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "#00C9A7" }}>
              Gérer <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {classesLoading ? (
            <div className="p-5 space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--elevate-1)" }} />
              ))}
            </div>
          ) : Object.keys(niveauGroups).length === 0 ? (
            <div className="px-5 py-12 text-center">
              <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: "var(--m15-muted)" }} />
              <p className="text-sm font-medium mb-1" style={{ color: "var(--m15-white)" }}>Aucune classe créée</p>
              <p className="text-xs mb-4" style={{ color: "var(--m15-muted)" }}>Commencez par créer les classes de votre établissement.</p>
              <Link href="/classes">
                <span className="text-xs font-semibold hover:underline" style={{ color: "#00C9A7" }}>Créer une classe →</span>
              </Link>
            </div>
          ) : (
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.entries(niveauGroups).map(([niveau, count]) => {
                  const color = NIVEAU_COLORS[niveau] ?? "#00C9A7";
                  const classesForNiveau = (classesData?.classes ?? []).filter(c => c.niveau === niveau);
                  return (
                    <div key={niveau} className="rounded-xl p-4"
                      style={{ background: `${color}0C`, border: `1px solid ${color}20` }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{niveau}</span>
                        <span className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>{count}</span>
                      </div>
                      <div className="space-y-1">
                        {classesForNiveau.slice(0, 3).map(c => (
                          <div key={c.id} className="text-xs truncate" style={{ color: "var(--m15-muted)" }}>
                            {c.nom}
                          </div>
                        ))}
                        {classesForNiveau.length > 3 && (
                          <div className="text-xs" style={{ color }}>+{classesForNiveau.length - 3} autres</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Répartition collège/lycée */}
              <div className="mt-4 flex gap-3">
                {(() => {
                  const college = ["6ème","5ème","4ème","3ème"];
                  const lycee = ["2nde","1ère","Terminale"];
                  const nbCollege = Object.entries(niveauGroups).filter(([n]) => college.includes(n)).reduce((s,[,c])=>s+c,0);
                  const nbLycee = Object.entries(niveauGroups).filter(([n]) => lycee.includes(n)).reduce((s,[,c])=>s+c,0);
                  return (
                    <>
                      {nbCollege > 0 && (
                        <div className="flex-1 rounded-xl px-4 py-3 flex items-center justify-between"
                          style={{ background: "rgba(0,201,167,0.06)", border: "1px solid rgba(0,201,167,0.12)" }}>
                          <span className="text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>Collège</span>
                          <span className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#00C9A7" }}>{nbCollege}</span>
                        </div>
                      )}
                      {nbLycee > 0 && (
                        <div className="flex-1 rounded-xl px-4 py-3 flex items-center justify-between"
                          style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.12)" }}>
                          <span className="text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>Lycée</span>
                          <span className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#F5C842" }}>{nbLycee}</span>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar droite */}
        <div className="space-y-4">

          {/* Accès rapides */}
          <div className="rounded-2xl p-5"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <h3 className="font-bold mb-3 text-sm uppercase tracking-widest"
              style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>
              Accès rapides
            </h3>
            <div className="space-y-2">
              <QuickAction href="/eleves" icon={GraduationCap} label="Gestion des élèves" color="#00C9A7" />
              <QuickAction href="/classes" icon={BookOpen} label="Mes classes" color="#0080FF" />
              <QuickAction href="/censeurs" icon={UsersRound} label="Censeurs" color="#A78BFA" />
              <QuickAction href="/utilisateurs" icon={Users} label="Tous les utilisateurs" color="#F5C842" />
            </div>
          </div>

          {/* Inscriptions récentes */}
          <div className="rounded-2xl p-5"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm uppercase tracking-widest"
                style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>
                Derniers élèves
              </h3>
              <Link href="/eleves" className="flex items-center gap-0.5 text-xs font-semibold hover:underline" style={{ color: "#00C9A7" }}>
                Voir tout <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {elevesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: "var(--elevate-1)" }} />
                ))}
              </div>
            ) : (elevesData?.eleves ?? []).length === 0 ? (
              <div className="py-6 text-center">
                <GraduationCap className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: "var(--m15-muted)" }} />
                <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Aucun élève inscrit</p>
              </div>
            ) : (
              <div className="space-y-2">
                {(elevesData?.eleves ?? []).slice(0, 5).map((eleve) => (
                  <Link key={eleve.id} href={`/eleves/${eleve.id}`}>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(0,201,167,0.15)", color: "#00C9A7" }}>
                        {eleve.prenoms?.charAt(0) ?? eleve.nom.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--m15-white)" }}>
                          {eleve.prenoms} {eleve.nom}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--m15-muted)" }}>
                          {eleve.matricule}
                        </p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Censeur Dashboard ──────────────────────────────────── */
function CenseurDashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const anneeEnCours = new Date().getFullYear();

  const { data: classesData, isLoading: classesLoading } = useListerClasses(
    { annee_scolaire: anneeEnCours },
    { query: { queryKey: getListerClassesQueryKey({ annee_scolaire: anneeEnCours }) } }
  );

  const { data: elevesData, isLoading: elevesLoading } = useListerEleves(
    { limit: 4, page: 1 },
    { query: { queryKey: getListerElevesQueryKey({ limit: 4, page: 1 }) } }
  );

  const niveauGroups = (classesData?.classes ?? []).reduce<Record<string, number>>((acc, c) => {
    acc[c.niveau] = (acc[c.niveau] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 page-fade-in">

      {/* ── Bannière ── */}
      <div className="relative rounded-2xl p-6 md:p-8 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--m15-card2) 0%, rgba(167,139,250,0.08) 100%)",
          border: "1px solid rgba(167,139,250,0.2)",
        }}>
        <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(167,139,250,0.1) 0%, transparent 60%)" }} />
        <div className="relative z-10">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--m15-muted)" }}>
            {today.charAt(0).toUpperCase() + today.slice(1)}
          </p>
          <h2 className="text-4xl font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: "#A78BFA" }}>
            Bonjour, {user?.prenoms} 👋
          </h2>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Tableau de bord Censeur — aperçu de l'établissement.</p>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Classes"
          value={classesData?.total ?? 0}
          icon={BookOpen}
          color="#A78BFA"
          trendLabel={`${Object.keys(niveauGroups).length} niveaux`}
          loading={classesLoading}
        />
        <StatCard
          label="Élèves inscrits"
          value={elevesData?.total ?? 0}
          icon={GraduationCap}
          color="#00C9A7"
          trendLabel={`Année ${anneeEnCours}`}
          loading={elevesLoading}
        />
      </div>

      {/* ── Panels ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Classes */}
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--m15-border)" }}>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" style={{ color: "#A78BFA" }} />
              <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Classes</h3>
            </div>
            <Link href="/classes" className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "#A78BFA" }}>
              Voir tout <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {classesLoading ? (
            <div className="p-4 space-y-2">
              {[1,2,3].map(i=><div key={i} className="h-8 rounded-lg animate-pulse" style={{background:"var(--elevate-1)"}}/>)}
            </div>
          ) : Object.keys(niveauGroups).length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucune classe pour cette année.</p>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 gap-2">
              {Object.entries(niveauGroups).map(([niveau, cnt]) => {
                const color = NIVEAU_COLORS[niveau] ?? "#A78BFA";
                return (
                  <div key={niveau} className="rounded-xl px-4 py-3 flex items-center justify-between"
                    style={{ background: `${color}0C`, border: `1px solid ${color}20` }}>
                    <span className="text-xs font-bold" style={{ color }}>{niveau}</span>
                    <span className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Accès rapides + Élèves récents */}
        <div className="space-y-4">
          <div className="rounded-2xl p-5"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <h3 className="font-bold mb-3 text-sm uppercase tracking-widest"
              style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>
              Accès rapides
            </h3>
            <div className="space-y-2">
              <QuickAction href="/eleves" icon={GraduationCap} label="Gestion des élèves" color="#00C9A7" />
              <QuickAction href="/classes" icon={BookOpen} label="Mes classes" color="#A78BFA" />
              <QuickAction href="/utilisateurs" icon={Users} label="Utilisateurs" color="#F5C842" />
            </div>
          </div>

          <div className="rounded-2xl p-5"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm uppercase tracking-widest"
                style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>
                Derniers élèves
              </h3>
              <Link href="/eleves" className="text-xs font-semibold hover:underline" style={{ color: "#00C9A7" }}>
                Voir tout
              </Link>
            </div>
            {elevesLoading ? (
              <div className="space-y-2">
                {[1,2,3].map(i=><div key={i} className="h-9 rounded-lg animate-pulse" style={{background:"var(--elevate-1)"}}/>)}
              </div>
            ) : (elevesData?.eleves ?? []).length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: "var(--m15-muted)" }}>Aucun élève inscrit</p>
            ) : (
              <div className="space-y-1">
                {(elevesData?.eleves ?? []).map((eleve) => (
                  <Link key={eleve.id} href={`/eleves/${eleve.id}`}>
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl cursor-pointer transition-colors"
                      onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background="var(--elevate-1)"}}
                      onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background="transparent"}}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(167,139,250,0.15)", color: "#A78BFA" }}>
                        {eleve.prenoms?.charAt(0) ?? eleve.nom.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "var(--m15-white)" }}>
                          {eleve.prenoms} {eleve.nom}
                        </p>
                        <p className="text-xs truncate" style={{ color: "var(--m15-muted)" }}>{eleve.matricule}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
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
        style={{ background: "linear-gradient(135deg, var(--m15-card2) 0%, rgba(0,201,167,0.08) 100%)", border: "1px solid rgba(0,201,167,0.15)" }}>
        <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(0,201,167,0.12) 0%, transparent 60%)" }} />
        <div className="relative z-10">
          <p className="text-sm mb-1" style={{ color: "var(--m15-muted)" }}>{today.charAt(0).toUpperCase() + today.slice(1)}</p>
          <h2 className="text-4xl font-bold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "#00C9A7" }}>
            Bonjour, {user?.prenoms} 👋
          </h2>
          <p className="text-base" style={{ color: "var(--m15-muted)" }}>Connecté en tant que <strong style={{ color: "#F5C842" }}>{user?.role}</strong>.</p>
        </div>
      </div>
      <div className="rounded-2xl p-6" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Votre espace personnel sera disponible dans le Module 02.</p>
      </div>
    </div>
  );
}

/* ─── Export ─────────────────────────────────────────────── */
export default function Dashboard() {
  const { user } = useAuth();
  if (user?.role === "dev") return <DevDashboard />;
  if (user?.role === "directeur") return <DirecteurDashboard />;
  if (user?.role === "censeur") return <CenseurDashboard />;
  if (user?.role === "educateur") { window.location.replace("/discipline/incidents"); return null; }
  if (user?.role === "infirmier") { window.location.replace("/infirmerie"); return null; }
  return <DefaultDashboard />;
}
