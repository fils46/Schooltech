const TOKEN_KEY = "m15_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message ?? `Erreur ${res.status}`);
  return json as T;
}

function qs(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return "";
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

export const disciplineApi = {
  /* ── Incidents ── */
  signalerIncident: (data: unknown) => request("POST", "/incidents/signaler", data),
  listerIncidents: (params?: Record<string, string | number>) =>
    request("GET", `/incidents/liste${qs(params as Record<string, string | number | undefined>)}`),
  getIncident: (id: string) => request("GET", `/incidents/${id}`),
  modifierIncident: (id: string, data: unknown) => request("PUT", `/incidents/${id}/modifier`, data),
  escaladerIncident: (id: string, data: unknown) => request("PUT", `/incidents/${id}/escalader`, data),
  cloturerIncident: (id: string) => request("PUT", `/incidents/${id}/cloturer`, {}),
  historiqueEleve: (eleveId: string) => request("GET", `/incidents/eleve/${eleveId}/historique`),
  statistiques: () => request("GET", "/incidents/statistiques"),

  /* ── Sanctions ── */
  prononcerSanction: (data: unknown) => request("POST", "/sanctions/prononcer", data),
  listerSanctions: (params?: Record<string, string | number>) =>
    request("GET", `/sanctions/liste${qs(params as Record<string, string | number | undefined>)}`),
  getSanctionsEnAttente: () => request("GET", "/sanctions/en-attente"),
  validerSanction: (id: string) => request("PUT", `/sanctions/${id}/valider`, {}),
  refuserSanction: (id: string) => request("PUT", `/sanctions/${id}/refuser`, {}),
  executerSanction: (id: string) => request("PUT", `/sanctions/${id}/executer`, {}),
  annulerSanction: (id: string) => request("PUT", `/sanctions/${id}/annuler`, {}),
};

/* ── Types ── */
export type TypeIncident = "retard" | "insolence" | "bagarre" | "fraude" | "vandalisme" | "absenteisme" | "autre";
export type StatutIncident = "en_attente" | "traite" | "escalade";
export type TypeSanction = "avertissement_oral" | "avertissement_ecrit" | "retenue" | "exclusion_temp" | "exclusion_def" | "convocation_parent";
export type StatutSanction = "en_attente" | "validee" | "executee" | "annulee";

export const TYPE_INCIDENT_LABELS: Record<TypeIncident, string> = {
  retard: "Retard", insolence: "Insolence", bagarre: "Bagarre",
  fraude: "Fraude", vandalisme: "Vandalisme", absenteisme: "Absentéisme", autre: "Autre",
};

export const TYPE_INCIDENT_COLORS: Record<TypeIncident, string> = {
  retard: "#0080FF", insolence: "#F5A623", bagarre: "#FF4D6D",
  fraude: "#F5C842", vandalisme: "#C0392B", absenteisme: "#8B9DC3", autre: "#8B9DC3",
};

export const TYPE_SANCTION_LABELS: Record<TypeSanction, string> = {
  avertissement_oral: "Avertissement oral",
  avertissement_ecrit: "Avertissement écrit",
  retenue: "Retenue",
  exclusion_temp: "Exclusion temporaire",
  exclusion_def: "Exclusion définitive",
  convocation_parent: "Convocation parent",
};

export const SANCTIONS_LOURDES: TypeSanction[] = ["exclusion_temp", "exclusion_def", "convocation_parent"];
