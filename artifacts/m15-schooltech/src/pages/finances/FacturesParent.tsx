import { useGetFacturesEleve } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, CheckCircle, Clock, XCircle } from "lucide-react";

function formatFCFA(n: number | string | null | undefined): string {
  const v = parseFloat(String(n ?? "0")) || 0;
  return v.toLocaleString("fr-CI") + " FCFA";
}

const STATUT_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  en_attente: { label: "En attente", color: "bg-yellow-500", icon: Clock },
  paye: { label: "Payé ✓", color: "bg-green-600", icon: CheckCircle },
  annule: { label: "Annulé", color: "bg-gray-500", icon: XCircle },
};

const CATEGORIE_COLORS: Record<string, string> = {
  sortie: "bg-blue-600",
  document: "bg-purple-600",
  club: "bg-orange-500",
  autre: "bg-gray-500",
};

type Facture = {
  id: string;
  libelle: string;
  categorie: string;
  montant: string;
  statut: string;
  date_emission: string;
  date_paiement: string | null;
  reference_paiement: string | null;
  note: string | null;
};

export default function FacturesParent() {
  const { user } = useAuth();

  const eleveId = user?.id ?? "";
  const { data: rawData, isLoading } = useGetFacturesEleve(eleveId);

  const factures: Facture[] = (rawData as { data?: { factures?: Facture[] } })?.data?.factures ?? [];
  const totalPaye = (rawData as { data?: { total_paye?: number } })?.data?.total_paye ?? 0;
  const totalEnAttente = (rawData as { data?: { total_en_attente?: number } })?.data?.total_en_attente ?? 0;

  if (user?.role !== "parent" && user?.role !== "eleve") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--m15-muted)]">Accès réservé aux parents et élèves.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
          <Receipt className="h-7 w-7 text-[var(--m15-cyan)]" />
          Mes factures
        </h1>
        <p className="text-[var(--m15-muted)] text-sm mt-1">Historique des services et prestations</p>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <p className="text-[var(--m15-muted)] text-xs uppercase tracking-wider mb-1">Total payé</p>
            <p className="text-2xl font-bold text-green-400">{formatFCFA(totalPaye)}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <p className="text-[var(--m15-muted)] text-xs uppercase tracking-wider mb-1">En attente</p>
            <p className="text-2xl font-bold text-yellow-400">{formatFCFA(totalEnAttente)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Liste des factures */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-[var(--m15-card)] animate-pulse border border-[var(--m15-border)]" />
          ))
        ) : factures.length === 0 ? (
          <div className="text-center py-12">
            <Receipt className="h-12 w-12 text-[var(--m15-muted)] mx-auto mb-3" />
            <p className="text-[var(--m15-muted)]">Aucune facture pour le moment</p>
          </div>
        ) : (
          factures.map(f => {
            const statut = STATUT_CONFIG[f.statut] ?? STATUT_CONFIG.annule;
            const StatusIcon = statut.icon;
            return (
              <Card key={f.id} className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[var(--m15-white)] font-medium">{f.libelle}</p>
                        <Badge className={`${CATEGORIE_COLORS[f.categorie] ?? "bg-gray-500"} text-white text-xs`}>{f.categorie}</Badge>
                      </div>
                      <p className="text-[var(--m15-muted)] text-sm mt-1">Émise le {f.date_emission}</p>
                      {f.date_paiement && (
                        <p className="text-green-400 text-xs mt-0.5">Payée le {f.date_paiement}</p>
                      )}
                      {f.reference_paiement && (
                        <p className="text-[var(--m15-muted)] text-xs">Réf. : {f.reference_paiement}</p>
                      )}
                      {f.note && (
                        <p className="text-[var(--m15-muted)] text-xs mt-1 italic">Note : {f.note}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold" style={{ color: "#F5C842" }}>{formatFCFA(f.montant)}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <StatusIcon className="h-3.5 w-3.5" style={{ color: f.statut === "paye" ? "#4ade80" : f.statut === "en_attente" ? "#eab308" : "#6b7280" }} />
                        <span className="text-xs" style={{ color: f.statut === "paye" ? "#4ade80" : f.statut === "en_attente" ? "#eab308" : "#6b7280" }}>
                          {statut.label}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
