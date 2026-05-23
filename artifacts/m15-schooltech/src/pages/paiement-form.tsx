import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CheckCircle, FileText, DollarSign } from "lucide-react";
import {
  useGetScolariteEleveEleveId,
  usePostPaiementsEnregistrer,
  useListerEleves,
  useListerAnneesScolaires,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

type Eleve = { id: string; nom: string; prenoms: string; matricule: string };
type ScolariteData = {
  id: string; montant_total_du: string; montant_total_paye: string; montant_restant: string;
  inscription_payee: boolean; tranche1_payee: boolean; tranche2_payee: boolean; tranche3_payee: boolean;
  frais_config?: {
    frais_inscription: string; frais_tranche1: string; frais_tranche2: string; frais_tranche3: string;
  };
};

function fmt(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v ?? "0") : v;
  return new Intl.NumberFormat("fr-FR").format(Math.round(isNaN(n) ? 0 : n)) + " FCFA";
}

const TYPES = [
  { value: "inscription", label: "Frais d'inscription" },
  { value: "tranche1", label: "1ère tranche" },
  { value: "tranche2", label: "2ème tranche" },
  { value: "tranche3", label: "3ème tranche" },
  { value: "autre", label: "Autre montant" },
];
const MODES = [
  { value: "especes", label: "Espèces" },
  { value: "cheque", label: "Chèque" },
  { value: "virement", label: "Virement bancaire" },
  { value: "mobile_money", label: "Mobile Money" },
];

