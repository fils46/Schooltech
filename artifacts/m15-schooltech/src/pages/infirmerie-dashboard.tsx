import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Heart, Plus, AlertTriangle, Clock, Users, Activity,
  TrendingUp, Package, ChevronRight, Stethoscope,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetInfirmerieStats,
  useGetInfirmerieConsultations,
  useGetInfirmerieStocksAlertes,
} from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const STATUT_COLORS: Record<string, string> = {
  en_cours: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  termine: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  renvoye_domicile: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  hospitalise: "bg-red-500/20 text-red-300 border-red-500/30",
};
const STATUT_LABELS: Record<string, string> = {
  en_cours: "En cours",
  termine: "Terminé",
  renvoye_domicile: "Renvoyé à domicile",
  hospitalise: "Hospitalisé",
};

export default function InfirmerieDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: statsData } = useGetInfirmerieStats();
  const { data: consultationsData } = useGetInfirmerieConsultations({ statut: "en_cours", limit: 5 });
  const { data: alertesData } = useGetInfirmerieStocksAlertes();

  const stats = statsData as {
    consultations_aujourd_hui?: number;
    consultations_en_cours?: number;
    consultations_mois?: number;
    consultations_trimestre?: number;
    articles_en_alerte?: number;
    motifs_frequents?: Array<{ motif: string; count: number }>;
    activite_30j?: Array<{ date: string; count: number }>;
  } | undefined;

  const consultationsEnCours = (consultationsData as { consultations?: Array<{
    id: string;
    eleve_nom?: string;
    eleve_prenoms?: string;
    eleve_photo?: string;
    classe_nom?: string;
    motif: string;
    heure_entree: string;
    statut: string;
  }> } | undefined)?.consultations ?? [];

  const alertes = (alertesData as { stocks?: Array<{
    id: string;
    nom: string;
    categorie: string;
    quantite: number;
    unite: string;
    seuil_alerte: number;
    statut_stock: string;
  }> } | undefined)?.stocks ?? [];

  const chartData = (stats?.activite_30j ?? []).slice(-14).map(d => ({
    date: new Date(d.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }),
    Consultations: d.count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
            <Heart className="h-7 w-7 text-rose-400" />
            Infirmerie
          </h1>
          <p className="text-[var(--m15-muted)] text-sm mt-1">Tableau de bord médical</p>
        </div>
        {["dev", "directeur", "censeur", "infirmier"].includes(user?.role ?? "") && (
          <Button
            onClick={() => navigate("/infirmerie/nouvelle-consultation")}
            className="bg-rose-600 hover:bg-rose-700 text-[var(--m15-white)] gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle consultation
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--m15-muted)] text-xs">Aujourd'hui</p>
                <p className="text-2xl font-bold text-[var(--m15-white)]">{stats?.consultations_aujourd_hui ?? 0}</p>
                <p className="text-[var(--m15-muted)] text-xs">consultations</p>
              </div>
              <Stethoscope className="h-8 w-8 text-rose-400 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--m15-muted)] text-xs">En cours</p>
                <p className="text-2xl font-bold text-yellow-400">{stats?.consultations_en_cours ?? 0}</p>
                <p className="text-[var(--m15-muted)] text-xs">élèves présents</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-400 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--m15-muted)] text-xs">Ce mois</p>
                <p className="text-2xl font-bold text-cyan-400">{stats?.consultations_mois ?? 0}</p>
                <p className="text-[var(--m15-muted)] text-xs">consultations</p>
              </div>
              <Activity className="h-8 w-8 text-cyan-400 opacity-70" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[var(--m15-muted)] text-xs">Stocks en alerte</p>
                <p className={`text-2xl font-bold ${(stats?.articles_en_alerte ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {stats?.articles_en_alerte ?? 0}
                </p>
                <p className="text-[var(--m15-muted)] text-xs">articles</p>
              </div>
              <Package className="h-8 w-8 text-orange-400 opacity-70" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Consultations en cours */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-400" />
                  Consultations en cours
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-cyan-400 hover:text-cyan-300 text-xs gap-1"
                  onClick={() => navigate("/infirmerie/consultations")}
                >
                  Tout voir <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {consultationsEnCours.length === 0 ? (
                <p className="text-[var(--m15-muted)] text-sm text-center py-4">Aucune consultation en cours</p>
              ) : (
                consultationsEnCours.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 bg-[var(--elevate-2)] rounded-lg hover:bg-[var(--m15-card2)] transition-colors cursor-pointer"
                    onClick={() => navigate(`/infirmerie/consultation/${c.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      {c.eleve_photo ? (
                        <img src={c.eleve_photo} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-[var(--m15-card2)] flex items-center justify-center">
                          <Users className="h-4 w-4 text-[var(--m15-muted)]" />
                        </div>
                      )}
                      <div>
                        <p className="text-[var(--m15-white)] text-sm font-medium">
                          {c.eleve_nom} {c.eleve_prenoms}
                        </p>
                        <p className="text-[var(--m15-muted)] text-xs">{c.classe_nom ?? "—"} · {c.motif}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--m15-muted)] text-xs">
                        {new Date(c.heure_entree).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <Badge className={STATUT_COLORS[c.statut] ?? ""} variant="outline">
                        {STATUT_LABELS[c.statut] ?? c.statut}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Activité 14j */}
          {chartData.length > 0 && (
            <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
              <CardHeader className="pb-2">
                <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  Activité des 14 derniers jours
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={chartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--m15-card2)" vertical={false} />
                    <XAxis dataKey="date" tick={{ fill: "var(--m15-muted)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "var(--m15-muted)", fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "var(--m15-card)", border: "1px solid #334155", borderRadius: "8px" }}
                      labelStyle={{ color: "var(--m15-white)" }}
                      itemStyle={{ color: "#f43f5e" }}
                    />
                    <Bar dataKey="Consultations" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Colonne droite */}
        <div className="space-y-4">
          {/* Motifs fréquents */}
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                Motifs fréquents
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(stats?.motifs_frequents ?? []).length === 0 ? (
                <p className="text-[var(--m15-muted)] text-sm">Aucune donnée</p>
              ) : (
                (stats?.motifs_frequents ?? []).slice(0, 6).map((m, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-[var(--m15-white)] text-sm truncate flex-1">{m.motif}</span>
                    <Badge variant="outline" className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs ml-2">
                      {m.count}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Alertes stock */}
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-400" />
                  Alertes stock
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-cyan-400 hover:text-cyan-300 text-xs gap-1"
                  onClick={() => navigate("/infirmerie/stocks")}
                >
                  Stocks <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertes.length === 0 ? (
                <p className="text-emerald-400 text-sm">Tous les stocks sont suffisants ✓</p>
              ) : (
                alertes.slice(0, 5).map(a => (
                  <div key={a.id} className="flex items-center justify-between p-2 bg-[var(--elevate-2)] rounded">
                    <div>
                      <p className="text-[var(--m15-white)] text-xs font-medium">{a.nom}</p>
                      <p className="text-[var(--m15-muted)] text-xs">{a.quantite} {a.unite} restant(s)</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={a.statut_stock === "rupture"
                        ? "bg-red-500/20 text-red-300 border-red-500/30 text-xs"
                        : "bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs"}
                    >
                      {a.statut_stock === "rupture" ? "Rupture" : "Alerte"}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Actions rapides */}
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--m15-white)] text-base">Actions rapides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start border-[var(--m15-border)] text-[var(--m15-white)] hover:text-[var(--m15-white)] gap-2"
                onClick={() => navigate("/infirmerie/consultations")}
              >
                <Stethoscope className="h-4 w-4 text-rose-400" />
                Toutes les consultations
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-[var(--m15-border)] text-[var(--m15-white)] hover:text-[var(--m15-white)] gap-2"
                onClick={() => navigate("/infirmerie/dossiers")}
              >
                <Heart className="h-4 w-4 text-pink-400" />
                Dossiers médicaux
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-[var(--m15-border)] text-[var(--m15-white)] hover:text-[var(--m15-white)] gap-2"
                onClick={() => navigate("/infirmerie/stocks")}
              >
                <Package className="h-4 w-4 text-orange-400" />
                Gestion des stocks
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
