import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetAnalyticsKpis,
  useGetAnalyticsPedagogique,
  useGetAnalyticsPresences,
  useListerAnneesScolaires,
} from "@workspace/api-client-react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import {
  Users, TrendingUp, AlertTriangle, MessageSquare,
  Package, BarChart3, Award, BookOpen, ArrowUpRight, ArrowDownRight, Minus,
  RefreshCw, FileDown,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ─── KPI Card ────────────────────────────────────────────────── */
function KpiCard({
  title, value, subtitle, icon: Icon, color, trend,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>
              {title}
            </p>
            <p className="text-2xl font-bold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              {value}
            </p>
            {subtitle && (
              <p className="text-xs truncate" style={{ color: "var(--m15-muted)" }}>{subtitle}</p>
            )}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ml-3"
            style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
        {trend && (
          <div className="mt-3 flex items-center gap-1">
            {trend === "up" && <ArrowUpRight className="w-3 h-3" style={{ color: "#00C9A7" }} />}
            {trend === "down" && <ArrowDownRight className="w-3 h-3" style={{ color: "#FF4D6D" }} />}
            {trend === "neutral" && <Minus className="w-3 h-3" style={{ color: "var(--m15-muted)" }} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Page principale ─────────────────────────────────────────── */
export default function DashboardAnalytique() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const [trimestreFilter, setTrimestreFilter] = useState<string>("all");
  const [anneeFilter, setAnneeFilter] = useState<string>("");

  const trimestreParam = trimestreFilter !== "all" ? parseInt(trimestreFilter) : undefined;
  const anneeParam = anneeFilter || undefined;

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as any)?.annees ?? [];

  const { data: kpisData, isLoading: kpisLoading, refetch: refetchKpis } = useGetAnalyticsKpis(
    { annee_scolaire_id: anneeParam, trimestre: trimestreParam },
  );
  const { data: pedaData, isLoading: pedaLoading } = useGetAnalyticsPedagogique(
    { annee_scolaire_id: anneeParam, trimestre: trimestreParam },
  );
  const { data: presencesData } = useGetAnalyticsPresences(
    { annee_scolaire_id: anneeParam, trimestre: trimestreParam },
  );

  const kpis = (kpisData as any)?.data;
  const peda = (pedaData as any)?.data;
  const presences = (presencesData as any)?.data;

  const parClasse = (peda?.par_classe ?? []) as Array<{
    classe_id: string; nom_classe: string; effectif: number; moyenne: string | null;
  }>;

  const evolutionSemaine = ((presences?.evolution_semaine ?? []) as Array<{
    semaine: string; total: number; non_justifiee: number; justifiee: number;
  }>).slice(-12);

  const elevesAttention = [
    ...((peda?.eleves_en_difficulte ?? []) as Array<{
      eleve_id: string; nom: string; prenoms: string; classe_id: string; moyenne: string | null;
    }>),
  ].slice(0, 5);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Tableau de bord analytique
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Vue d'ensemble des performances de l'établissement
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Sélecteur année */}
          <Select value={anneeFilter || "__all__"} onValueChange={v => setAnneeFilter(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-40 text-sm" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Année active" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Année active</SelectItem>
              {annees.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sélecteur trimestre */}
          <Select value={trimestreFilter} onValueChange={setTrimestreFilter}>
            <SelectTrigger className="w-36 text-sm" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Trimestre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toute l'année</SelectItem>
              <SelectItem value="1">Trimestre 1</SelectItem>
              <SelectItem value="2">Trimestre 2</SelectItem>
              <SelectItem value="3">Trimestre 3</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => refetchKpis()}
            style={{ borderColor: "var(--m15-border)", color: "var(--m15-muted)" }}>
            <RefreshCw className="w-4 h-4" />
          </Button>

          <Button size="sm" onClick={() => navigate("/rapports-exports")}
            style={{ background: "#00C9A7", color: "var(--m15-navy)", fontWeight: 600 }}>
            <FileDown className="w-4 h-4 mr-2" />
            Rapport
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {kpisLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <Card key={i} style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="p-5">
                <div className="h-16 animate-pulse rounded" style={{ background: "var(--m15-border)" }} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <KpiCard
            title="Total élèves"
            value={kpis?.effectifs?.total_eleves ?? "—"}
            subtitle="Élèves actifs inscrits"
            icon={Users}
            color="#00C9A7"
          />
          <KpiCard
            title="Moyenne générale"
            value={kpis?.performances?.moyenne_generale ? `${kpis.performances.moyenne_generale}/20` : "—"}
            subtitle={`${kpis?.performances?.total_evaluations ?? 0} évaluations`}
            icon={TrendingUp}
            color="#F5C842"
          />
          <KpiCard
            title="Taux réussite"
            value={kpis?.performances?.taux_reussite != null ? `${kpis.performances.taux_reussite}%` : "—"}
            subtitle="Note ≥ 10/20"
            icon={Award}
            color="#0080FF"
          />
          <KpiCard
            title="Absences non justif."
            value={kpis?.presences?.absences_non_justifiees ?? 0}
            subtitle={`${kpis?.presences?.total_absences_trimestre ?? 0} absences totales`}
            icon={AlertTriangle}
            color="#FF4D6D"
          />
          <KpiCard
            title="Alertes"
            value={(kpis?.activite?.stocks_critiques ?? 0) + (kpis?.activite?.messages_non_lus ?? 0)}
            subtitle={`${kpis?.activite?.messages_non_lus ?? 0} msg · ${kpis?.activite?.stocks_critiques ?? 0} stocks`}
            icon={Package}
            color="#FF4D6D"
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Moyennes par classe */}
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Moyennes par classe
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pedaLoading ? (
              <div className="h-64 animate-pulse rounded" style={{ background: "var(--m15-border)" }} />
            ) : parClasse.length === 0 ? (
              <div className="h-64 flex items-center justify-center" style={{ color: "var(--m15-muted)" }}>
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={parClasse} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.15)" />
                  <XAxis dataKey="nom_classe" tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                  <YAxis domain={[0, 20]} tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--m15-card)", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }}
                    labelStyle={{ color: "#fff" }}
                    itemStyle={{ color: "#00C9A7" }}
                  />
                  <ReferenceLine y={10} stroke="#FF4D6D" strokeDasharray="4 4" />
                  <Bar dataKey="moyenne" name="Moyenne /20" fill="#00C9A7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Evolution absences */}
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Absences hebdomadaires (12 dernières semaines)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evolutionSemaine.length === 0 ? (
              <div className="h-64 flex items-center justify-center" style={{ color: "var(--m15-muted)" }}>
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={evolutionSemaine} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.15)" />
                  <XAxis
                    dataKey="semaine"
                    tick={{ fill: "#8B9DC3", fontSize: 10 }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--m15-card)", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }}
                    labelStyle={{ color: "#fff" }}
                  />
                  <Legend wrapperStyle={{ color: "var(--m15-muted)", fontSize: 12 }} />
                  <Bar dataKey="justifiee" name="Justifiées" stackId="a" fill="#00C9A7" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="non_justifiee" name="Non justifiées" stackId="a" fill="#FF4D6D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tableau performances par classe */}
      <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <CardHeader>
          <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            Performances par classe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {parClasse.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "var(--m15-muted)" }}>
              Aucune donnée disponible pour cette période.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                    {["Classe", "Effectif", "Moyenne /20", "Statut"].map(h => (
                      <th key={h} className="text-left py-3 px-4 font-semibold text-xs uppercase tracking-wide"
                        style={{ color: "var(--m15-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parClasse.map((c, i) => {
                    const moy = c.moyenne ? parseFloat(c.moyenne) : null;
                    const couleur = moy == null ? "#8B9DC3"
                      : moy < 8 ? "#FF4D6D"
                      : moy < 10 ? "#F5C842"
                      : "#00C9A7";
                    return (
                      <tr key={c.classe_id}
                        style={{ borderBottom: "1px solid var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(0,201,167,0.02)" }}>
                        <td className="py-3 px-4 font-medium" style={{ color: "var(--m15-white)" }}>{c.nom_classe}</td>
                        <td className="py-3 px-4" style={{ color: "var(--m15-muted)" }}>{c.effectif}</td>
                        <td className="py-3 px-4 font-bold" style={{ color: couleur }}>
                          {moy != null ? `${moy.toFixed(2)}/20` : "—"}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            style={{
                              background: moy == null ? "rgba(139,157,195,0.15)" : moy < 8 ? "rgba(255,77,109,0.15)" : moy < 10 ? "rgba(245,200,66,0.15)" : "rgba(0,201,167,0.15)",
                              color: couleur,
                              border: `1px solid ${couleur}40`,
                            }}
                          >
                            {moy == null ? "—" : moy < 8 ? "Critique" : moy < 10 ? "À surveiller" : "Satisfaisant"}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Elèves nécessitant attention */}
      {elevesAttention.length > 0 && (
        <Card style={{ background: "var(--m15-card)", border: "1px solid rgba(255,77,109,0.3)" }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" style={{ color: "#FF4D6D" }} />
              <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                Élèves nécessitant une attention particulière
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {elevesAttention.map(e => (
                <div key={e.eleve_id} className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
                      {e.prenoms} {e.nom}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>Moy: {e.moyenne ?? "—"}/20</p>
                  </div>
                  <Badge style={{ background: "rgba(255,77,109,0.2)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.4)" }}>
                    &lt; 8
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liens rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Analyse pédagogique", href: "/analyse-pedagogique", icon: BarChart3, color: "#00C9A7" },
          { label: "Analyse présences", href: "/analyse-presences", icon: Users, color: "#0080FF" },
          { label: "Rapports & Exports", href: "/rapports-exports", icon: FileDown, color: "#F5C842" },
          { label: "Clubs & Infirmerie", href: "/analytics-complementaires", icon: Award, color: "var(--m15-muted)" },
        ].map(link => (
          <Button key={link.href} variant="outline" className="h-16 flex flex-col gap-1"
            onClick={() => navigate(link.href)}
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
            <link.icon className="w-5 h-5" style={{ color: link.color }} />
            <span className="text-xs">{link.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
