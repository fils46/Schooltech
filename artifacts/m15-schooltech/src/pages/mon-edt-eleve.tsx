import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useListerAnneesScolaires } from "@workspace/api-client-react";
import { RefreshCw, Calendar } from "lucide-react";
import { GrilleEDT } from "@/components/GrilleEDT";

type Jour = "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi";

interface GrilleShape {
  grille?: Record<Jour, Record<string, unknown>[]>;
  creneaux?: Record<string, unknown>[];
  classe_nom?: string;
}

function useMonEdtEleve(eleveId: string, anneeId: string) {
  return useQuery<GrilleShape>({
    queryKey: ["emploi-eleve", eleveId, anneeId],
    enabled: !!eleveId && !!anneeId,
    queryFn: async () => {
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const token = localStorage.getItem("m15_token");
      const res = await fetch(
        `${base}/api/emploi-du-temps/eleve/${eleveId}?annee_scolaire_id=${anneeId}`,
        { headers: { Authorization: `Bearer ${token ?? ""}` } }
      );
      if (!res.ok) throw new Error("Erreur de chargement");
      return res.json() as Promise<GrilleShape>;
    },
  });
}

export default function MonEdtEleve() {
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

  const eleveId = user?.id ?? "";
  const emploi = useMonEdtEleve(eleveId, anneeId);

  const data = emploi.data;
  const grille = data?.grille ?? { lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [], samedi: [] };
  const creneaux = data?.creneaux ?? [];
  const classeNom = data?.classe_nom;

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
            {classeNom ? `Classe : ${classeNom}` : "Votre planning hebdomadaire"}
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

      {emploi.isError && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(255,77,109,0.1)", border: "1px solid rgba(255,77,109,0.3)", color: "#FF4D6D" }}
        >
          Impossible de charger votre emploi du temps. Vérifiez que vous êtes bien inscrit dans une classe.
        </div>
      )}

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
            mode="eleve"
            vide="L'emploi du temps de votre classe n'a pas encore été publié"
          />
        )}
      </div>
    </div>
  );
}
