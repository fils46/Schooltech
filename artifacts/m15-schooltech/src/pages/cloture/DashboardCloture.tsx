import { useState } from "react";
import { useLocation } from "wouter";
import {
  useGetStatsCloture,
  useListerAnneesScolaires,
  getGetStatsClotureQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, CheckCircle, RotateCcw, XCircle, GraduationCap, AlertTriangle,
  TrendingUp, Settings, ArrowRight, Clock, ChevronRight,
} from "lucide-react";

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

export default function DashboardCloture() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [anneeId, setAnneeId] = useState<string>("");

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { data?: { annees?: Array<{ id: string; libelle: string; est_active: boolean }> } })?.data?.annees ?? [];

  // Auto-select active year
  const anneeActive = annees.find(a => a.est_active);
  const selectedAnnee = anneeId || anneeActive?.id || "";

  const { data: statsData } = useGetStatsCloture(
    { annee_scolaire_id: selectedAnnee },
    { query: { enabled: !!selectedAnnee, queryKey: getGetStatsClotureQueryKey({ annee_scolaire_id: selectedAnnee }) } }
  );
  const stats = (statsData as { data?: { par_classe?: StatsClasse[]; totaux?: Totaux; promotions?: PromotionEntry[] } })?.data;
  const parClasse = stats?.par_classe ?? [];
  const totaux = stats?.totaux ?? { total: 0, admis: 0, redoublants: 0, exclus: 0, sortie: 0, sans_decision: 0, taux_reussite: 0 };

  interface StatsClasse {
    classe_id: string;
    classe_nom: string;
    total: number;
    admis: number;
    redoublants: number;
    exclus: number;
    sortie: number;
    sans_decision: number;
    taux_reussite: number;
    promotion_effectuee: boolean;
  }
  interface Totaux {
    total: number;
    admis: number;
    redoublants: number;
    exclus: number;
    sortie: number;
    sans_decision: number;
    taux_reussite: number;
  }
  interface PromotionEntry {
    id: string;
    classe_source: string;
    classe_destination: string;
    nb_promus: number;
    statut: string;
    date_promotion: string;
  }

  const etapesCompletees = {
    criteres: parClasse.length > 0,
    decisions: totaux.sans_decision === 0 && totaux.total > 0,
    validation: totaux.sans_decision === 0 && totaux.total > 0,
    notifications: false,
    promotions: (stats?.promotions ?? []).length > 0,
  };

  return (
    <div className="min-h-screen bg-[#0A1628] text-white p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
            Clôture d'année scolaire
          </h1>
          <p className="text-[#8B9DC3] mt-1">Gérez les décisions de fin d'année et les promotions</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedAnnee} onValueChange={setAnneeId}>
            <SelectTrigger className="w-52 bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
              <SelectValue placeholder="Sélectionner une année" />
            </SelectTrigger>
            <SelectContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
              {annees.map(a => (
                <SelectItem key={a.id} value={a.id} className="text-white hover:bg-[#0A1628]">
                  {a.libelle} {a.est_active && "✓"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {totaux.sans_decision === 0 && totaux.total > 0 ? (
            <Badge className="bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/30 px-3 py-1">
              Clôturée
            </Badge>
          ) : (
            <Badge className="bg-[#F5C842]/20 text-[#F5C842] border border-[#F5C842]/30 px-3 py-1">
              En cours
            </Badge>
          )}
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        {[
          { label: "Total élèves", value: totaux.total, icon: Users, color: "#0080FF" },
          { label: "Admis", value: totaux.admis, icon: CheckCircle, color: "#00C9A7" },
          { label: "Redoublants", value: totaux.redoublants, icon: RotateCcw, color: "#F5C842" },
          { label: "Exclus / Sortie", value: totaux.exclus + totaux.sortie, icon: XCircle, color: "#8B9DC3" },
          { label: "Sans décision", value: totaux.sans_decision, icon: AlertTriangle, color: totaux.sans_decision > 0 ? "#FF4D6D" : "#00C9A7" },
        ].map((s) => (
          <Card key={s.label} className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
                <span className="text-[#8B9DC3] text-xs">{s.label}</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Taux réussite + Actions rapides */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
          <CardContent className="p-4 flex items-center gap-4">
            <TrendingUp className="w-8 h-8 text-[#00C9A7]" />
            <div>
              <div className="text-[#8B9DC3] text-sm">Taux de réussite</div>
              <div className="text-3xl font-bold text-[#00C9A7]">{totaux.taux_reussite}%</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)] cursor-pointer hover:border-[#00C9A7]/40 transition-colors"
          onClick={() => navigate("/cloture/criteres")}>
          <CardContent className="p-4 flex items-center gap-3">
            <Settings className="w-6 h-6 text-[#F5C842]" />
            <div className="flex-1">
              <div className="font-semibold text-white">Critères d'admission</div>
              <div className="text-[#8B9DC3] text-sm">Configurer les seuils</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B9DC3]" />
          </CardContent>
        </Card>
        <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)] cursor-pointer hover:border-[#00C9A7]/40 transition-colors"
          onClick={() => navigate("/cloture/promotion")}>
          <CardContent className="p-4 flex items-center gap-3">
            <GraduationCap className="w-6 h-6 text-[#00C9A7]" />
            <div className="flex-1">
              <div className="font-semibold text-white">Validation & Promotion</div>
              <div className="text-[#8B9DC3] text-sm">Lancer les promotions</div>
            </div>
            <ChevronRight className="w-4 h-4 text-[#8B9DC3]" />
          </CardContent>
        </Card>
      </div>

      {/* Tableau par classe */}
      <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)] mb-8">
        <CardContent className="p-0">
          <div className="p-4 border-b border-[rgba(0,201,167,0.10)]">
            <h2 className="font-bold text-white text-lg">Récapitulatif par classe</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#8B9DC3] text-xs border-b border-[rgba(0,201,167,0.10)]">
                  <th className="text-left p-3">Classe</th>
                  <th className="text-center p-3">Effectif</th>
                  <th className="text-center p-3">Admis</th>
                  <th className="text-center p-3">Redoublants</th>
                  <th className="text-center p-3">Exclus</th>
                  <th className="text-center p-3">Sortie</th>
                  <th className="text-center p-3">Sans décision</th>
                  <th className="text-center p-3">Réussite</th>
                  <th className="text-center p-3">Statut</th>
                  <th className="text-center p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {parClasse.length === 0 ? (
                  <tr><td colSpan={10} className="text-center text-[#8B9DC3] py-8">
                    {selectedAnnee ? "Aucune classe avec des élèves inscrits" : "Sélectionnez une année scolaire"}
                  </td></tr>
                ) : parClasse.map((c) => (
                  <tr key={c.classe_id}
                    className={cn(
                      "border-b border-[rgba(0,201,167,0.07)] hover:bg-[#0A1628]/40 transition-colors",
                      c.sans_decision > 0 && "bg-[#FF4D6D]/5"
                    )}>
                    <td className="p-3 font-semibold text-white">{c.classe_nom}</td>
                    <td className="text-center p-3 text-[#8B9DC3]">{c.total}</td>
                    <td className="text-center p-3 text-[#00C9A7] font-medium">{c.admis}</td>
                    <td className="text-center p-3 text-[#F5C842] font-medium">{c.redoublants}</td>
                    <td className="text-center p-3 text-[#FF4D6D] font-medium">{c.exclus}</td>
                    <td className="text-center p-3 text-[#8B9DC3]">{c.sortie}</td>
                    <td className="text-center p-3">
                      {c.sans_decision > 0 ? (
                        <span className="text-[#FF4D6D] font-bold">{c.sans_decision}</span>
                      ) : (
                        <span className="text-[#00C9A7]">✓</span>
                      )}
                    </td>
                    <td className="text-center p-3">
                      <span className={cn("font-medium", c.taux_reussite >= 70 ? "text-[#00C9A7]" : c.taux_reussite >= 50 ? "text-[#F5C842]" : "text-[#FF4D6D]")}>
                        {c.taux_reussite}%
                      </span>
                    </td>
                    <td className="text-center p-3">
                      {c.promotion_effectuee ? (
                        <Badge className="bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/30 text-xs">
                          Promue
                        </Badge>
                      ) : (
                        <Badge className="bg-[#F5C842]/20 text-[#F5C842] border border-[#F5C842]/30 text-xs">
                          En attente
                        </Badge>
                      )}
                    </td>
                    <td className="text-center p-3">
                      <Button
                        size="sm"
                        className="bg-[#0080FF] hover:bg-[#0080FF]/80 text-white text-xs px-3"
                        onClick={() => navigate(`/cloture/decisions/${c.classe_id}?annee=${selectedAnnee}`)}
                      >
                        Traiter
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Timeline étapes */}
      <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
        <CardContent className="p-4">
          <h2 className="font-bold text-white text-lg mb-4">Étapes de clôture</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            {[
              { label: "Configurer critères", done: etapesCompletees.criteres },
              { label: "Saisir décisions", done: etapesCompletees.decisions },
              { label: "Valider décisions", done: etapesCompletees.validation },
              { label: "Notifier parents", done: etapesCompletees.notifications },
              { label: "Promouvoir classes", done: etapesCompletees.promotions },
            ].map((etape, idx) => (
              <div key={etape.label} className="flex items-center gap-2 flex-1">
                <div className={cn(
                  "flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0",
                  etape.done ? "bg-[#00C9A7] text-[#0A1628]" : "bg-[#0A1628] border border-[#8B9DC3] text-[#8B9DC3]"
                )}>
                  {etape.done ? "✓" : idx + 1}
                </div>
                <div className={cn("text-sm", etape.done ? "text-[#00C9A7]" : "text-[#8B9DC3]")}>
                  {etape.label}
                </div>
                {idx < 4 && <ArrowRight className="w-3 h-3 text-[#8B9DC3] hidden sm:block" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
