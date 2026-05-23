import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft, DollarSign, AlertTriangle, CheckCircle,
  FileText, Send, RefreshCw, Clock,
} from "lucide-react";
import {
  useGetScolariteEleveEleveId,
  usePutScolariteIdObservations,
  usePostPaiementsRelancer,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getGetScolariteEleveEleveIdQueryKey } from "@workspace/api-client-react";

type Paiement = {
  id: string; numero_recu: string; montant: string; mode_paiement: string;
  type_paiement: string; date_paiement: string; reference_paiement?: string;
  annule: boolean; enregistre_par_nom?: string;
};
type FraisConfig = {
  frais_inscription: string; frais_tranche1: string; frais_tranche2: string; frais_tranche3: string;
  date_limite_tranche1?: string; date_limite_tranche2?: string; date_limite_tranche3?: string;
};
type ScolariteDetail = {
  id: string; statut: "en_regle" | "partiel" | "impaye";
  montant_total_du: string; montant_total_paye: string; montant_restant: string;
  inscription_payee: boolean; tranche1_payee: boolean; tranche2_payee: boolean; tranche3_payee: boolean;
  observations?: string;
  eleve_nom?: string; eleve_prenoms?: string; eleve_matricule?: string; eleve_photo?: string; classe_nom?: string;
  frais_config?: FraisConfig;
  paiements?: Paiement[];
};

