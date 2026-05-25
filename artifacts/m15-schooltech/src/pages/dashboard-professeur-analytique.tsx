import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetAnalyticsProfesseur,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Users, FileCheck, MessageSquare, UserMinus, BookOpen, TrendingUp,
} from "lucide-react";

function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide font-medium mb-1" style={{ color: "var(--m15-muted)" }}>{title}</p>
            <p className="text-2xl font-bold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>{value}</p>
            {sub && <p className="text-xs mt-1" style={{ color: "var(--m15-muted)" }}>{sub}</p>}
          </div>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
            <Icon className="w-5 h-5" style={{ color }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardProfesseurAnalytique() {
  const { user } = useAuth();
  const [trimestre, setTrimestre] = useState("all");

  const trimestreParam = trimestre !== "all" ? parseInt(trimestre) : undefined;

  const { data, isLoading } = useGetAnalyticsProfesseur({ trimestre: trimestreParam });
  const d = (data as any)?.data;

  const mesClasses = (d?.mes_classes ?? []) as Array<{
    classe_id: string; matiere: string; nom_classe: string;
  }>;
  const moyennesParClasse = (d?.moyennes_par_classe ?? []) as Array<{
    classe_id: string; moyenne: string | null; nb_evaluations: number;
  }>;

  // Enrichir les moyennes avec le nom de la classe
  const chartData = moyennesParClasse.map(m => {
    const c = mesClasses.find(cl => cl.classe_id === m.classe_id);
    return {
      nom: c?.nom_classe ?? m.classe_id.slice(0, 8),
      moyenne: m.moyenne ? parseFloat(m.moyenne) : 0,
      nb_evals: m.nb_evaluations,
    };
  });

  // Classes uniques avec leur matière
  const classesUniques = mesClasses.reduce<{ classe_id: string; nom_classe: string; matieres: string[] }[]>((acc, c) => {
    const existing = acc.find(x => x.classe_id === c.classe_id);
    if (existing) { existing.matieres.push(c.matiere); }
    else acc.push({ classe_id: c.classe_id, nom_classe: c.nom_classe, matieres: [c.matiere] });
    return acc;
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Mon tableau de bord
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            {user?.prenoms} {user?.nom} — Professeur
          </p>
        </div>
        <Select value={trimestre} onValueChange={setTrimestre}>
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
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="p-5"><div className="h-16 animate-pulse rounded" style={{ background: "var(--m15-border)" }} /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            title="Mes élèves"
            value={d?.total_eleves ?? 0}
            sub={`${classesUniques.length} classe(s)`}
            icon={Users}
            color="#00C9A7"
          />
          <KpiCard
            title="Évaluations"
            value={d?.nb_evaluations_trimestre ?? 0}
            sub="ce trimestre"
            icon={FileCheck}
            color="#F5C842"
          />
          <KpiCard
            title="Messages non lus"
            value={d?.messages_non_lus ?? 0}
            icon={MessageSquare}
            color={d?.messages_non_lus > 0 ? "#FF4D6D" : "#8B9DC3"}
          />
          <KpiCard
            title="Absences signalées"
            value={d?.total_absences_mes_cours ?? 0}
            sub="dans mes cours"
            icon={UserMinus}
            color="#0080FF"
          />
        </div>
      )}

      {/* Moyennes par classe */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" style={{ color: "#00C9A7" }} />
              <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                Moyenne par classe
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-56 flex items-center justify-center" style={{ color: "var(--m15-muted)" }}>
                <p className="text-sm">Aucune évaluation saisie</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.15)" />
                  <XAxis dataKey="nom" tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                  <YAxis domain={[0, 20]} tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: "var(--m15-card)", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }}
                    labelStyle={{ color: "#fff" }}
                    formatter={(value: number) => [`${value.toFixed(2)}/20`, "Moyenne"]}
                  />
                  <Bar dataKey="moyenne" name="Moyenne /20" fill="#00C9A7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Mes classes détails */}
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5" style={{ color: "#F5C842" }} />
              <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                Mes classes
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {classesUniques.length === 0 ? (
              <div className="h-56 flex items-center justify-center" style={{ color: "var(--m15-muted)" }}>
                <p className="text-sm">Aucune classe assignée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {classesUniques.map(c => {
                  const moyData = moyennesParClasse.find(m => m.classe_id === c.classe_id);
                  const moy = moyData?.moyenne ? parseFloat(moyData.moyenne) : null;
                  const couleur = moy == null ? "#8B9DC3" : moy < 8 ? "#FF4D6D" : moy < 10 ? "#F5C842" : "#00C9A7";
                  return (
                    <div key={c.classe_id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: "rgba(0,201,167,0.05)", border: "1px solid var(--m15-border)" }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>{c.nom_classe}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.matieres.map(mat => (
                            <span key={mat} className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842" }}>
                              {mat}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        {moy != null ? (
                          <>
                            <p className="text-lg font-bold" style={{ color: couleur }}>{moy.toFixed(2)}</p>
                            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>/20</p>
                          </>
                        ) : (
                          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>—</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* À faire */}
      <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <CardHeader>
          <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            À faire
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              {
                label: "Messages non lus",
                count: d?.messages_non_lus ?? 0,
                color: "#FF4D6D",
                href: "/messagerie",
              },
              {
                label: "Absences dans mes cours",
                count: d?.total_absences_mes_cours ?? 0,
                color: "#F5C842",
                href: "/absences",
              },
              {
                label: "Évaluations saisies ce trimestre",
                count: d?.nb_evaluations_trimestre ?? 0,
                color: "#00C9A7",
                href: "/evaluations",
              },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between p-3 rounded-xl"
                style={{ background: "rgba(139,157,195,0.05)", border: "1px solid var(--m15-border)" }}>
                <span className="text-sm" style={{ color: "var(--m15-muted)" }}>{item.label}</span>
                <Badge style={{ background: `${item.color}20`, color: item.color, border: `1px solid ${item.color}40`, minWidth: 28, justifyContent: "center" }}>
                  {item.count}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
