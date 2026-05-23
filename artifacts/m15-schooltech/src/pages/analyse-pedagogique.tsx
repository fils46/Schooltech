import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetApiAnalyticsPedagogique,
  useListerAnneesScolaires,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Award, AlertTriangle, User } from "lucide-react";

/* ─── Couleur selon moyenne ──────────────────────────────────── */
function moyenneColor(moy: number | null): string {
  if (moy == null) return "#8B9DC3";
  if (moy < 8) return "#FF4D6D";
  if (moy < 10) return "#F5C842";
  if (moy < 14) return "#00C9A7";
  return "#0080FF";
}

function moyenneBadge(moy: number | null) {
  if (moy == null) return { label: "—", color: "#8B9DC3" };
  if (moy < 8) return { label: "Critique", color: "#FF4D6D" };
  if (moy < 10) return { label: "Insuffisant", color: "#F5C842" };
  if (moy < 12) return { label: "Passable", color: "#00C9A7" };
  if (moy < 14) return { label: "Assez bien", color: "#00C9A7" };
  if (moy < 16) return { label: "Bien", color: "#0080FF" };
  return { label: "Très bien", color: "#0080FF" };
}

export default function AnalysePedagogique() {
  const { user } = useAuth();
  const [trimestreFilter, setTrimestreFilter] = useState("all");
  const [anneeFilter, setAnneeFilter] = useState("");
  const [activeTab, setActiveTab] = useState("classes");

  const trimestreParam = trimestreFilter !== "all" ? parseInt(trimestreFilter) : undefined;
  const anneeParam = anneeFilter || undefined;

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as any)?.annees ?? [];

  const { data, isLoading } = useGetApiAnalyticsPedagogique(
    { annee_scolaire_id: anneeParam, trimestre: trimestreParam },
  );
  const peda = (data as any)?.data;

  const parClasse = (peda?.par_classe ?? []) as Array<{
    classe_id: string; nom_classe: string; effectif: number; moyenne: string | null;
  }>;
  const parMatiere = (peda?.par_matiere ?? []) as Array<{
    matiere: string; moyenne: string | null; nb_evaluations: number;
  }>;
  const parProf = (peda?.par_professeur ?? []) as Array<{
    professeur_id: string; nom?: string; prenoms?: string;
    nb_evaluations: number; moyenne: string | null;
  }>;
  const elevesEnDifficulte = (peda?.eleves_en_difficulte ?? []) as Array<{
    eleve_id: string; nom: string; prenoms: string; classe_id: string; moyenne: string | null;
  }>;
  const elevesExcellents = (peda?.eleves_excellents ?? []) as Array<{
    eleve_id: string; nom: string; prenoms: string; classe_id: string; moyenne: string | null;
  }>;

  const chartDataClasse = parClasse.map(c => ({
    nom: c.nom_classe,
    moyenne: c.moyenne ? parseFloat(c.moyenne) : 0,
    effectif: c.effectif,
  }));
  const chartDataMatiere = parMatiere.map(m => ({
    matiere: m.matiere.length > 12 ? m.matiere.slice(0, 12) + "…" : m.matiere,
    moyenne: m.moyenne ? parseFloat(m.moyenne) : 0,
    nb_evals: m.nb_evaluations,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Analyse pédagogique
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Performances par classe, matière, professeur et élèves
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="p-6">
                <div className="h-48 animate-pulse rounded" style={{ background: "var(--m15-border)" }} />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            {[
              { value: "classes", label: "Par classe" },
              { value: "matieres", label: "Par matière" },
              { value: "professeurs", label: "Par professeur" },
              { value: "difficulte", label: "En difficulté" },
              { value: "excellents", label: "Palmarès" },
            ].map(t => (
              <TabsTrigger key={t.value} value={t.value}
                style={{ color: activeTab === t.value ? "#00C9A7" : "var(--m15-muted)" }}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Par classe */}
          <TabsContent value="classes" className="space-y-4 mt-4">
            {chartDataClasse.length > 0 && (
              <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                <CardHeader><CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Graphique moyennes par classe</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartDataClasse} margin={{ top: 0, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.15)" />
                      <XAxis dataKey="nom" tick={{ fill: "#8B9DC3", fontSize: 11 }} angle={-30} textAnchor="end" />
                      <YAxis domain={[0, 20]} tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#00C9A7" }} />
                      <ReferenceLine y={10} stroke="#FF4D6D" strokeDasharray="4 4" label={{ value: "10", fill: "#FF4D6D", fontSize: 11 }} />
                      <Bar dataKey="moyenne" name="Moyenne /20" fill="#00C9A7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                        {["Classe", "Effectif", "Moyenne /20", "Mention"].map(h => (
                          <th key={h} className="text-left py-3 px-5 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parClasse.length === 0 ? (
                        <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: "var(--m15-muted)" }}>Aucune donnée</td></tr>
                      ) : parClasse.map((c, i) => {
                        const moy = c.moyenne ? parseFloat(c.moyenne) : null;
                        const badge = moyenneBadge(moy);
                        return (
                          <tr key={c.classe_id} style={{ borderBottom: "1px solid var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(0,201,167,0.02)" }}>
                            <td className="py-3 px-5 font-medium" style={{ color: "var(--m15-white)" }}>{c.nom_classe}</td>
                            <td className="py-3 px-5" style={{ color: "var(--m15-muted)" }}>{c.effectif}</td>
                            <td className="py-3 px-5 font-bold" style={{ color: moyenneColor(moy) }}>{moy != null ? `${moy.toFixed(2)}/20` : "—"}</td>
                            <td className="py-3 px-5">
                              <Badge style={{ background: `${badge.color}20`, color: badge.color, border: `1px solid ${badge.color}40` }}>
                                {badge.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Par matière */}
          <TabsContent value="matieres" className="space-y-4 mt-4">
            {chartDataMatiere.length > 0 && (
              <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                <CardHeader><CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Moyennes par matière</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={chartDataMatiere} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.15)" />
                      <XAxis type="number" domain={[0, 20]} tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                      <YAxis type="category" dataKey="matiere" tick={{ fill: "#8B9DC3", fontSize: 11 }} width={90} />
                      <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#F5C842" }} />
                      <ReferenceLine x={10} stroke="#FF4D6D" strokeDasharray="4 4" />
                      <Bar dataKey="moyenne" name="Moyenne /20" fill="#F5C842" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                      {["Matière", "Moyenne /20", "Nb évaluations", "Mention"].map(h => (
                        <th key={h} className="text-left py-3 px-5 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parMatiere.length === 0 ? (
                      <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: "var(--m15-muted)" }}>Aucune donnée</td></tr>
                    ) : parMatiere.map((m, i) => {
                      const moy = m.moyenne ? parseFloat(m.moyenne) : null;
                      const badge = moyenneBadge(moy);
                      return (
                        <tr key={m.matiere} style={{ borderBottom: "1px solid var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(0,201,167,0.02)" }}>
                          <td className="py-3 px-5 font-medium" style={{ color: "var(--m15-white)" }}>{m.matiere}</td>
                          <td className="py-3 px-5 font-bold" style={{ color: moyenneColor(moy) }}>{moy != null ? `${moy.toFixed(2)}/20` : "—"}</td>
                          <td className="py-3 px-5" style={{ color: "var(--m15-muted)" }}>{m.nb_evaluations}</td>
                          <td className="py-3 px-5">
                            <Badge style={{ background: `${badge.color}20`, color: badge.color, border: `1px solid ${badge.color}40` }}>{badge.label}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Par professeur */}
          <TabsContent value="professeurs" className="space-y-4 mt-4">
            <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                      {["Professeur", "Nb évaluations", "Moyenne classes"].map(h => (
                        <th key={h} className="text-left py-3 px-5 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parProf.length === 0 ? (
                      <tr><td colSpan={3} className="py-10 text-center text-sm" style={{ color: "var(--m15-muted)" }}>Aucune donnée</td></tr>
                    ) : parProf.map((p, i) => {
                      const moy = p.moyenne ? parseFloat(p.moyenne) : null;
                      return (
                        <tr key={p.professeur_id + i} style={{ borderBottom: "1px solid var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(0,201,167,0.02)" }}>
                          <td className="py-3 px-5 font-medium" style={{ color: "var(--m15-white)" }}>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                                style={{ background: "rgba(0,201,167,0.15)", color: "#00C9A7" }}>
                                <User className="w-3 h-3" />
                              </div>
                              {p.nom && p.prenoms ? `${p.prenoms} ${p.nom}` : "Anonyme"}
                            </div>
                          </td>
                          <td className="py-3 px-5" style={{ color: "var(--m15-muted)" }}>{p.nb_evaluations}</td>
                          <td className="py-3 px-5 font-bold" style={{ color: moyenneColor(moy) }}>
                            {moy != null ? `${moy.toFixed(2)}/20` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Élèves en difficulté */}
          <TabsContent value="difficulte" className="mt-4">
            <Card style={{ background: "var(--m15-card)", border: "1px solid rgba(255,77,109,0.3)" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" style={{ color: "#FF4D6D" }} />
                  <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                    Élèves en difficulté (moyenne &lt; 8/20)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                      {["Élève", "Classe", "Moyenne /20"].map(h => (
                        <th key={h} className="text-left py-3 px-5 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {elevesEnDifficulte.length === 0 ? (
                      <tr><td colSpan={3} className="py-10 text-center text-sm" style={{ color: "var(--m15-muted)" }}>Aucun élève en difficulté</td></tr>
                    ) : elevesEnDifficulte.map((e, i) => (
                      <tr key={e.eleve_id} style={{ borderBottom: "1px solid var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(255,77,109,0.02)" }}>
                        <td className="py-3 px-5 font-medium" style={{ color: "var(--m15-white)" }}>{e.prenoms} {e.nom}</td>
                        <td className="py-3 px-5" style={{ color: "var(--m15-muted)" }}>{e.classe_id.slice(0, 8)}…</td>
                        <td className="py-3 px-5 font-bold" style={{ color: "#FF4D6D" }}>
                          {e.moyenne ? `${parseFloat(e.moyenne).toFixed(2)}/20` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Palmarès */}
          <TabsContent value="excellents" className="mt-4">
            <Card style={{ background: "var(--m15-card)", border: "1px solid rgba(245,200,66,0.3)" }}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5" style={{ color: "#F5C842" }} />
                  <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                    Palmarès — Élèves excellents (moyenne ≥ 16/20)
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                      {["Rang", "Élève", "Classe", "Moyenne /20"].map(h => (
                        <th key={h} className="text-left py-3 px-5 font-semibold text-xs uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {elevesExcellents.length === 0 ? (
                      <tr><td colSpan={4} className="py-10 text-center text-sm" style={{ color: "var(--m15-muted)" }}>Aucun élève excellent pour cette période</td></tr>
                    ) : elevesExcellents.map((e, i) => (
                      <tr key={e.eleve_id} style={{ borderBottom: "1px solid var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(245,200,66,0.02)" }}>
                        <td className="py-3 px-5 font-bold text-base" style={{ color: i === 0 ? "#F5C842" : i === 1 ? "#8B9DC3" : "#CD7F32" }}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </td>
                        <td className="py-3 px-5 font-medium" style={{ color: "var(--m15-white)" }}>{e.prenoms} {e.nom}</td>
                        <td className="py-3 px-5" style={{ color: "var(--m15-muted)" }}>{e.classe_id.slice(0, 8)}…</td>
                        <td className="py-3 px-5 font-bold" style={{ color: "#0080FF" }}>
                          {e.moyenne ? `${parseFloat(e.moyenne).toFixed(2)}/20` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
