import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, CheckCircle, XCircle } from "lucide-react";
import { useGetPaiementsIdRecu } from "@workspace/api-client-react";

type RecuData = {
  numero_recu: string; date_paiement: string; annule?: boolean;
  eleve: { nom?: string; prenoms?: string; matricule?: string; classe?: string };
  paiement: { type: string; mode: string; montant: number; reference?: string; observations?: string; annule?: boolean };
  scolarite: { total_du: number; total_paye: number; restant: number };
  enregistre_par: string;
};

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";
}

export default function RecuPaiement() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { data: raw, isLoading } = useGetPaiementsIdRecu(id!);
  const recu = (raw as { data?: RecuData } | undefined)?.data;

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--m15-navy)" }}>
      <div className="w-8 h-8 border-2 border-[#00C9A7] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!recu) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: "var(--m15-navy)" }}>
      <p style={{ color: "var(--m15-muted)" }}>Reçu introuvable.</p>
      <Button onClick={() => window.history.back()} variant="outline" style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Retour
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--m15-navy)" }}>
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" onClick={() => window.history.back()} style={{ color: "var(--m15-muted)" }}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <Button onClick={() => window.print()} style={{ background: "#0080FF", color: "white" }}>
          <Printer className="h-4 w-4 mr-2" /> Imprimer
        </Button>
      </div>

      <div className="max-w-lg mx-auto">
        <Card style={{ background: "white", border: "none", boxShadow: "0 4px 24px rgba(0,0,0,0.15)" }}>
          <CardContent className="p-8">
            {/* En-tête */}
            <div className="text-center border-b border-gray-200 pb-5 mb-5">
              <div className="flex items-center justify-center mb-2">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center mr-3" style={{ background: "#0A1628" }}>
                  <span style={{ color: "#00C9A7", fontWeight: 900, fontSize: 14 }}>M15</span>
                </div>
                <div className="text-left">
                  <p style={{ color: "#0A1628", fontWeight: 700, fontFamily: "'Syne', sans-serif", fontSize: 16 }}>M15-SchoolTech</p>
                  <p style={{ color: "#8B9DC3", fontSize: 12 }}>Plateforme scolaire</p>
                </div>
              </div>
              <h2 style={{ fontFamily: "'Syne', sans-serif", color: "#0A1628", fontSize: 28, fontWeight: 900, letterSpacing: 2 }}>
                REÇU DE PAIEMENT
              </h2>
              <p style={{ color: "#00C9A7", fontFamily: "monospace", fontSize: 20, fontWeight: 700 }}>
                N° {recu.numero_recu}
              </p>
              {recu.paiement.annule && (
                <Badge style={{ background: "#FF4D6D22", color: "#FF4D6D", border: "1px solid #FF4D6D55", marginTop: 8 }}>
                  ANNULÉ
                </Badge>
              )}
            </div>

            {/* Infos élève */}
            <div className="mb-5 p-4 rounded-lg" style={{ background: "#F8FAFC" }}>
              <p style={{ color: "#8B9DC3", fontSize: 11, fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>ÉLÈVE</p>
              <p style={{ color: "#0A1628", fontWeight: 700, fontSize: 16 }}>{recu.eleve.prenoms} {recu.eleve.nom}</p>
              <div className="flex gap-4 mt-1">
                <span style={{ color: "#8B9DC3", fontSize: 13 }}>Matricule : {recu.eleve.matricule ?? "—"}</span>
                <span style={{ color: "#8B9DC3", fontSize: 13 }}>Classe : {recu.eleve.classe ?? "—"}</span>
              </div>
            </div>

            {/* Détail paiement */}
            <div className="mb-5 space-y-3">
              <p style={{ color: "#8B9DC3", fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>DÉTAIL DU PAIEMENT</p>
              {[
                { label: "Nature", value: recu.paiement.type },
                { label: "Montant", value: fmt(recu.paiement.montant), bold: true, color: "#00C9A7" },
                { label: "Mode", value: recu.paiement.mode },
                { label: "Date", value: recu.date_paiement },
                ...(recu.paiement.reference ? [{ label: "Référence", value: recu.paiement.reference }] : []),
              ].map(({ label, value, bold, color }) => (
                <div key={label} className="flex justify-between items-center py-1" style={{ borderBottom: "1px solid #F0F4FF" }}>
                  <span style={{ color: "#8B9DC3", fontSize: 13 }}>{label}</span>
                  <span style={{ color: color ?? "#0A1628", fontWeight: bold ? 700 : 500, fontSize: bold ? 18 : 13 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Récapitulatif scolarité */}
            <div className="mb-5 p-4 rounded-lg" style={{ background: "#F8FAFC" }}>
              <p style={{ color: "#8B9DC3", fontSize: 11, fontWeight: 600, letterSpacing: 1, marginBottom: 8 }}>RÉCAPITULATIF SCOLARITÉ</p>
              {[
                { label: "Total dû", value: fmt(recu.scolarite.total_du) },
                { label: "Total payé", value: fmt(recu.scolarite.total_paye), color: "#00C9A7" },
                { label: "Reste à payer", value: fmt(recu.scolarite.restant), color: recu.scolarite.restant > 0 ? "#FF4D6D" : "#00C9A7" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex justify-between">
                  <span style={{ color: "#8B9DC3", fontSize: 13 }}>{label}</span>
                  <span style={{ color: color ?? "#0A1628", fontWeight: 600, fontSize: 13 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Pied */}
            <div className="flex items-center justify-between pt-4" style={{ borderTop: "1px solid #E2E8F0" }}>
              <div className="flex items-center gap-2">
                {recu.paiement.annule
                  ? <XCircle className="h-5 w-5" style={{ color: "#FF4D6D" }} />
                  : <CheckCircle className="h-5 w-5" style={{ color: "#00C9A7" }} />}
                <span style={{ color: "#0A1628", fontSize: 12 }}>Ce reçu est valable comme justificatif officiel</span>
              </div>
              <div className="text-right">
                <p style={{ color: "#8B9DC3", fontSize: 11 }}>Enregistré par</p>
                <p style={{ color: "#0A1628", fontSize: 12, fontWeight: 600 }}>{recu.enregistre_par}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