export default function PaiementForm() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const { toast } = useToast();
  const params = new URLSearchParams(search);
  const preEleveId = params.get("eleve_id") ?? "";
  const preType = params.get("type") ?? "";

  const [eleveId, setEleveId] = useState(preEleveId);
  const [typePaiement, setTypePaiement] = useState(preType);
  const [montant, setMontant] = useState("");
  const [modePaiement, setModePaiement] = useState("especes");
  const [reference, setReference] = useState("");
  const [datePaiement, setDatePaiement] = useState(new Date().toISOString().split("T")[0]);
  const [obs, setObs] = useState("");
  const [success, setSuccess] = useState<{ numero_recu: string; id: string } | null>(null);

  const { data: elevesData } = useListerEleves({});
  const eleves: Eleve[] = (elevesData as { eleves?: Eleve[] } | undefined)?.eleves ?? [];

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { annees?: Array<{ id: string; libelle: string; active?: boolean }> } | undefined)?.annees ?? [];
  const anneeActive = annees.find(a => a.active);

  const { data: scolariteRaw, isLoading: loadingScol } = useGetScolariteEleveEleveId(
    eleveId || "00000000-0000-0000-0000-000000000000",
    anneeActive?.id ? { annee_scolaire_id: anneeActive.id } : {},
    { query: { enabled: !!eleveId, queryKey: [] } }
  );
  const scol = (scolariteRaw as { data?: ScolariteData } | undefined)?.data;

  const eleve = eleves.find(e => e.id === eleveId);
  const enregistrer = usePostPaiementsEnregistrer();

  useEffect(() => {
    if (!typePaiement || !scol) return;
    const map: Record<string, string | undefined> = {
      inscription: scol.frais_config?.frais_inscription,
      tranche1: scol.frais_config?.frais_tranche1,
      tranche2: scol.frais_config?.frais_tranche2,
      tranche3: scol.frais_config?.frais_tranche3,
    };
    if (map[typePaiement]) setMontant(String(Math.round(parseFloat(map[typePaiement]!))));
  }, [typePaiement, scol]);

  const montantNum = parseFloat(montant) || 0;
  const nouveauPaye = parseFloat(scol?.montant_total_paye ?? "0") + montantNum;
  const nouveauRestant = Math.max(0, parseFloat(scol?.montant_total_du ?? "0") - nouveauPaye);

  function submit() {
    if (!eleveId || !montantNum || !typePaiement || !modePaiement || !datePaiement) {
      toast({ title: "Veuillez remplir tous les champs obligatoires.", variant: "destructive" }); return;
    }
    enregistrer.mutate(
      {
        data: {
          eleve_id: eleveId,
          montant: montantNum,
          mode_paiement: modePaiement,
          type_paiement: typePaiement,
          date_paiement: datePaiement,
          reference_paiement: reference || undefined,
          observations: obs || undefined,
          annee_scolaire_id: anneeActive?.id,
        },
      } as Parameters<typeof enregistrer.mutate>[0],
      {
        onSuccess: (r: unknown) => {
          const d = r as { data?: { numero_recu?: string; paiement?: { id: string } } };
          toast({ title: `Paiement enregistré — Reçu ${d?.data?.numero_recu}` });
          setSuccess({ numero_recu: d?.data?.numero_recu ?? "", id: d?.data?.paiement?.id ?? "" });
        },
        onError: (e: unknown) => {
          toast({ title: (e as { message?: string })?.message ?? "Erreur", variant: "destructive" });
        },
      }
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--m15-navy)" }}>
        <Card style={{ background: "var(--m15-card)", border: "1px solid rgba(0,201,167,0.3)", maxWidth: 420, width: "100%" }}>
          <CardContent className="pt-8 pb-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(0,201,167,0.15)" }}>
              <CheckCircle className="h-8 w-8" style={{ color: "#00C9A7" }} />
            </div>
            <div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)", fontSize: 20, fontWeight: 700 }}>
                Paiement enregistré !
              </h2>
              <p style={{ color: "#00C9A7", fontFamily: "monospace", fontSize: 18, fontWeight: 700, marginTop: 8 }}>
                {success.numero_recu}
              </p>
            </div>
            <div className="flex gap-3 justify-center flex-wrap">
              <Button style={{ background: "#00C9A7", color: "white" }}
                onClick={() => navigate(`/scolarite/recu/${success.id}`)}>
                <FileText className="h-4 w-4 mr-2" /> Voir le reçu
              </Button>
              <Button variant="outline" style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}
                onClick={() => navigate(`/scolarite/eleve/${eleveId}`)}>
                Fiche élève
              </Button>
              <Button variant="ghost" style={{ color: "var(--m15-muted)" }}
                onClick={() => { setSuccess(null); setMontant(""); setObs(""); setReference(""); }}>
                Nouveau paiement
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--m15-navy)" }}>
      <Button variant="ghost" className="mb-4" onClick={() => window.history.back()} style={{ color: "var(--m15-muted)" }}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Retour
      </Button>
      <div className="max-w-2xl mx-auto">
        <h1 style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)", fontSize: 24, fontWeight: 700, marginBottom: 6 }}>
          Enregistrer un paiement
        </h1>
        <p style={{ color: "var(--m15-muted)", fontSize: 14, marginBottom: 20 }}>
          Le reçu sera généré automatiquement
        </p>

        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardContent className="pt-6 space-y-5">
            {/* Sélection élève */}
            {!preEleveId && (
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-white)" }}>Élève *</Label>
                <Select value={eleveId} onValueChange={setEleveId}>
                  <SelectTrigger style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                    <SelectValue placeholder="Rechercher un élève" />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                    {eleves.map(e => (
                      <SelectItem key={e.id} value={e.id} style={{ color: "var(--m15-white)" }}>
                        {e.prenoms} {e.nom} — {e.matricule}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {eleveId && eleve && (
              <div className="p-3 rounded-lg" style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)" }}>
                <p style={{ color: "var(--m15-white)", fontWeight: 600 }}>{eleve.prenoms} {eleve.nom}</p>
                <p style={{ color: "var(--m15-muted)", fontSize: 12 }}>{eleve.matricule}</p>
              </div>
            )}

            {/* Type de paiement */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-white)" }}>Type de paiement *</Label>
              <Select value={typePaiement} onValueChange={setTypePaiement}>
                <SelectTrigger style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <SelectValue placeholder="Sélectionner le type" />
                </SelectTrigger>
                <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                  {TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} style={{ color: "var(--m15-white)" }}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Montant */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-white)" }}>Montant (FCFA) *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#00C9A7" }} />
                <Input type="number" value={montant} onChange={e => setMontant(e.target.value)}
                  placeholder="0" className="pl-9"
                  style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
            </div>

            {/* Mode */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-white)" }}>Mode de paiement *</Label>
              <Select value={modePaiement} onValueChange={setModePaiement}>
                <SelectTrigger style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                  {MODES.map(m => <SelectItem key={m.value} value={m.value} style={{ color: "var(--m15-white)" }}>{m.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Référence (conditionnel) */}
            {(modePaiement === "cheque" || modePaiement === "virement") && (
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-white)" }}>Référence (N° chèque / virement)</Label>
                <Input value={reference} onChange={e => setReference(e.target.value)}
                  placeholder="REF-..."
                  style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
            )}

            {/* Date */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-white)" }}>Date du paiement *</Label>
              <Input type="date" value={datePaiement ?? ""} onChange={e => setDatePaiement(e.target.value)}
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>

            {/* Observations */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-white)" }}>Observations (optionnel)</Label>
              <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={3}
                placeholder="Remarques éventuelles..."
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", resize: "none" }} />
            </div>

            {/* Récapitulatif */}
            {scol && montantNum > 0 && (
              <div className="p-4 rounded-lg space-y-2" style={{ background: "var(--m15-card2)", border: "1px solid rgba(0,201,167,0.2)" }}>
                <p style={{ color: "var(--m15-muted)", fontSize: 13, fontWeight: 600 }}>Récapitulatif après paiement</p>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--m15-muted)" }}>Total payé :</span>
                  <span style={{ color: "#00C9A7", fontWeight: 600 }}>{fmt(nouveauPaye)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: "var(--m15-muted)" }}>Restant :</span>
                  <span style={{ color: nouveauRestant > 0 ? "#FF4D6D" : "#00C9A7", fontWeight: 600 }}>{fmt(nouveauRestant)}</span>
                </div>
              </div>
            )}

            <Button className="w-full" style={{ background: "#00C9A7", color: "white", height: 44, fontWeight: 600 }}
              onClick={submit} disabled={enregistrer.isPending}>
              {enregistrer.isPending ? "Enregistrement..." : "Enregistrer et générer le reçu"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
