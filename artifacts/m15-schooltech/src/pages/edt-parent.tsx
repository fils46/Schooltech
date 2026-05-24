import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { useGetEmploiClasse, getGetEmploiClasseQueryKey, useListerAnneesScolaires } from "@workspace/api-client-react";
import { RefreshCw, Calendar, ChevronDown } from "lucide-react";
import { GrilleEDT } from "@/components/GrilleEDT";

type Jour = "lundi" | "mardi" | "mercredi" | "jeudi" | "vendredi" | "samedi";

interface Enfant {
  eleve_id: string;
  nom: string;
  prenoms: string;
  classe_nom: string;
  classe_id?: string | null;
  annee_scolaire_id?: string | null;
}

interface ParentDashboard {
  enfants?: Enfant[];
}

function useParentDashboard() {
  const { user } = useAuth();
  return useQuery<ParentDashboard>({
    queryKey: ["parent-dashboard", user?.id],
    enabled: !!user?.id && user.role === "parent",
    queryFn: async () => {
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const token = localStorage.getItem("m15_token");
      const res = await fetch(`${base}/api/parent/dashboard`, {
        headers: { Authorization: `Bearer ${token ?? ""}` },
      });
      if (!res.ok) throw new Error("Erreur");
      return res.json() as Promise<ParentDashboard>;
    },
  });
}

export default function EdtParent() {
  const [enfantIdx, setEnfantIdx] = useState(0);
  const [anneeId, setAnneeId] = useState("");

  const { data: dashboardData } = useParentDashboard();
  const enfants: Enfant[] = dashboardData?.enfants ?? [];
  const enfantActif = enfants[enfantIdx];

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as unknown as { annees?: Record<string, string>[] })?.annees ?? [];

  useEffect(() => {
    if (!anneeId && annees.length > 0) {
      const active = annees.find((a: Record<string, unknown>) => a.est_active);
      setAnneeId(String((active ?? annees[0])?.id ?? ""));
    }
  }, [annees, anneeId]);

  const classeId = enfantActif?.classe_id ?? "";
  const emploi = useGetEmploiClasse(classeId, { annee_scolaire_id: anneeId }, {
    query: {
      queryKey: getGetEmploiClasseQueryKey(classeId, { annee_scolaire_id: anneeId }),
      enabled: !!classeId && !!anneeId,
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
              Emploi du temps
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Planning hebdomadaire de votre enfant
            {anneeActuelle ? ` — ${anneeActuelle.libelle}` : ""}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {enfants.length > 0 && (
            <div className="relative">
              <select
                value={enfantIdx}
                onChange={e => setEnfantIdx(Number(e.target.value))}
                className="pl-3 pr-8 py-2 rounded-xl text-sm appearance-none"
                style={{
                  background: "var(--m15-card)",
                  border: "1px solid var(--m15-border)",
                  color: "var(--m15-white)",
                }}
              >
                {enfants.map((e, i) => (
                  <option key={e.eleve_id} value={i}>
                    {e.prenoms} {e.nom}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "var(--m15-muted)" }}
              />
            </div>
          )}

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

      {enfantActif && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(0,201,167,0.06)", border: "1px solid rgba(0,201,167,0.15)" }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: "rgba(0,201,167,0.15)", color: "#00C9A7" }}
          >
            {enfantActif.prenoms[0]}
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
              {enfantActif.prenoms} {enfantActif.nom}
            </p>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
              {enfantActif.classe_nom || "Classe non renseignée"}
            </p>
          </div>
        </div>
      )}

      {enfants.length === 0 && (
        <div
          className="rounded-xl px-4 py-8 text-center"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}
        >
          <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Aucun enfant lié à votre compte
          </p>
        </div>
      )}

      {enfantActif && !classeId && (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(255,184,0,0.1)", border: "1px solid rgba(255,184,0,0.3)", color: "#FFB800" }}
        >
          Votre enfant n'est pas encore inscrit dans une classe pour cette année scolaire.
        </div>
      )}

      {enfantActif && classeId && (
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
              vide="L'emploi du temps de la classe n'a pas encore été publié"
            />
          )}
        </div>
      )}
    </div>
  );
}
