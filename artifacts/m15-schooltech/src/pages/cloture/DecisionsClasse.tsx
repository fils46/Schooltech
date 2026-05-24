import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import {
  useCalculerResultatsClasse,
  useEnregistrerDecision,
  useEnregistrerDecisionsMasse,
  useListerAnneesScolaires,
  useListerClasses,
  getCalculerResultatsClasseQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, Zap, CheckCircle, AlertTriangle } from "lucide-react";

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

type Decision = "admis" | "redoublant" | "exclu" | "oriente_sortie" | "admis_avec_reserve" | "";

interface EleveResult {
  eleve_id: string;
  nom: string;
  prenom: string;
  matricule: string | null;
  moyenne_t1: number | null;
  moyenne_t2: number | null;
  moyenne_t3: number | null;
  moyenne_annuelle: number | null;
  nb_matieres_elim: number;
  bulletin_incomplet: boolean;
  proposition_auto: string;
  decision_enregistree: string | null;
  decision_id: string | null;
  classe_destination_id: string | null;
  classe_destination_nom: string | null;
  parent_notifie: boolean;
}

interface LocalDecision {
  decision: Decision;
  classe_destination_id: string;
  motif: string;
}

const DECISION_OPTIONS = [
  { value: "admis", label: "✅ Admis", color: "text-[#00C9A7]" },
  { value: "admis_avec_reserve", label: "⚠️ Admis avec réserve", color: "text-[#F5C842]" },
  { value: "redoublant", label: "🔁 Redoublant", color: "text-orange-400" },
  { value: "exclu", label: "🚫 Exclu", color: "text-[#FF4D6D]" },
  { value: "oriente_sortie", label: "🎓 Orienté sortie", color: "text-[#0080FF]" },
];