function fmt(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

const TYPE_LABELS: Record<string, string> = {
  inscription: "Inscription", tranche1: "1ère tranche", tranche2: "2ème tranche",
  tranche3: "3ème tranche", autre: "Autre",
};
const MODE_LABELS: Record<string, string> = {
  especes: "Espèces", cheque: "Chèque", virement: "Virement", mobile_money: "Mobile Money", autre: "Autre",
};

export default function ScolariteEleve() {
  const { eleveId } = useParams<{ eleveId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [obs, setObs] = useState<string | null>(null);
  const [editingObs, setEditingObs] = useState(false);

  const { data: raw, isLoading, refetch } = useGetScolariteEleveEleveId(eleveId!);
  const scol = (raw as { data?: ScolariteDetail } | undefined)?.data;

  const updateObs = usePutScolariteIdObservations();
  const relancer = usePostPaiementsRelancer();

  function saveObs() {
    if (!scol) return;
    updateObs.mutate(
      { id: scol.id, data: { observations: obs ?? "" } } as Parameters<typeof updateObs.mutate>[0],
      {
        onSuccess: () => {
          toast({ title: "Observations enregistrées" });
          setEditingObs(false);
          qc.invalidateQueries({ queryKey: getGetScolariteEleveEleveIdQueryKey(eleveId!) });
        },
      }
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--m15-navy)" }}>
        <RefreshCw className="h-8 w-8 animate-spin" style={{ color: "#00C9A7" }} />
      </div>
    );
  }

  if (!scol) {
    return (
      <div className="min-h-screen p-6 flex flex-col items-center justify-center gap-4" style={{ background: "var(--m15-navy)" }}>
        <p style={{ color: "var(--m15-muted)" }}>Scolarité non initialisée pour cet élève.</p>
        <Button onClick={() => window.history.back()} variant="outline" style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
      </div>
    );
  }

  const statutMap = {
    en_regle: { label: "En règle", color: "#00C9A7" },
    partiel: { label: "Partiel", color: "#F5C842" },
    impaye: { label: "Impayé", color: "#FF4D6D" },
  };
  const statutInfo = statutMap[scol.statut];

  const tranches = [
    { key: "inscription", label: "Frais d'inscription", paid: scol.inscription_payee, montant: scol.frais_config?.frais_inscription, limite: null },
    { key: "tranche1", label: "1ère tranche", paid: scol.tranche1_payee, montant: scol.frais_config?.frais_tranche1, limite: scol.frais_config?.date_limite_tranche1 },
    { key: "tranche2", label: "2ème tranche", paid: scol.tranche2_payee, montant: scol.frais_config?.frais_tranche2, limite: scol.frais_config?.date_limite_tranche2 },
    { key: "tranche3", label: "3ème tranche", paid: scol.tranche3_payee, montant: scol.frais_config?.frais_tranche3, limite: scol.frais_config?.date_limite_tranche3 },
  ];

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--m15-navy)" }}>
      {/* Back */}
      <Button variant="ghost" className="mb-4" onClick={() => window.history.back()}
        style={{ color: "var(--m15-muted)" }}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Retour
      </Button>

      {/* En-tête élève */}
      <Card className="mb-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <CardContent className="py-5">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={scol.eleve_photo ?? undefined} />
              <AvatarFallback style={{ background: "var(--m15-card2)", color: "#00C9A7", fontSize: 18, fontWeight: 700 }}>
                {(scol.eleve_prenoms ?? "?")[0]}{(scol.eleve_nom ?? "?")[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)", fontSize: 22, fontWeight: 700 }}>
                {scol.eleve_prenoms} {scol.eleve_nom}
              </h2>
              <div className="flex gap-3 flex-wrap mt-1">
                <span style={{ color: "var(--m15-muted)", fontSize: 13 }}>Matricule : {scol.eleve_matricule}</span>
                {scol.classe_nom && <span style={{ color: "var(--m15-muted)", fontSize: 13 }}>Classe : {scol.classe_nom}</span>}
              </div>
              <div className="mt-2">
                <Badge style={{ background: `${statutInfo.color}22`, color: statutInfo.color, border: `1px solid ${statutInfo.color}44` }}>
                  {statutInfo.label}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" style={{ background: "#00C9A7", color: "white" }}
                onClick={() => navigate(`/scolarite/paiement?eleve_id=${eleveId}`)}>
                <DollarSign className="h-4 w-4 mr-1" /> Enregistrer paiement
              </Button>
              <Button size="sm" variant="outline"
                style={{ borderColor: "rgba(245,200,66,0.4)", color: "#F5C842" }}
                onClick={() => relancer.mutate(
                  { data: { eleve_ids: [eleveId!], type_relance: "notification" } } as Parameters<typeof relancer.mutate>[0],
                  { onSuccess: () => toast({ title: "Relance envoyée au parent" }) }
                )}>
                <Send className="h-4 w-4 mr-1" /> Relance
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Résumé financier */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: "Total dû", value: scol.montant_total_du, color: "#8B9DC3" },
          { label: "Total payé", value: scol.montant_total_paye, color: "#00C9A7" },
          { label: "Restant", value: scol.montant_restant, color: parseFloat(scol.montant_restant) > 0 ? "#FF4D6D" : "#00C9A7" },
        ].map(item => (
          <Card key={item.label} style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <CardContent className="pt-4 pb-3 text-center">
              <p style={{ color: "var(--m15-muted)", fontSize: 12, marginBottom: 4 }}>{item.label}</p>
              <p style={{ color: item.color, fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>
                {fmt(item.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Détail par tranche */}
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardHeader className="pb-2">
            <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif", fontSize: 16 }}>Détail des tranches</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tranches.map(t => (
              <div key={t.key} className="flex items-center justify-between p-3 rounded-lg"
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: t.paid ? "rgba(0,201,167,0.15)" : "rgba(255,77,109,0.1)" }}>
                    {t.paid
                      ? <CheckCircle className="h-4 w-4" style={{ color: "#00C9A7" }} />
                      : <Clock className="h-4 w-4" style={{ color: "#FF4D6D" }} />}
                  </div>
                  <div>
                    <p style={{ color: "var(--m15-white)", fontSize: 14, fontWeight: 500 }}>{t.label}</p>
                    {t.limite && <p style={{ color: "var(--m15-muted)", fontSize: 11 }}>Limite : {t.limite}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p style={{ color: t.paid ? "#00C9A7" : "var(--m15-white)", fontSize: 14, fontWeight: 600 }}>
                    {t.montant ? fmt(t.montant) : "—"}
                  </p>
                  {!t.paid && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs mt-1"
                      style={{ color: "#00C9A7" }}
                      onClick={() => navigate(`/scolarite/paiement?eleve_id=${eleveId}&type=${t.key}`)}>
                      Payer
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Observations */}
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif", fontSize: 16 }}>Observations</CardTitle>
              <Button size="sm" variant="ghost" style={{ color: "#00C9A7" }}
                onClick={() => { setObs(scol.observations ?? ""); setEditingObs(!editingObs); }}>
                {editingObs ? "Annuler" : "Modifier"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {editingObs ? (
              <div className="space-y-2">
                <Textarea value={obs ?? ""} onChange={e => setObs(e.target.value)} rows={5}
                  placeholder="Saisir des observations..."
                  style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", resize: "none" }} />
                <Button size="sm" onClick={saveObs} disabled={updateObs.isPending}
                  style={{ background: "#00C9A7", color: "white" }}>
                  Enregistrer
                </Button>
              </div>
            ) : (
              <p style={{ color: scol.observations ? "var(--m15-white)" : "var(--m15-muted)", fontSize: 14, minHeight: 80 }}>
                {scol.observations ?? "Aucune observation."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Historique des paiements */}
      <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <CardHeader className="pb-2">
          <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif", fontSize: 16 }}>
            Historique des paiements
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!scol.paiements?.length ? (
            <p style={{ color: "var(--m15-muted)", textAlign: "center", padding: "20px 0", fontSize: 14 }}>Aucun paiement enregistré</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                    {["Date", "Type", "Montant", "Mode", "Reçu N°", "Par", ""].map(h => (
                      <th key={h} className="px-3 py-2 text-left text-xs" style={{ color: "var(--m15-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {scol.paiements.map(p => (
                    <tr key={p.id} style={{ borderBottom: "1px solid rgba(0,201,167,0.06)", opacity: p.annule ? 0.5 : 1 }}>
                      <td className="px-3 py-2" style={{ color: "var(--m15-muted)" }}>{p.date_paiement}</td>
                      <td className="px-3 py-2" style={{ color: "var(--m15-white)" }}>{TYPE_LABELS[p.type_paiement] ?? p.type_paiement}</td>
                      <td className="px-3 py-2 font-semibold" style={{ color: p.annule ? "var(--m15-muted)" : "#00C9A7" }}>
                        {fmt(p.montant)} {p.annule && <span style={{ color: "#FF4D6D", fontSize: 11 }}>(annulé)</span>}
                      </td>
                      <td className="px-3 py-2" style={{ color: "var(--m15-muted)" }}>{MODE_LABELS[p.mode_paiement] ?? p.mode_paiement}</td>
                      <td className="px-3 py-2" style={{ color: "#00C9A7", fontFamily: "monospace" }}>{p.numero_recu}</td>
                      <td className="px-3 py-2" style={{ color: "var(--m15-muted)" }}>{p.enregistre_par_nom ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" style={{ color: "#0080FF" }}
                          onClick={() => navigate(`/scolarite/recu/${p.id}`)}>
                          <FileText className="h-3 w-3 mr-1" /> Reçu
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
