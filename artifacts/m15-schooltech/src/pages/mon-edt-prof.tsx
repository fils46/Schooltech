import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useGetEmploiProfesseur, getGetEmploiProfesseurQueryKey, useListerAnneesScolaires } from "@workspace/api-client-react";
import { RefreshCw, Calendar } from "lucide-react";
import { GrilleEDT } from "@/components/GrilleEDT";

type Jour = "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi";

export default function MonEdtProf() {
  const { user } = useAuth();
  const [anneeId, setAnneeId] = useState("");

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as unknown as { annees?: Record<string, string>[] })?.annees ?? [];

  useEffect(() => {
    if (!anneeId && annees.length > 0) {
      const active = annees.find((a: Record<string, unknown>) => a.est_active);
      setAnneeId(String((active ?? annees[0])?.id ?? ""));
    }
  }, [annees, anneeId]);

  const profId = user?.id ?? "";
  const emploi = useGetEmploiProfesseur(profId, { annee_scolaire_id: anneeId }, {
    query: {
      queryKey: getGetEmploiProfesseurQueryKey(profId, { annee_scolaire_id: anneeId }),
      enabled: !!profId && !!anneeId,
    },
  });

  type GrilleShape = { grille?: Record<Jour, Record<string, unknown>[]>; creneaux?: Record<string, unknown>[] };
  const data = emploi.data as unknown as GrilleShape | undefined;
  const grille = data?.grille ?? { lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [], samedi: [] };
  const creneaux = data?.creneaux ?? [];

  const anneeActuelle = annees.find((a: Record<string, string>) => a.id === anneeId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3 items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="w-5 h-5" style={{ color: "#00C9A7" }} />
            <h1
              className="text-2xl font-extrabold"
              style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}
            >
              Mon emploi du temps
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Votre planning hebdomadaire
            {anneeActuelle ? ` — ${anneeActuelle.libelle}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {annees.length > 1 && (
            <select
              value={anneeId}
              onChange={e => setAnneeId(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm"
              style={{
                background: "var(--m15-card)",
                border: "1px solid var(--m15-border)",
                color: "var(--m15-white)",
              }}
            >
              {annees.map((a: Record<string, string>) => (
                <option key={a.id} value={a.id}>{a.libelle}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => void emploi.refetch()}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
            style={{
              background: "var(--m15-card)",
              border: "1px solid var(--m15-border)",
              color: "var(--m15-muted)",
            }}
          >
            <RefreshCw className={`w-4 h-4 ${emploi.isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div
        className="rounded-2xl p-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}
      >
        {emploi.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "#00C9A7" }} />
          </div>
        ) : (
          <GrilleEDT
            grille={grille}
            creneaux={creneaux}
            mode="professeur"
            vide="Votre emploi du temps n'a pas encore été publié"
          />
        )}
      </div>
    </div>
  );
}