export default function DecisionsClasse() {
  const params = useParams<{ classeId: string }>();
  const classeId = params.classeId;
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Get annee from search params
  const searchParams = new URLSearchParams(window.location.search);
  const anneeIdFromUrl = searchParams.get("annee") ?? "";
  const [anneeId, setAnneeId] = useState(anneeIdFromUrl);

  const [localDecisions, setLocalDecisions] = useState<Record<string, LocalDecision>>({});
  const [filtre, setFiltre] = useState<"tous" | "sans_decision" | "admis" | "redoublants" | "cas_particuliers">("tous");

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { data?: { annees?: Array<{ id: string; libelle: string; est_active: boolean }> } })?.data?.annees ?? [];
  const anneeActive = annees.find(a => a.est_active);
  const selectedAnnee = anneeId || anneeActive?.id || "";

  const { data: classesData } = useListerClasses();
  const classes = (classesData as { data?: { classes?: Array<{ id: string; nom: string }> } })?.data?.classes ?? [];

  const { data: resultatsData, refetch } = useCalculerResultatsClasse(
    classeId,
    { annee_scolaire_id: selectedAnnee },
    { query: { enabled: !!classeId && !!selectedAnnee, queryKey: getCalculerResultatsClasseQueryKey(classeId, { annee_scolaire_id: selectedAnnee }) } }
  );
  const resultats = (resultatsData as {
    data?: {
      classe?: { id: string; nom: string; niveau: string; est_terminale: boolean };
      criteres?: { moyenne_admission: string; nb_matieres_eliminatoires_max: number; moyenne_eliminatoire?: string | null };
      eleves?: EleveResult[];
      stats?: { total: number; admis: number; redoublants: number; sans_decision: number };
    };
  })?.data;

  const eleves = resultats?.eleves ?? [];
  const classe = resultats?.classe;
  const criteres = resultats?.criteres;
  const statsResult = resultats?.stats;
  const moyAdmission = parseFloat(criteres?.moyenne_admission ?? "10");

  // Init local decisions from server data
  useEffect(() => {
    const init: Record<string, LocalDecision> = {};
    eleves.forEach(e => {
      init[e.eleve_id] = {
        decision: (e.decision_enregistree as Decision) || (e.proposition_auto as Decision) || "",
        classe_destination_id: e.classe_destination_id ?? "",
        motif: "",
      };
    });
    setLocalDecisions(init);
  }, [eleves.length]);

  const { mutate: enregistrerDecision, isPending: savingOne } = useEnregistrerDecision({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getCalculerResultatsClasseQueryKey(classeId, { annee_scolaire_id: selectedAnnee }) });
        toast({ title: "Décision enregistrée" });
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const { mutate: enregistrerMasse, isPending: savingAll } = useEnregistrerDecisionsMasse({
    mutation: {
      onSuccess: (data: unknown) => {
        const d = (data as { data?: { nb_enregistrees?: number; erreurs?: string[] } })?.data;
        toast({ title: `${d?.nb_enregistrees ?? 0} décisions enregistrées` });
        qc.invalidateQueries({ queryKey: getCalculerResultatsClasseQueryKey(classeId, { annee_scolaire_id: selectedAnnee }) });
      },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    },
  });

  const setDecision = (eleveId: string, field: keyof LocalDecision, value: string) => {
    setLocalDecisions(prev => ({
      ...prev,
      [eleveId]: { ...prev[eleveId]!, [field]: value },
    }));
  };

  const saveSingle = (eleve: EleveResult) => {
    const dec = localDecisions[eleve.eleve_id];
    if (!dec?.decision) { toast({ title: "Sélectionnez une décision", variant: "destructive" }); return; }
    enregistrerDecision({
      data: {
        eleve_id: eleve.eleve_id,
        classe_id: classeId,
        annee_scolaire_id: selectedAnnee,
        decision: dec.decision,
        classe_destination_id: dec.classe_destination_id || null,
        motif: dec.motif || null,
        date_decision: new Date().toISOString().split("T")[0]!,
        moyenne_annuelle: eleve.moyenne_annuelle,
      },
    });
  };

  const saveAll = () => {
    const decisions = eleves
      .filter(e => localDecisions[e.eleve_id]?.decision)
      .map(e => ({
        eleve_id: e.eleve_id,
        decision: localDecisions[e.eleve_id]!.decision,
        classe_destination_id: localDecisions[e.eleve_id]!.classe_destination_id || null,
        motif: localDecisions[e.eleve_id]!.motif || null,
      }));
    if (decisions.length === 0) { toast({ title: "Aucune décision à enregistrer", variant: "destructive" }); return; }
    enregistrerMasse({ data: { annee_scolaire_id: selectedAnnee, classe_id: classeId, decisions } });
  };

  const appliquerAuto = () => {
    const updated = { ...localDecisions };
    eleves.forEach(e => {
      updated[e.eleve_id] = {
        ...updated[e.eleve_id]!,
        decision: e.proposition_auto as Decision,
        classe_destination_id: e.classe_destination_id ?? "",
      };
    });
    setLocalDecisions(updated);
    toast({ title: "Propositions automatiques appliquées", description: "Enregistrez pour confirmer." });
  };

  const filteredEleves = eleves.filter(e => {
    const dec = e.decision_enregistree;
    if (filtre === "sans_decision") return !dec;
    if (filtre === "admis") return dec === "admis" || dec === "admis_avec_reserve";
    if (filtre === "redoublants") return dec === "redoublant";
    if (filtre === "cas_particuliers") return dec === "exclu" || dec === "oriente_sortie" || dec === "admis_avec_reserve";
    return true;
  });

  const enregistrees = eleves.filter(e => e.decision_enregistree).length;
  const pct = eleves.length > 0 ? Math.round((enregistrees / eleves.length) * 100) : 0;

  const needsDest = (dec: string) => dec === "admis" || dec === "admis_avec_reserve";

  return (
    <div className="min-h-screen bg-[#0A1628] text-white p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/cloture")} className="text-[#8B9DC3] hover:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
            {classe?.nom ?? "Décisions de fin d'année"}
          </h1>
          {classe?.est_terminale && (
            <Badge className="bg-[#0080FF]/20 text-[#0080FF] border border-[#0080FF]/30 text-xs mt-1">
              Classe terminale — Seuls Orienté sortie et Exclu autorisés
            </Badge>
          )}
        </div>
        <Select value={selectedAnnee} onValueChange={setAnneeId}>
          <SelectTrigger className="w-44 bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
            <SelectValue placeholder="Année" />
          </SelectTrigger>
          <SelectContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
            {annees.map(a => <SelectItem key={a.id} value={a.id} className="text-white">{a.libelle}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={appliquerAuto}
          className="border-[#F5C842]/50 text-[#F5C842] hover:bg-[#F5C842]/10">
          <Zap className="w-4 h-4 mr-1" /> Propositions auto
        </Button>
        <Button size="sm" onClick={saveAll} disabled={savingAll}
          className="bg-[#00C9A7] text-[#0A1628] font-semibold hover:bg-[#00C9A7]/80">
          <Save className="w-4 h-4 mr-1" /> {savingAll ? "Enregistrement..." : "Enregistrer tout"}
        </Button>
      </div>

      {/* Progression */}
      <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)] mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#8B9DC3] text-sm">{enregistrees} / {eleves.length} décisions enregistrées</span>
            <span className="text-[#00C9A7] font-bold">{pct}%</span>
          </div>
          <div className="w-full bg-[#0A1628] rounded-full h-2">
            <div className="bg-[#00C9A7] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
          </div>
          {criteres && (
            <div className="flex gap-4 mt-2 text-xs text-[#8B9DC3]">
              <span>Seuil admission : <b className="text-white">{criteres.moyenne_admission}/20</b></span>
              <span>Seuil éliminatoire : <b className="text-white">{criteres.moyenne_eliminatoire ?? "5.00"}/20</b></span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filtres */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["tous", "sans_decision", "admis", "redoublants", "cas_particuliers"] as const).map(f => (
          <button key={f}
            onClick={() => setFiltre(f)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium border transition-colors",
              filtre === f
                ? "bg-[#00C9A7] text-[#0A1628] border-[#00C9A7]"
                : "text-[#8B9DC3] border-[rgba(0,201,167,0.2)] hover:border-[#00C9A7]/50"
            )}>
            {f === "tous" ? "Tous" : f === "sans_decision" ? "Sans décision" : f === "admis" ? "Admis" : f === "redoublants" ? "Redoublants" : "Cas particuliers"}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#8B9DC3] text-xs border-b border-[rgba(0,201,167,0.10)]">
                  <th className="text-left p-3 min-w-32">Élève</th>
                  <th className="text-center p-3">T1</th>
                  <th className="text-center p-3">T2</th>
                  <th className="text-center p-3">T3</th>
                  <th className="text-center p-3 min-w-20">Moy. ann.</th>
                  <th className="text-center p-3">Prop. auto</th>
                  <th className="text-center p-3 min-w-44">Décision</th>
                  <th className="text-center p-3 min-w-36">Classe dest.</th>
                  <th className="text-center p-3 min-w-28">Motif</th>
                  <th className="text-center p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredEleves.length === 0 ? (
                  <tr><td colSpan={10} className="text-center text-[#8B9DC3] py-8">
                    {eleves.length === 0 ? "Aucun élève dans cette classe" : "Aucun élève dans ce filtre"}
                  </td></tr>
                ) : filteredEleves.map((eleve) => {
                  const dec = localDecisions[eleve.eleve_id];
                  const moy = eleve.moyenne_annuelle;
                  const isAdmis = moy !== null && moy >= moyAdmission;
                  const rowColor = !eleve.decision_enregistree ? "" :
                    eleve.decision_enregistree === "admis" || eleve.decision_enregistree === "admis_avec_reserve" ? "bg-[#00C9A7]/5" :
                    eleve.decision_enregistree === "redoublant" ? "bg-[#F5C842]/5" : "bg-[#FF4D6D]/5";

                  return (
                    <tr key={eleve.eleve_id}
                      className={cn("border-b border-[rgba(0,201,167,0.07)] hover:bg-[#0A1628]/30 transition-colors", rowColor)}>
                      <td className="p-3">
                        <div className="font-medium text-white">{eleve.prenom} {eleve.nom}</div>
                        {eleve.matricule && <div className="text-[#8B9DC3] text-xs">{eleve.matricule}</div>}
                        {eleve.bulletin_incomplet && (
                          <div className="flex items-center gap-1 text-[#F5C842] text-xs mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> Bulletin incomplet
                          </div>
                        )}
                        {eleve.parent_notifie && (
                          <div className="flex items-center gap-1 text-[#00C9A7] text-xs mt-0.5">
                            <CheckCircle className="w-3 h-3" /> Parent notifié
                          </div>
                        )}
                      </td>
                      <td className="text-center p-3 text-[#8B9DC3] text-xs">{eleve.moyenne_t1?.toFixed(2) ?? "—"}</td>
                      <td className="text-center p-3 text-[#8B9DC3] text-xs">{eleve.moyenne_t2?.toFixed(2) ?? "—"}</td>
                      <td className="text-center p-3 text-[#8B9DC3] text-xs">{eleve.moyenne_t3?.toFixed(2) ?? "—"}</td>
                      <td className="text-center p-3">
                        <span className={cn(
                          "text-lg font-bold",
                          moy === null ? "text-[#8B9DC3]" : isAdmis ? "text-[#00C9A7]" : "text-[#FF4D6D]"
                        )}>
                          {moy !== null ? moy.toFixed(2) : "—"}
                        </span>
                      </td>
                      <td className="text-center p-3">
                        <Badge className={cn(
                          "text-xs border",
                          eleve.proposition_auto === "admis" ? "bg-[#00C9A7]/20 text-[#00C9A7] border-[#00C9A7]/30" :
                          eleve.proposition_auto === "oriente_sortie" ? "bg-[#0080FF]/20 text-[#0080FF] border-[#0080FF]/30" :
                          "bg-[#F5C842]/20 text-[#F5C842] border-[#F5C842]/30"
                        )}>
                          {eleve.proposition_auto}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Select
                          value={dec?.decision || ""}
                          onValueChange={v => setDecision(eleve.eleve_id, "decision", v)}
                        >
                          <SelectTrigger className="bg-[#0A1628] border-[rgba(0,201,167,0.2)] text-white text-xs h-8">
                            <SelectValue placeholder="Choisir..." />
                          </SelectTrigger>
                          <SelectContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
                            {DECISION_OPTIONS
                              .filter(o => {
                                if (classe?.est_terminale) return o.value === "oriente_sortie" || o.value === "exclu";
                                return true;
                              })
                              .map(o => (
                                <SelectItem key={o.value} value={o.value} className={cn("text-xs", o.color)}>
                                  {o.label}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        {needsDest(dec?.decision ?? "") ? (
                          <Select
                            value={dec?.classe_destination_id || ""}
                            onValueChange={v => setDecision(eleve.eleve_id, "classe_destination_id", v)}
                          >
                            <SelectTrigger className="bg-[#0A1628] border-[rgba(0,201,167,0.2)] text-white text-xs h-8">
                              <SelectValue placeholder="Classe..." />
                            </SelectTrigger>
                            <SelectContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
                              {classes.filter(c => c.id !== classeId).map(c => (
                                <SelectItem key={c.id} value={c.id} className="text-white text-xs">{c.nom}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : dec?.decision === "redoublant" ? (
                          <span className="text-[#8B9DC3] text-xs">Même classe</span>
                        ) : (
                          <span className="text-[#8B9DC3] text-xs">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Input
                          placeholder="Motif..."
                          value={dec?.motif || ""}
                          onChange={e => setDecision(eleve.eleve_id, "motif", e.target.value)}
                          className="bg-[#0A1628] border-[rgba(0,201,167,0.2)] text-white text-xs h-8 w-28"
                        />
                      </td>
                      <td className="p-3">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => saveSingle(eleve)}
                          disabled={savingOne}
                          className="text-[#00C9A7] hover:bg-[#00C9A7]/10 text-xs h-7"
                        >
                          <Save className="w-3 h-3" />
                        </Button>
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
