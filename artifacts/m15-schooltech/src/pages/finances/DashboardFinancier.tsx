import { useState } from "react";
import {
  useGetDashboardFinancier,
  useGetEvolutionFinanciere,
  useListerFeuillesHeures,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, ChevronRight, Users,
} from "lucide-react";
import { useLocation } from "wouter";

const MOIS_LABELS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const STATUT_COLORS: Record<string, string> = {
  brouillon: "bg-gray-500",
  soumise: "bg-yellow-500",
  validee: "bg-cyan-500",
  payee: "bg-green-600",
  rejetee: "bg-red-600",
};

function formatFCFA(n: number): string {
  return n.toLocaleString("fr-CI") + " FCFA";
}

type DashboardData = {
  mois: number;
  annee: number;
  honoraires: {
    a_verser: number;
    verses: number;
    en_attente_validation: number;
    lignes: Array<{
      prof_nom: string;
      prof_prenoms: string | null;
      type_libelle: string;
      nb_heures_validees: string | null;
      montant_net: string | null;
      statut: string;
    }>;
  };
  prestations: {
    encaissees: number;
    factures_en_attente: number;
    montant_impayes: number;
  };
  balance: {
    recettes: number;
    charges: number;
    nette: number;
  };
};

type EvolutionPoint = {
  mois: number;
  annee: number;
  honoraires: number;
  prestations: number;
  balance: number;
};

