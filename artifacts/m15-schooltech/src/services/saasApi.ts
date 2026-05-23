const TOKEN_KEY = "m15_token";

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

async function request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/saas${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((json as any).message ?? `Erreur ${res.status}`);
  }
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

/* ── Établissements ──────────────────────────────────────────── */
export const saasApi = {
  getEtablissements: (params?: Record<string, string>) =>
    request("GET", `/etablissements${qs(params)}`),

  creerEtablissement: (data: unknown) =>
    request("POST", "/etablissements", data),

  getEtablissement: (id: string) =>
    request("GET", `/etablissements/${id}`),

  modifierEtablissement: (id: string, data: unknown) =>
    request("PUT", `/etablissements/${id}`, data),

  suspendreEtablissement: (id: string) =>
    request("PUT", `/etablissements/${id}/suspendre`),

  reactiverEtablissement: (id: string) =>
    request("PUT", `/etablissements/${id}/reactiver`),

  /* ── Stats SaaS ─────────────────────────────────────────────── */
  getStats: () =>
    request("GET", "/stats"),

  /* ── Licences ───────────────────────────────────────────────── */
  getLicence: (etabId: string) =>
    request("GET", `/etablissements/${etabId}/licence`),

  renouvelerLicence: (etabId: string, data: unknown) =>
    request("POST", `/etablissements/${etabId}/licence/renouveler`, data),

  modifierLicence: (licenceId: string, data: unknown) =>
    request("PUT", `/licences/${licenceId}`, data),

  enregistrerPaiement: (licenceId: string, data: unknown) =>
    request("POST", `/licences/${licenceId}/paiements`, data),

  getPaiements: (params?: Record<string, string>) =>
    request("GET", `/paiements${qs(params)}`),

  getLicencesExpirant: () =>
    request("GET", "/licences/expirant"),

  /* ── Directeurs ─────────────────────────────────────────────── */
  creerDirecteur: (etabId: string, data: unknown) =>
    request("POST", `/etablissements/${etabId}/directeur`, data),

  getDirecteurs: (params?: Record<string, string>) =>
    request("GET", `/directeurs${qs(params)}`),

  reinitialiserMdp: (directeurId: string) =>
    request("POST", `/directeurs/${directeurId}/reinitialiser`),

  /* ── Logs ───────────────────────────────────────────────────── */
  getLogs: (params?: Record<string, string | number>) =>
    request("GET", `/logs${qs(params)}`),
};
