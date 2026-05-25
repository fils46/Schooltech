import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";

const NIVEAUX_COLLEGE = ["6ème", "5ème", "4ème", "3ème"];
const NIVEAUX_LYCEE   = ["2nde", "1ère", "Terminale"];
const NIVEAUX_ALL     = [...NIVEAUX_COLLEGE, ...NIVEAUX_LYCEE];

export interface NiveauxDisponibles {
  typeEtablissement: string | null;
  niveaux: string[];
  niveauxGroupes: Array<{ label: string; niveaux: string[] }>;
  loading: boolean;
}

const DEFAUT: NiveauxDisponibles = {
  typeEtablissement: null,
  niveaux: NIVEAUX_ALL,
  niveauxGroupes: [
    { label: "Collège", niveaux: NIVEAUX_COLLEGE },
    { label: "Lycée",   niveaux: NIVEAUX_LYCEE },
  ],
  loading: true,
};

export function useNiveauxDisponibles(): NiveauxDisponibles {
  const { token, user } = useAuth();
  const [state, setState] = useState<NiveauxDisponibles>(DEFAUT);

  useEffect(() => {
    if (!token) {
      setState({ ...DEFAUT, loading: false });
      return;
    }

    setState(s => ({ ...s, loading: true }));

    fetch("/api/classes/niveaux-disponibles", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((json: { type_etablissement?: string; niveaux?: string[]; niveaux_groupes?: Array<{ label: string; niveaux: string[] }> }) => {
        setState({
          typeEtablissement: json.type_etablissement ?? null,
          niveaux: json.niveaux ?? NIVEAUX_ALL,
          niveauxGroupes: json.niveaux_groupes ?? DEFAUT.niveauxGroupes,
          loading: false,
        });
      })
      .catch(() => {
        setState({ ...DEFAUT, loading: false });
      });
  }, [token, user?.etablissement_id]);

  return state;
}
