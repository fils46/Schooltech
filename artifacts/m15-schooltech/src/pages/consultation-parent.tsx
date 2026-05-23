import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Heart, Clock, Stethoscope, Activity, FileText,
  User, AlertTriangle, ChevronDown, ChevronUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGetMesEnfants } from "@workspace/api-client-react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";

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

interface EnfantItem {
  id: string;
  nom: string;
  prenoms: string;
  matricule: string;
  photo_url?: string;
  classe_nom?: string;
}

interface ConsultationItem {
  id: string;
  motif: string;
  symptomes?: string;
  traitement_administre?: string;
  medicaments_donnes?: string;
  heure_entree: string;
  heure_sortie?: string;
  statut: string;
  observations?: string;
  infirmier_nom?: string;
  classe_nom?: string;
}

interface ConsultationsEleveResponse {
  consultations: ConsultationItem[];
  stats: {
    nb_visites: number;
    motifs_frequents: Array<{ motif: string; count: number }>;
  };
}

function ConsultationCard({ c }: { c: ConsultationItem }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
      <CardContent className="p-4">
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <div className={`h-2 w-2 rounded-full ${c.statut === "en_cours" ? "bg-yellow-400" : c.statut === "hospitalise" ? "bg-red-400" : "bg-emerald-400"}`} />
            <div>
              <p className="text-[var(--m15-white)] font-medium">{c.motif}</p>
              <p className="text-[var(--m15-muted)] text-sm">
                {new Date(c.heure_entree).toLocaleDateString("fr-FR", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={STATUT_COLORS[c.statut] ?? ""} variant="outline">
              {STATUT_LABELS[c.statut] ?? c.statut}
            </Badge>
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-[var(--m15-muted)]" />
            ) : (
              <ChevronDown className="h-4 w-4 text-[var(--m15-muted)]" />
            )}
          </div>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-[var(--m15-border)] space-y-3">
            {c.symptomes && (
              <div>
                <p className="text-[var(--m15-muted)] text-xs font-medium mb-1">Symptômes</p>
                <p className="text-[var(--m15-white)] text-sm">{c.symptomes}</p>
              </div>
            )}
            {c.traitement_administre && (
              <div>
                <p className="text-[var(--m15-muted)] text-xs font-medium mb-1">Traitement administré</p>
                <p className="text-[var(--m15-white)] text-sm">{c.traitement_administre}</p>
              </div>
            )}
            {c.medicaments_donnes && (
              <div>
                <p className="text-[var(--m15-muted)] text-xs font-medium mb-1">Médicaments donnés</p>
                <p className="text-[var(--m15-white)] text-sm">{c.medicaments_donnes}</p>
              </div>
            )}
            {c.heure_sortie && (
              <div className="flex items-center gap-2">
                <Clock className="h-3 w-3 text-[var(--m15-muted)]" />
                <span className="text-[var(--m15-muted)] text-xs">
                  Sortie : {new Date(c.heure_sortie).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
            {c.observations && (
              <div>
                <p className="text-[var(--m15-muted)] text-xs font-medium mb-1">Observations</p>
                <p className="text-[var(--m15-white)] text-sm">{c.observations}</p>
              </div>
            )}
            {c.infirmier_nom && (
              <div className="flex items-center gap-2 text-[var(--m15-muted)] text-xs">
                <Stethoscope className="h-3 w-3" />
                Suivi par : {c.infirmier_nom}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ConsultationParent() {
  const { user } = useAuth();
  const [selectedEnfantId, setSelectedEnfantId] = useState<string>("");

  const { data: enfantsData } = useGetMesEnfants();
  const enfants: EnfantItem[] = (enfantsData as { enfants?: EnfantItem[] } | undefined)?.enfants ?? [];

  const enfantActif: EnfantItem | undefined = selectedEnfantId
    ? enfants.find(e => e.id === selectedEnfantId)
    : enfants[0];

  const effectiveId = selectedEnfantId || enfantActif?.id || "";

  const token = localStorage.getItem("m15_token");
  const { data: consultationsData, isLoading } = useQuery<ConsultationsEleveResponse>({
    queryKey: ["infirmerie-eleve-consultations", effectiveId],
    queryFn: async () => {
      const res = await axios.get(`/api/infirmerie/eleve/${effectiveId}/consultations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as ConsultationsEleveResponse;
    },
    enabled: !!effectiveId,
  });

  const consultations: ConsultationItem[] = consultationsData?.consultations ?? [];
  const stats = consultationsData?.stats;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
          <Heart className="h-7 w-7 text-rose-400" />
          Infirmerie
        </h1>
        <p className="text-[var(--m15-muted)] text-sm mt-1">Historique des consultations infirmerie de votre enfant</p>
      </div>

      {/* Sélection enfant si plusieurs */}
      {enfants.length > 1 && (
        <div className="max-w-xs">
          <Select
            value={selectedEnfantId || enfantActif?.id || ""}
            onValueChange={setSelectedEnfantId}
          >
            <SelectTrigger className="bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)]">
              <SelectValue placeholder="Sélectionner un enfant" />
            </SelectTrigger>
            <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
              {enfants.map(e => (
                <SelectItem key={e.id} value={e.id} className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">
                  {e.nom} {e.prenoms}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {enfantActif && (
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4 flex items-center gap-4">
            {enfantActif.photo_url ? (
              <img src={enfantActif.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-[var(--m15-card2)] flex items-center justify-center">
                <User className="h-7 w-7 text-[var(--m15-muted)]" />
              </div>
            )}
            <div>
              <p className="text-[var(--m15-white)] text-lg font-bold">{enfantActif.nom} {enfantActif.prenoms}</p>
              <p className="text-[var(--m15-muted)] text-sm">Mat. {enfantActif.matricule} · {enfantActif.classe_nom ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardContent className="p-4 text-center">
              <p className="text-[var(--m15-muted)] text-xs">Total des visites</p>
              <p className="text-3xl font-bold text-rose-400">{stats.nb_visites}</p>
            </CardContent>
          </Card>
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[var(--m15-muted)] text-xs">Motifs fréquents</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 px-4 pb-4 space-y-1">
              {stats.motifs_frequents.slice(0, 3).map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-[var(--m15-white)] text-xs truncate flex-1">{m.motif}</span>
                  <Badge variant="outline" className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs ml-2">{m.count}×</Badge>
                </div>
              ))}
              {stats.motifs_frequents.length === 0 && (
                <p className="text-[var(--m15-muted)] text-xs">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Liste des consultations */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-[var(--m15-white)] flex items-center gap-2">
          <Activity className="h-5 w-5 text-cyan-400" />
          Historique des consultations
        </h2>

        {isLoading ? (
          <div className="text-center text-[var(--m15-muted)] py-10">Chargement…</div>
        ) : consultations.length === 0 ? (
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardContent className="p-8 text-center">
              <Heart className="h-12 w-12 text-[var(--m15-muted)] mx-auto mb-3" />
              <p className="text-[var(--m15-muted)]">Aucune consultation enregistrée</p>
            </CardContent>
          </Card>
        ) : (
          consultations.map(c => <ConsultationCard key={c.id} c={c} />)
        )}
      </div>
    </div>
  );
}
