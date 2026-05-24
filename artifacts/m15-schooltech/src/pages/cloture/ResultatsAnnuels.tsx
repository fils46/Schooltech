import { useState } from "react";
import {
  useGetStatsCloture,
  useListerAnneesScolaires,
  useListerClasses,
  useCalculerResultatsClasse,
  getGetStatsClotureQueryKey,
  getCalculerResultatsClasseQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Download, Search, TrendingUp, Users } from "lucide-react";

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

interface EleveResult {
  eleve_id: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  moyenne_annuelle: number | null;
  proposition_auto: string;
  decision_enregistree: string | null;
  classe_destination_nom: string | null;
  parent_notifie: boolean;
}

const DECISION_LABELS: Record<string, { label: string; color: string }> = {
  admis: { label: "Admis", color: "bg-[#00C9A7]/20 text-[#00C9A7] border-[#00C9A7]/30" },
  admis_avec_reserve: { label: "Admis avec réserve", color: "bg-[#F5C842]/20 text-[#F5C842] border-[#F5C842]/30" },
  redoublant: { label: "Redoublant", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  exclu: { label: "Exclu", color: "bg-[#FF4D6D]/20 text-[#FF4D6D] border-[#FF4D6D]/30" },
  oriente_sortie: { label: "Orienté sortie", color: "bg-[#0080FF]/20 text-[#0080FF] border-[#0080FF]/30" },
};

export default function ResultatsAnnuels() {
  const { user } = useAuth();
  const [anneeId, setAnneeId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [filtreDecision, setFiltreDecision] = useState("");
  const [search, setSearch] = useState("");

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { data?: { annees?: Array<{ id: string; libelle: string; est_active: boolean }> } })?.data?.annees ?? [];
  const anneeActive = annees.find(a => a.est_active);
  const selectedAnnee = anneeId || anneeActive?.id || "";

  const { data: classesData } = useListerClasses();
  const classes = (classesData as { data?: { classes?: Array<{ id: string; nom: string }> } })?.data?.classes ?? [];

  const { data: resultatsData } = useCalculerResultatsClasse(
    classeId,
    { annee_scolaire_id: selectedAnnee },
    { query: { enabled: !!classeId && !!selectedAnnee, queryKey: getCalculerResultatsClasseQueryKey(classeId, { annee_scolaire_id: selectedAnnee }) } }
  );
  const resultats = (resultatsData as { data?: { eleves?: EleveResult[]; stats?: { total: number; admis: number; redoublants: number; sans_decision: number } } })?.data;
  const eleves = resultats?.eleves ?? [];
  const statsResult = resultats?.stats;

  const { data: statsGlobData } = useGetStatsCloture(
    { annee_scolaire_id: selectedAnnee },
    { query: { enabled: !!selectedAnnee && !classeId, queryKey: getGetStatsClotureQueryKey({ annee_scolaire_id: selectedAnnee }) } }
  );
  const totaux = (statsGlobData as { data?: { totaux?: { total: number; admis: number; redoublants: number; taux_reussite: number } } })?.data?.totaux;

  const filtered = eleves.filter(e => {
    const matchSearch = !search || `${e.prenom} ${e.nom} ${e.matricule ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchDecision = !filtreDecision || e.decision_enregistree === filtreDecision;
    return matchSearch && matchDecision;
  });

  const exportCSV = () => {
    const rows = [
      ["Prénom", "Nom", "Matricule", "Moyenne annuelle", "Décision", "Classe destination", "Parent notifié"],
      ...filtered.map(e => [
        e.prenom, e.nom, e.matricule ?? "", e.moyenne_annuelle?.toFixed(2) ?? "",
        e.decision_enregistree ?? "", e.classe_destination_nom ?? "", e.parent_notifie ? "Oui" : "Non",
      ]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `resultats_annuels_${classeId || "etablissement"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPalmaresAdmis = () => {
    const admis = filtered.filter(e => e.decision_enregistree === "admis" || e.decision_enregistree === "admis_avec_reserve");
    const rows = [
      ["Palmarès des admis"],
      ["Prénom", "Nom", "Matricule", "Moyenne annuelle", "Classe destination"],
      ...admis.map(e => [e.prenom, e.nom, e.matricule ?? "", e.moyenne_annuelle?.toFixed(2) ?? "", e.classe_destination_nom ?? ""]),
    ];
    const csv = rows.map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palmares_admis.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#0A1628] text-white p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
            Résultats annuels
          </h1>
          <p className="text-[#8B9DC3] text-sm">Consultation des décisions de fin d'année</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={exportCSV}
            className="border-[rgba(0,201,167,0.3)] text-[#00C9A7] hover:bg-[#00C9A7]/10 text-xs">
            <Download className="w-3 h-3 mr-1" /> Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPalmaresAdmis}
            className="border-[#F5C842]/30 text-[#F5C842] hover:bg-[#F5C842]/10 text-xs">
            <Download className="w-3 h-3 mr-1" /> Palmarès PDF
          </Button>
        </div>
      </div>

      {/* Stats rapides */}
      {(totaux || statsResult) && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total élèves", value: (statsResult?.total ?? totaux?.total ?? 0), color: "#0080FF" },
            { label: "Admis", value: (statsResult?.admis ?? totaux?.admis ?? 0), color: "#00C9A7" },
            { label: "Redoublants", value: (statsResult?.redoublants ?? totaux?.redoublants ?? 0), color: "#F5C842" },
            { label: "Taux réussite", value: `${totaux?.taux_reussite ?? 0}%`, color: "#00C9A7" },
          ].map(s => (
            <Card key={s.label} className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
              <CardContent className="p-3">
                <div className="text-[#8B9DC3] text-xs mb-1">{s.label}</div>
                <div className="text-xl font-bold" style={{ color: s.color }}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <Select value={selectedAnnee} onValueChange={setAnneeId}>
          <SelectTrigger className="w-44 bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
            <SelectValue placeholder="Année scolaire" />
          </SelectTrigger>
          <SelectContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
            {annees.map(a => <SelectItem key={a.id} value={a.id} className="text-white">{a.libelle}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={classeId} onValueChange={setClasseId}>
          <SelectTrigger className="w-44 bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
            <SelectValue placeholder="Toutes les classes" />
          </SelectTrigger>
          <SelectContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
            <SelectItem value="" className="text-white">Toutes les classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={c.id} className="text-white">{c.nom}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filtreDecision} onValueChange={setFiltreDecision}>
          <SelectTrigger className="w-44 bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
            <SelectValue placeholder="Toutes décisions" />
          </SelectTrigger>
          <SelectContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
            <SelectItem value="" className="text-white">Toutes décisions</SelectItem>
            {Object.entries(DECISION_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k} className="text-white">{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-40">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B9DC3]" />
          <Input
            placeholder="Rechercher un élève..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white placeholder:text-[#8B9DC3]"
          />
        </div>
      </div>

      {/* Tableau */}
      <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#8B9DC3] text-xs border-b border-[rgba(0,201,167,0.10)]">
                  <th className="text-left p-3">Élève</th>
                  <th className="text-center p-3">Moy. annuelle</th>
                  <th className="text-center p-3">Décision</th>
                  <th className="text-center p-3">Classe destination</th>
                  <th className="text-center p-3">Parent notifié</th>
                </tr>
              </thead>
              <tbody>
                {!classeId ? (
                  <tr><td colSpan={5} className="text-center text-[#8B9DC3] py-8">
                    Sélectionnez une classe pour voir les résultats individuels
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-[#8B9DC3] py-8">Aucun résultat</td></tr>
                ) : filtered.map(e => {
                  const decConfig = e.decision_enregistree ? DECISION_LABELS[e.decision_enregistree] : null;
                  return (
                    <tr key={e.eleve_id} className="border-b border-[rgba(0,201,167,0.07)] hover:bg-[#0A1628]/30">
                      <td className="p-3">
                        <div className="font-medium text-white">{e.prenom} {e.nom}</div>
                        {e.matricule && <div className="text-[#8B9DC3] text-xs">{e.matricule}</div>}
                      </td>
                      <td className="text-center p-3">
                        <span className={cn(
                          "text-lg font-bold",
                          e.moyenne_annuelle === null ? "text-[#8B9DC3]" :
                          e.moyenne_annuelle >= 10 ? "text-[#00C9A7]" : "text-[#FF4D6D]"
                        )}>
                          {e.moyenne_annuelle?.toFixed(2) ?? "—"}
                        </span>
                      </td>
                      <td className="text-center p-3">
                        {decConfig ? (
                          <Badge className={cn("border text-xs", decConfig.color)}>{decConfig.label}</Badge>
                        ) : (
                          <span className="text-[#8B9DC3] text-xs">Non décidé</span>
                        )}
                      </td>
                      <td className="text-center p-3 text-[#8B9DC3] text-sm">
                        {e.classe_destination_nom ?? "—"}
                      </td>
                      <td className="text-center p-3">
                        {e.parent_notifie ? (
                          <span className="text-[#00C9A7] text-xs">✓ Oui</span>
                        ) : (
                          <span className="text-[#8B9DC3] text-xs">Non</span>
                        )}
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
