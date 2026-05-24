import { useState, useEffect } from "react";
import { saasApi } from "@/services/saasApi";
import { RefreshCw, Filter, Download, ChevronLeft, ChevronRight } from "lucide-react";

const C = {
  navy: "var(--m15-navy)", card: "var(--m15-card)", cyan: "#00C9A7", gold: "#F5C842",
  blue: "#0080FF", red: "#FF4D6D", muted: "#8B9DC3", border: "rgba(0,201,167,0.15)",
};

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  etablissement_cree:             { icon: "🏫", color: C.cyan },
  etablissement_modifie:          { icon: "✏️", color: C.blue },
  etablissement_suspendu:         { icon: "⏸️", color: C.red },
  etablissement_reactive:         { icon: "▶️", color: C.cyan },
  directeur_cree:                 { icon: "👤", color: C.gold },
  licence_renouvelee:             { icon: "🔄", color: C.cyan },
  licence_modifiee:               { icon: "📝", color: C.blue },
  paiement_enregistre:            { icon: "💰", color: "#34D399" },
  mot_de_passe_reinitialise:      { icon: "🔑", color: C.gold },
};

const ACTIONS_OPTIONS = Object.keys(ACTION_ICONS);

export default function LogsSaas() {
  const [data, setData] = useState<{ logs: any[]; pagination: any } | null>(null);
  const [etablissements, setEtablissements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filtreEtab, setFiltreEtab] = useState("");
  const [filtreAction, setFiltreAction] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  async function load(p = page) {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, limit: 30 };
      if (filtreEtab) params.etablissement_id = filtreEtab;
      if (filtreAction) params.action = filtreAction;
      if (dateDebut) params.date_debut = dateDebut;
      if (dateFin) params.date_fin = dateFin;

      const [logsRes, etabsRes] = await Promise.all([
        saasApi.getLogs(params as Record<string, string>) as any,
        etablissements.length === 0 ? (saasApi.getEtablissements() as any) : Promise.resolve({ data: etablissements }),
      ]);
      setData(logsRes.data);
      if (etablissements.length === 0) setEtablissements(etabsRes.data ?? []);
    } catch { } finally { setLoading(false); }
  }

  useEffect(() => { load(1); setPage(1); }, [filtreEtab, filtreAction, dateDebut, dateFin]);
  useEffect(() => { load(page); }, [page]);

  function exportCSV() {
    if (!data?.logs) return;
    const rows = data.logs.map((l: any) => [
      new Date(l.log.created_at).toLocaleString("fr-FR"),
      l.log.action,
      l.etablissement?.nom ?? "",
      JSON.stringify(l.log.details ?? {}),
      l.log.ip_address ?? "",
    ]);
    const csv = [["Date", "Action", "Établissement", "Détails", "IP"], ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "logs-saas.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const pagination = data?.pagination;

  return (
    <div className="p-4 md:p-8 min-h-screen" style={{ backgroundColor: C.navy }}>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--m15-white)]">Logs & Activité SaaS</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>
            {pagination?.total ?? 0} événement(s) au total
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => load(page)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "rgba(0,201,167,.12)", color: C.cyan, border: `1px solid ${C.border}` }}>
            <RefreshCw className="w-4 h-4" /> Actualiser
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "rgba(0,128,255,.12)", color: C.blue, border: "1px solid rgba(0,128,255,.25)" }}>
            <Download className="w-4 h-4" /> Exporter CSV
          </button>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <select
          className="px-3 py-2.5 rounded-lg text-sm border outline-none"
          style={{ backgroundColor: C.card, borderColor: C.border, color: filtreEtab ? "white" : C.muted }}
          value={filtreEtab}
          onChange={(e) => setFiltreEtab(e.target.value)}
        >
          <option value="">Tous les établissements</option>
          {etablissements.map((e: any) => <option key={e.id} value={e.id}>{e.nom}</option>)}
        </select>
        <select
          className="px-3 py-2.5 rounded-lg text-sm border outline-none"
          style={{ backgroundColor: C.card, borderColor: C.border, color: filtreAction ? "white" : C.muted }}
          value={filtreAction}
          onChange={(e) => setFiltreAction(e.target.value)}
        >
          <option value="">Toutes les actions</option>
          {ACTIONS_OPTIONS.map((a) => (
            <option key={a} value={a}>{a.replace(/_/g, " ")}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="px-3 py-2.5 rounded-lg text-sm border outline-none"
            style={{ backgroundColor: C.card, borderColor: C.border, color: C.muted }}
            value={dateDebut}
            onChange={(e) => setDateDebut(e.target.value)}
          />
          <span style={{ color: C.muted }}>→</span>
          <input
            type="date"
            className="px-3 py-2.5 rounded-lg text-sm border outline-none"
            style={{ backgroundColor: C.card, borderColor: C.border, color: C.muted }}
            value={dateFin}
            onChange={(e) => setDateFin(e.target.value)}
          />
        </div>
        {(filtreEtab || filtreAction || dateDebut || dateFin) && (
          <button
            onClick={() => { setFiltreEtab(""); setFiltreAction(""); setDateDebut(""); setDateFin(""); }}
            className="px-3 py-2.5 rounded-lg text-sm"
            style={{ color: C.muted, border: `1px solid ${C.border}` }}
          >
            Réinitialiser
          </button>
        )}
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: C.cyan, borderTopColor: "transparent" }} />
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.border }}>
          {(!data?.logs || data.logs.length === 0) ? (
            <p className="px-5 py-12 text-center text-sm" style={{ color: C.muted }}>Aucun log disponible pour ces filtres</p>
          ) : (
            <div className="divide-y" style={{ borderColor: C.border }}>
              {data.logs.map((entry: any) => {
                const l = entry.log;
                const etabNom = entry.etablissement?.nom;
                const ai = ACTION_ICONS[l.action] ?? { icon: "📋", color: C.muted };

                return (
                  <div key={l.id} className="flex gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                      style={{ backgroundColor: `${ai.color}15` }}
                    >
                      {ai.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-[var(--m15-white)]">
                            {l.action.replace(/_/g, " ")}
                          </p>
                          {etabNom && (
                            <p className="text-xs mt-0.5" style={{ color: C.cyan }}>
                              {etabNom}
                            </p>
                          )}
                          {l.details && Object.keys(l.details).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-2">
                              {Object.entries(l.details).map(([k, v]) => (
                                <span key={k} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "rgba(139,157,195,.1)", color: C.muted }}>
                                  {k}: {String(v)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs" style={{ color: C.muted }}>
                            {new Date(l.created_at).toLocaleDateString("fr-FR")}
                          </p>
                          <p className="text-xs" style={{ color: C.muted }}>
                            {new Date(l.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {l.ip_address && (
                            <p className="text-xs mt-0.5" style={{ color: "rgba(139,157,195,.5)" }}>
                              {l.ip_address}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t" style={{ borderColor: C.border }}>
              <p className="text-xs" style={{ color: C.muted }}>
                Page {pagination.page} / {pagination.pages} — {pagination.total} logs
              </p>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: C.navy, color: C.muted, border: `1px solid ${C.border}` }}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  disabled={page >= pagination.pages}
                  onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                  className="p-1.5 rounded-lg disabled:opacity-40"
                  style={{ backgroundColor: C.navy, color: C.muted, border: `1px solid ${C.border}` }}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
