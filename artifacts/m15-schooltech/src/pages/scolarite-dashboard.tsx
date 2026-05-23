import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, DollarSign, AlertTriangle, CheckCircle,
  Users, ChevronRight, RefreshCw, Send,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import {
  useGetScolariteStatistiques,
  useListerClasses,
  useListerAnneesScolaires,
  usePostPaiementsRelancerImpayes,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

const STATUT_COLORS = { en_regle: "#00C9A7", partiel: "#F5C842", impaye: "#FF4D6D" };
const MODE_COLORS = ["#00C9A7", "#F5C842", "#0080FF", "#FF4D6D"];

function GaugeCircle({ value }: { value: number }) {
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (value / 100) * circ;
  const color = value >= 80 ? "#00C9A7" : value >= 50 ? "#F5C842" : "#FF4D6D";
  return (
    <svg width="140" height="140" className="mx-auto">
      <circle cx="70" cy="70" r={r} fill="none" stroke="var(--m15-card2)" strokeWidth="12" />
      <circle cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="12"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        transform="rotate(-90 70 70)" />
      <text x="70" y="70" textAnchor="middle" dominantBaseline="middle"
        fill={color} fontSize="22" fontWeight="700" fontFamily="'Syne', sans-serif">
        {value}%
      </text>
      <text x="70" y="90" textAnchor="middle" fill="var(--m15-muted)" fontSize="10">
        recouvrement
      </text>
    </svg>
  );
}

export default function ScolariteDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [classeId, setClasseId] = useState("");
  const [anneeScolaireId, setAnneeScolaireId] = useState("");

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { annees?: Array<{ id: string; libelle: string; active?: boolean }> } | undefined)?.annees ?? [];

  const { data: classesData } = useListerClasses({});
  const classes = (classesData as { classes?: Array<{ id: string; nom: string }> } | undefined)?.classes ?? [];

  const params = {
    ...(anneeScolaireId ? { annee_scolaire_id: anneeScolaireId } : {}),
    ...(classeId ? { classe_id: classeId } : {}),
  };
  const { data: statsData, isLoading, refetch } = useGetScolariteStatistiques(params);
  const stats = (statsData as { data?: Record<string, unknown> } | undefined)?.data as {
    taux_recouvrement: number;
    montant_total_du: number;
    montant_total_paye: number;
    montant_total_restant: number;
    nb_en_regle: number;
    nb_partiel: number;
    nb_impaye: number;
    total_eleves: number;
    par_mode_paiement: Record<string, number>;
    par_mois: Array<{ mois: string; montant: number }>;
    par_tranche: Record<string, number>;
  } | undefined;

  const relancerImpayes = usePostPaiementsRelancerImpayes();

  function fmt(n: number) {
    return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
  }

  const modeData = stats
    ? Object.entries(stats.par_mode_paiement ?? {}).map(([name, value]) => ({ name, value }))
    : [];

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--m15-navy)" }}>
      {/* En-tête */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)", fontSize: 26, fontWeight: 700 }}>
            Scolarité — Tableau de bord
          </h1>
          <p style={{ color: "var(--m15-muted)", fontSize: 14 }}>Suivi du recouvrement des frais scolaires</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={anneeScolaireId} onValueChange={setAnneeScolaireId}>
            <SelectTrigger className="w-44" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Année scolaire" />
            </SelectTrigger>
            <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              {annees.map(a => <SelectItem key={a.id} value={a.id} style={{ color: "var(--m15-white)" }}>{a.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classeId} onValueChange={setClasseId}>
            <SelectTrigger className="w-40" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Toutes les classes" />
            </SelectTrigger>
            <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <SelectItem value="__all__" style={{ color: "var(--m15-white)" }}>Toutes les classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id} style={{ color: "var(--m15-white)" }}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()}
            style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "var(--m15-card)" }} />)}
        </div>
      ) : stats ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {/* Jauge taux */}
            <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="pt-4">
                <GaugeCircle value={stats.taux_recouvrement ?? 0} />
              </CardContent>
            </Card>

            <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" style={{ color: "#00C9A7" }} />
                  <span style={{ color: "var(--m15-muted)", fontSize: 13 }}>Encaissé</span>
                </div>
                <p style={{ color: "#00C9A7", fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
                  {fmt(stats.montant_total_paye)}
                </p>
                <p style={{ color: "var(--m15-muted)", fontSize: 12 }}>sur {fmt(stats.montant_total_du)}</p>
              </CardContent>
            </Card>

            <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" style={{ color: "#FF4D6D" }} />
                  <span style={{ color: "var(--m15-muted)", fontSize: 13 }}>Restant</span>
                </div>
                <p style={{ color: "#FF4D6D", fontSize: 20, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
                  {fmt(stats.montant_total_restant)}
                </p>
                <p style={{ color: "var(--m15-muted)", fontSize: 12 }}>à recouvrer</p>
              </CardContent>
            </Card>

            <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" style={{ color: "#0080FF" }} />
                  <span style={{ color: "var(--m15-muted)", fontSize: 13 }}>{stats.total_eleves} élèves</span>
                </div>
                <div className="space-y-1">
                  {[
                    { label: "En règle", count: stats.nb_en_regle, color: "#00C9A7" },
                    { label: "Partiel", count: stats.nb_partiel, color: "#F5C842" },
                    { label: "Impayé", count: stats.nb_impaye, color: "#FF4D6D" },
                  ].map(({ label, count, color }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span style={{ color: "var(--m15-muted)", fontSize: 12 }}>{label}</span>
                      <Badge style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}>{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Bar chart encaissements par mois */}
            <Card className="lg:col-span-2" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardHeader className="pb-2">
                <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif", fontSize: 16 }}>
                  Encaissements par mois
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(stats.par_mois ?? []).length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={stats.par_mois}>
                      <XAxis dataKey="mois" tick={{ fill: "var(--m15-muted)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "var(--m15-muted)", fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                      <Tooltip
                        contentStyle={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                        formatter={(v: number) => [fmt(v), "Montant"]}
                      />
                      <Bar dataKey="montant" fill="#00C9A7" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <p style={{ color: "var(--m15-muted)", textAlign: "center", paddingTop: 40, fontSize: 14 }}>Aucune donnée</p>}
              </CardContent>
            </Card>

            {/* Pie chart modes paiement */}
            <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CardHeader className="pb-2">
                <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif", fontSize: 16 }}>
                  Modes de paiement
                </CardTitle>
              </CardHeader>
              <CardContent>
                {modeData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={140}>
                      <PieChart>
                        <Pie data={modeData} cx="50%" cy="50%" innerRadius={35} outerRadius={55}
                          dataKey="value" nameKey="name">
                          {modeData.map((_, i) => <Cell key={i} fill={MODE_COLORS[i % MODE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                          formatter={(v: number) => [fmt(v), ""]} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1 mt-2">
                      {modeData.map((d, i) => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: MODE_COLORS[i % MODE_COLORS.length] }} />
                            <span style={{ color: "var(--m15-muted)" }}>{d.name}</span>
                          </div>
                          <span style={{ color: "var(--m15-white)" }}>{fmt(d.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p style={{ color: "var(--m15-muted)", textAlign: "center", paddingTop: 40, fontSize: 14 }}>Aucune donnée</p>}
              </CardContent>
            </Card>
          </div>

          {/* Alertes */}
          {stats.nb_impaye > 0 && (
            <Card style={{ background: "var(--m15-card)", border: "1px solid rgba(255,77,109,0.3)" }}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: "rgba(255,77,109,0.15)" }}>
                      <AlertTriangle className="h-5 w-5" style={{ color: "#FF4D6D" }} />
                    </div>
                    <div>
                      <p style={{ color: "var(--m15-white)", fontWeight: 600 }}>
                        <span style={{ color: "#FF4D6D" }}>{stats.nb_impaye}</span> élève(s) avec solde impayé
                      </p>
                      <p style={{ color: "var(--m15-muted)", fontSize: 13 }}>
                        + {stats.nb_partiel} en paiement partiel
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline"
                      style={{ borderColor: "rgba(255,77,109,0.4)", color: "#FF4D6D" }}
                      onClick={() => navigate("/scolarite/impayes")}>
                      <Users className="h-4 w-4 mr-1" /> Voir la liste
                    </Button>
                    {classeId && (
                      <Button size="sm"
                        style={{ background: "#FF4D6D", color: "white" }}
                        onClick={() => {
                          relancerImpayes.mutate(
                            { data: { classe_id: classeId, annee_scolaire_id: anneeScolaireId, type_relance: "notification" } } as Parameters<typeof relancerImpayes.mutate>[0],
                            {
                              onSuccess: (r: unknown) => {
                                const d = r as { data?: { envoyes?: number } };
                                toast({ title: `${d?.data?.envoyes ?? 0} relance(s) envoyée(s)` });
                              },
                            }
                          );
                        }}
                        disabled={relancerImpayes.isPending}>
                        <Send className="h-4 w-4 mr-1" /> Relancer tous
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardContent className="py-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--m15-muted)" }} />
            <p style={{ color: "var(--m15-muted)" }}>Sélectionnez une année scolaire pour voir les statistiques</p>
            <div className="flex gap-3 justify-center mt-4">
              <Button size="sm" onClick={() => navigate("/scolarite/frais-config")}
                style={{ background: "#00C9A7", color: "white" }}>
                Configurer les frais
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate("/scolarite/classe")}
                style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}>
                Gérer la scolarité
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
