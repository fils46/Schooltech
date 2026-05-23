import { useState } from "react";
import {
  useGetApiAnalyticsPresences,
  useListerAnneesScolaires,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceArea,
} from "recharts";
import { UserMinus, AlertTriangle, CheckCircle, Clock } from "lucide-react";

function StatCard({ label, value, sub, color, icon: Icon }: {
  label: string; value: string | number; sub?: string; color: string; icon: React.ElementType;
}) {
  return (
    <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide font-medium mb-1" style={{ color: "var(--m15-muted)" }}>{label}</p>
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

export default function AnalysePresences() {
  const [trimestreFilter, setTrimestreFilter] = useState("all");
  const [anneeFilter, setAnneeFilter] = useState("");

  const trimestreParam = trimestreFilter !== "all" ? parseInt(trimestreFilter) : undefined;
  const anneeParam = anneeFilter || undefined;

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as any)?.annees ?? [];

  const { data, isLoading } = useGetApiAnalyticsPresences(
    { annee_scolaire_id: anneeParam, trimestre: trimestreParam },
  );
  const pres = (data as any)?.data;

  const stats = (pres?.stats_globales as { total_absences: number; non_justifiees: number; justifiees: number; taux_justification: number }) ?? {
    total_absences: 0, non_justifiees: 0, justifiees: 0, taux_justification: 0,
  };

  const topAbsents = (pres?.top_absents ?? []) as Array<{
    eleve_id: string; nom: string; prenoms: string; classe_id: string;
    total: number; non_justifie: number; justifie: number;
  }>;

  const parMatiere = (pres?.par_matiere ?? []) as Array<{ matiere: string; count: number }>;

  const evolutionSemaine = (pres?.evolution_semaine ?? []) as Array<{
    semaine: string; total: number; non_justifiee: number; justifiee: number;
  }>;

  const parJour = (pres?.par_jour_semaine ?? []) as Array<{ jour: string; count: number }>;

  const txPresence = stats.total_absences > 0
    ? Math.max(0, Math.round(100 - (stats.non_justifiees / Math.max(stats.total_absences, 1)) * 100))
    : 100;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Analyse présences & absences
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Suivi détaillé des absences de l'établissement
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={anneeFilter} onValueChange={setAnneeFilter}>
            <SelectTrigger className="w-40 text-sm" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Année active" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Année active</SelectItem>
              {annees.map((a: any) => (
                <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        </div>
      </div>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="p-5"><div className="h-16 animate-pulse rounded" style={{ background: "var(--m15-border)" }} /></CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total absences" value={stats.total_absences} color="#0080FF" icon={UserMinus} />
          <StatCard label="Non justifiées" value={stats.non_justifiees} sub={`${100 - stats.taux_justification}% des absences`} color="#FF4D6D" icon={AlertTriangle} />
          <StatCard label="Justifiées" value={stats.justifiees} sub={`${stats.taux_justification}% taux justification`} color="#00C9A7" icon={CheckCircle} />
          <StatCard label="Taux présence" value={`${txPresence}%`} color={txPresence >= 90 ? "#00C9A7" : txPresence >= 80 ? "#F5C842" : "#FF4D6D"} icon={Clock} />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evolution hebdomadaire */}
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Évolution absences par semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            {evolutionSemaine.length === 0 ? (
              <div className="h-56 flex items-center justify-center" style={{ color: "var(--m15-muted)" }}>
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={evolutionSemaine.slice(-16)} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.15)" />
                  <XAxis dataKey="semaine" tick={{ fill: "#8B9DC3", fontSize: 10 }} tickFormatter={(v: string) => v.slice(5)} />
                  <YAxis tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }} labelStyle={{ color: "#fff" }} />
                  <Legend wrapperStyle={{ color: "#8B9DC3", fontSize: 12 }} />
                  <Bar dataKey="justifiee" name="Justifiées" stackId="a" fill="#00C9A7" />
                  <Bar dataKey="non_justifiee" name="Non justifiées" stackId="a" fill="#FF4D6D" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Par jour de semaine */}
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Pic d'absences par jour de semaine
            </CardTitle>
          </CardHeader>
          <CardContent>
            {parJour.length === 0 ? (
              <div className="h-56 flex items-center justify-center" style={{ color: "var(--m15-muted)" }}>
                <p className="text-sm">Aucune donnée disponible</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={parJour} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.15)" />
                  <XAxis dataKey="jour" tick={{ fill: "#8B9DC3", fontSize: 11 }} tickFormatter={(v: string) => v.slice(0, 3)} />
                  <YAxis tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#0080FF" }} />
                  <Bar dataKey="count" name="Nb absences" fill="#0080FF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Par matière */}
      {parMatiere.length > 0 && (
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardHeader>
            <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Absences par matière</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={parMatiere} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.15)" />
                <XAxis type="number" tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                <YAxis type="category" dataKey="matiere" tick={{ fill: "#8B9DC3", fontSize: 11 }} width={100} />
                <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#F5C842" }} />
                <Bar dataKey="count" name="Nb absences" fill="#F5C842" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top absents */}
      <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" style={{ color: "#FF4D6D" }} />
            <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Top 10 élèves les plus absents
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                  {["Élève", "Total", "Non just.", "Justif.", "Taux present."].map(h => (
                    <th key={h} className="text-left py-3 px-5 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topAbsents.length === 0 ? (
                  <tr><td colSpan={5} className="py-10 text-center text-sm" style={{ color: "var(--m15-muted)" }}>Aucune donnée</td></tr>
                ) : topAbsents.map((e, i) => {
                  const txPres = e.total > 0 ? Math.round(100 - (e.non_justifie / e.total) * 100) : 100;
                  const couleur = e.non_justifie > 10 ? "#FF4D6D" : e.non_justifie > 5 ? "#F5C842" : "#00C9A7";
                  return (
                    <tr key={e.eleve_id} style={{ borderBottom: "1px solid var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(255,77,109,0.02)" }}>
                      <td className="py-3 px-5 font-medium" style={{ color: "var(--m15-white)" }}>{e.prenoms} {e.nom}</td>
                      <td className="py-3 px-5 font-bold" style={{ color: couleur }}>{e.total}</td>
                      <td className="py-3 px-5" style={{ color: "#FF4D6D" }}>{e.non_justifie}</td>
                      <td className="py-3 px-5" style={{ color: "#00C9A7" }}>{e.justifie}</td>
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full" style={{ background: "rgba(139,157,195,0.2)", maxWidth: 60 }}>
                            <div className="h-2 rounded-full" style={{ width: `${txPres}%`, background: txPres >= 90 ? "#00C9A7" : txPres >= 80 ? "#F5C842" : "#FF4D6D" }} />
                          </div>
                          <span className="text-xs" style={{ color: "var(--m15-muted)" }}>{txPres}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
