import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle, Clock, AlertTriangle, FileText, DollarSign, RefreshCw } from "lucide-react";
import {
  useGetScolariteEleveEleveId,
  useListerAnneesScolaires,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

type Paiement = {
  id: string; numero_recu: string; montant: string; mode_paiement: string;
  type_paiement: string; date_paiement: string; annule: boolean;
};
type ScolariteDetail = {
  id: string; statut: "en_regle" | "partiel" | "impaye";
  montant_total_du: string; montant_total_paye: string; montant_restant: string;
  inscription_payee: boolean; tranche1_payee: boolean; tranche2_payee: boolean; tranche3_payee: boolean;
  eleve_nom?: string; eleve_prenoms?: string; eleve_matricule?: string; classe_nom?: string;
  frais_config?: {
    frais_inscription: string; frais_tranche1: string; frais_tranche2: string; frais_tranche3: string;
    date_limite_tranche1?: string; date_limite_tranche2?: string; date_limite_tranche3?: string;
  };
  paiements?: Paiement[];
};

function fmt(v: string | number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return new Intl.NumberFormat("fr-FR").format(Math.round(isNaN(n) ? 0 : n)) + " FCFA";
}

const TYPE_LABELS: Record<string, string> = {
  inscription: "Inscription", tranche1: "1ère tranche", tranche2: "2ème tranche",
  tranche3: "3ème tranche", autre: "Autre",
};
const MODE_LABELS: Record<string, string> = {
  especes: "Espèces", cheque: "Chèque", virement: "Virement", mobile_money: "Mobile Money",
};

export default function ScolariteParent() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const enfantId = (user as { eleve_id?: string; enfant_id?: string } | undefined)?.eleve_id
    ?? (user as { eleve_id?: string; enfant_id?: string } | undefined)?.enfant_id ?? "";
  const [selectedEnfantId, setSelectedEnfantId] = useState(enfantId);

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { annees?: Array<{ id: string; libelle: string; active?: boolean }> } | undefined)?.annees ?? [];
  const anneeActive = annees.find(a => a.active);
  const [anneeScolaireId, setAnneeScolaireId] = useState("");

  const params = anneeScolaireId ? { annee_scolaire_id: anneeScolaireId } : {};
  const { data: raw, isLoading, refetch } = useGetScolariteEleveEleveId(
    selectedEnfantId || "00000000-0000-0000-0000-000000000000",
    params,
    { query: { enabled: !!selectedEnfantId, queryKey: [] } }
  );
  const scol = (raw as { data?: ScolariteDetail } | undefined)?.data;

  const statutMap = {
    en_regle: { label: "En règle", color: "#00C9A7", icon: CheckCircle },
    partiel: { label: "Paiement partiel", color: "#F5C842", icon: Clock },
    impaye: { label: "Impayé", color: "#FF4D6D", icon: AlertTriangle },
  };
  const sInfo = scol ? statutMap[scol.statut] : null;

  const tranches = scol ? [
    { label: "Frais d'inscription", paid: scol.inscription_payee, montant: scol.frais_config?.frais_inscription, limite: null },
    { label: "1ère tranche", paid: scol.tranche1_payee, montant: scol.frais_config?.frais_tranche1, limite: scol.frais_config?.date_limite_tranche1 },
    { label: "2ème tranche", paid: scol.tranche2_payee, montant: scol.frais_config?.frais_tranche2, limite: scol.frais_config?.date_limite_tranche2 },
    { label: "3ème tranche", paid: scol.tranche3_payee, montant: scol.frais_config?.frais_tranche3, limite: scol.frais_config?.date_limite_tranche3 },
  ] : [];

  const restant = parseFloat(scol?.montant_restant ?? "0");

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--m15-navy)" }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)", fontSize: 24, fontWeight: 700 }}>
            Ma scolarité
          </h1>
          <p style={{ color: "var(--m15-muted)", fontSize: 14 }}>Suivi des frais scolaires de votre enfant</p>
        </div>
        <div className="flex gap-2">
          <Select value={anneeScolaireId} onValueChange={setAnneeScolaireId}>
            <SelectTrigger className="w-44" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder={anneeActive?.libelle ?? "Année scolaire"} />
            </SelectTrigger>
            <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              {annees.map(a => <SelectItem key={a.id} value={a.id} style={{ color: "var(--m15-white)" }}>{a.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetch()}
            style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Alerte impayé */}
      {scol && restant > 0 && (
        <div className="mb-4 p-4 rounded-xl flex items-center gap-3"
          style={{ background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)" }}>
          <AlertTriangle className="h-5 w-5 shrink-0" style={{ color: "#FF4D6D" }} />
          <p style={{ color: "#FF4D6D", fontWeight: 600 }}>
            Solde restant à payer : <span style={{ fontSize: 18 }}>{fmt(scol.montant_restant)}</span>
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "var(--m15-card)" }} />)}
        </div>
      ) : !scol ? (
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardContent className="py-12 text-center">
            <DollarSign className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--m15-muted)" }} />
            <p style={{ color: "var(--m15-muted)" }}>Aucune information de scolarité disponible pour cette année.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Résumé */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            {[
              { label: "Total dû", value: scol.montant_total_du, color: "var(--m15-muted)" },
              { label: "Payé", value: scol.montant_total_paye, color: "#00C9A7" },
              { label: "Restant", value: scol.montant_restant, color: restant > 0 ? "#FF4D6D" : "#00C9A7" },
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

          {/* Statut */}
          {sInfo && (
            <div className="flex items-center gap-3 mb-4 p-3 rounded-lg"
              style={{ background: `${sInfo.color}15`, border: `1px solid ${sInfo.color}33` }}>
              <sInfo.icon className="h-5 w-5" style={{ color: sInfo.color }} />
              <span style={{ color: sInfo.color, fontWeight: 600 }}>{sInfo.label}</span>
            </div>
          )}

          {/* Détail tranches */}
          <Card className="mb-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <CardHeader className="pb-2">
              <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif", fontSize: 16 }}>
                Détail des paiements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tranches.map(t => (
                <div key={t.label} className="flex items-center justify-between p-3 rounded-lg"
                  style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ background: t.paid ? "rgba(0,201,167,0.15)" : "rgba(255,77,109,0.1)" }}>
                      {t.paid
                        ? <CheckCircle className="h-4 w-4" style={{ color: "#00C9A7" }} />
                        : <Clock className="h-4 w-4" style={{ color: "#FF4D6D" }} />}
                    </div>
                    <div>
                      <p style={{ color: "var(--m15-white)", fontSize: 14 }}>{t.label}</p>
                      {t.limite && !t.paid && (
                        <p style={{ color: "#FF4D6D", fontSize: 11 }}>Date limite : {t.limite}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p style={{ color: t.paid ? "#00C9A7" : "var(--m15-muted)", fontWeight: 600 }}>
                      {t.montant ? fmt(t.montant) : "—"}
                    </p>
                    <Badge style={{
                      background: t.paid ? "rgba(0,201,167,0.15)" : "rgba(255,77,109,0.1)",
                      color: t.paid ? "#00C9A7" : "#FF4D6D",
                      border: "none", fontSize: 10,
                    }}>
                      {t.paid ? "Payé" : "En attente"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Historique */}
          <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <CardHeader className="pb-2">
              <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif", fontSize: 16 }}>
                Historique des paiements
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!scol.paiements?.length ? (
                <p style={{ color: "var(--m15-muted)", textAlign: "center", padding: "16px 0", fontSize: 14 }}>
                  Aucun paiement enregistré
                </p>
              ) : (
                <div className="space-y-2">
                  {scol.paiements.filter(p => !p.annule).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg"
                      style={{ background: "var(--m15-card2)" }}>
                      <div>
                        <p style={{ color: "var(--m15-white)", fontSize: 14, fontWeight: 500 }}>
                          {TYPE_LABELS[p.type_paiement] ?? p.type_paiement}
                        </p>
                        <p style={{ color: "var(--m15-muted)", fontSize: 12 }}>
                          {p.date_paiement} · {MODE_LABELS[p.mode_paiement] ?? p.mode_paiement}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-3">
                        <p style={{ color: "#00C9A7", fontWeight: 700 }}>{fmt(p.montant)}</p>
                        <Button size="sm" variant="ghost" style={{ color: "#0080FF" }}
                          onClick={() => navigate(`/scolarite/recu/${p.id}`)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