export default function DashboardFinancier() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const now = new Date();
  const [mois, setMois] = useState(String(now.getMonth() + 1));
  const [annee] = useState(String(now.getFullYear()));

  const { data: rawDash } = useGetDashboardFinancier({ mois: parseInt(mois), annee: parseInt(annee) });
  const { data: rawEvol } = useGetEvolutionFinanciere({});

  const dash = (rawDash as { data?: DashboardData })?.data;
  const evolution: EvolutionPoint[] = ((rawEvol as { data?: EvolutionPoint[] })?.data) ?? [];

  const chartData = evolution.map(p => ({
    label: `${MOIS_LABELS[p.mois]} ${p.annee}`,
    honoraires: p.honoraires,
    prestations: p.prestations,
    balance: p.balance,
  }));

  if (user?.role !== "directeur" && user?.role !== "dev") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--m15-muted)]">Accès réservé au directeur.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
            <DollarSign className="h-7 w-7 text-[var(--m15-gold)]" />
            Finances
          </h1>
          <p className="text-[var(--m15-muted)] text-sm mt-1">Tableau de bord financier de l'établissement</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={mois} onValueChange={setMois}>
            <SelectTrigger className="w-32 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
              {MOIS_LABELS.slice(1).map((l, i) => (
                <SelectItem key={i + 1} value={String(i + 1)} className="text-[var(--m15-white)]">{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[var(--m15-muted)] font-bold">{annee}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <p className="text-[var(--m15-muted)] text-xs uppercase tracking-wider mb-1">Honoraires à verser</p>
            <p className="text-2xl font-bold" style={{ color: "#F5C842" }}>
              {formatFCFA(dash?.honoraires?.a_verser ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <p className="text-[var(--m15-muted)] text-xs uppercase tracking-wider mb-1">Honoraires versés</p>
            <p className="text-2xl font-bold" style={{ color: "#00C9A7" }}>
              {formatFCFA(dash?.honoraires?.verses ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <p className="text-[var(--m15-muted)] text-xs uppercase tracking-wider mb-1">Prestations encaissées</p>
            <p className="text-2xl font-bold text-green-400">
              {formatFCFA(dash?.prestations?.encaissees ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <p className="text-[var(--m15-muted)] text-xs uppercase tracking-wider mb-1">Factures en attente</p>
            <p className="text-2xl font-bold text-red-400">{dash?.prestations?.factures_en_attente ?? 0}</p>
            <p className="text-[var(--m15-muted)] text-xs">{formatFCFA(dash?.prestations?.montant_impayes ?? 0)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Balance du mois */}
      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--m15-white)] text-base">Balance du mois — {MOIS_LABELS[parseInt(mois)]} {annee}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-6 text-center">
            <div>
              <p className="text-[var(--m15-muted)] text-sm mb-1">Recettes</p>
              <p className="text-2xl font-bold text-green-400">{formatFCFA(dash?.balance?.recettes ?? 0)}</p>
              <p className="text-[var(--m15-muted)] text-xs">Prestations encaissées</p>
            </div>
            <div>
              <p className="text-[var(--m15-muted)] text-sm mb-1">Charges</p>
              <p className="text-2xl font-bold text-red-400">{formatFCFA(dash?.balance?.charges ?? 0)}</p>
              <p className="text-[var(--m15-muted)] text-xs">Honoraires versés</p>
            </div>
            <div>
              <p className="text-[var(--m15-muted)] text-sm mb-1">Balance nette</p>
              <p className={`text-2xl font-bold ${(dash?.balance?.nette ?? 0) >= 0 ? "text-[var(--m15-cyan)]" : "text-red-400"}`}>
                {formatFCFA(dash?.balance?.nette ?? 0)}
              </p>
              <div className="flex justify-center mt-1">
                {(dash?.balance?.nette ?? 0) >= 0
                  ? <TrendingUp className="h-4 w-4 text-[var(--m15-cyan)]" />
                  : <TrendingDown className="h-4 w-4 text-red-400" />
                }
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Graphique évolution 6 mois */}
      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--m15-white)] text-base">Évolution financière — 6 derniers mois</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,201,167,0.1)" />
              <XAxis dataKey="label" tick={{ fill: "#8B9DC3", fontSize: 12 }} />
              <YAxis tick={{ fill: "#8B9DC3", fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }}
                labelStyle={{ color: "#fff" }}
                formatter={(value: number) => [formatFCFA(value)]}
              />
              <Legend />
              <Line type="monotone" dataKey="honoraires" name="Honoraires versés" stroke="#FF4D6D" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="prestations" name="Prestations encaissées" stroke="#00C9A7" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="balance" name="Balance nette" stroke="#F5C842" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Honoraires ce mois */}
      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-[var(--m15-white)] text-base">Honoraires ce mois</CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="text-[var(--m15-cyan)] hover:text-[var(--m15-white)]"
            onClick={() => navigate("/finances/honoraires")}
          >
            Voir tout <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          {(!dash?.honoraires?.lignes || dash.honoraires.lignes.length === 0) ? (
            <p className="text-[var(--m15-muted)] text-sm text-center py-4">Aucune feuille soumise ce mois</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--m15-border)]">
                    <th className="text-left py-2 px-3 text-[var(--m15-muted)] font-medium">Professeur</th>
                    <th className="text-left py-2 px-3 text-[var(--m15-muted)] font-medium">Type</th>
                    <th className="text-right py-2 px-3 text-[var(--m15-muted)] font-medium">H. validées</th>
                    <th className="text-right py-2 px-3 text-[var(--m15-muted)] font-medium">Montant net</th>
                    <th className="text-center py-2 px-3 text-[var(--m15-muted)] font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {dash.honoraires.lignes.map((l, idx) => (
                    <tr key={idx} className="border-b border-[var(--m15-border)] hover:bg-[var(--elevate-1)]">
                      <td className="py-2 px-3 text-[var(--m15-white)]">{l.prof_prenoms} {l.prof_nom}</td>
                      <td className="py-2 px-3 text-[var(--m15-muted)]">{l.type_libelle}</td>
                      <td className="py-2 px-3 text-right text-[var(--m15-white)]">{l.nb_heures_validees ?? "—"}</td>
                      <td className="py-2 px-3 text-right text-[var(--m15-white)] font-medium">
                        {l.montant_net ? formatFCFA(parseFloat(l.montant_net)) : "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={`${STATUT_COLORS[l.statut] ?? "bg-gray-500"} text-white text-xs`}>
                          {l.statut}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={3} className="py-2 px-3 text-[var(--m15-cyan)]">Total à verser</td>
                    <td className="py-2 px-3 text-right text-[var(--m15-cyan)]">
                      {formatFCFA(dash.honoraires.a_verser)}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Prestations ce mois */}
      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-[var(--m15-white)] text-base">Prestations ce mois</CardTitle>
          <Button
            size="sm"
            variant="ghost"
            className="text-[var(--m15-cyan)] hover:text-[var(--m15-white)]"
            onClick={() => navigate("/finances/prestations")}
          >
            Voir tout <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-3xl font-bold text-green-400">{formatFCFA(dash?.prestations?.encaissees ?? 0)}</p>
              <p className="text-[var(--m15-muted)] text-sm mt-1">Encaissé</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-yellow-400">{formatFCFA(dash?.prestations?.montant_impayes ?? 0)}</p>
              <p className="text-[var(--m15-muted)] text-sm mt-1">Impayés</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <p className="text-3xl font-bold text-red-400">{dash?.prestations?.factures_en_attente ?? 0}</p>
              </div>
              <p className="text-[var(--m15-muted)] text-sm mt-1">Factures en attente</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
