import { useState, useEffect } from "react";
import { Link } from "wouter";
import { saasApi } from "@/services/saasApi";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CreditCard, AlertTriangle, TrendingUp, RefreshCw, ChevronRight } from "lucide-react";

const C = {
  navy: "var(--m15-navy)", card: "var(--m15-card)", cyan: "#00C9A7", gold: "#F5C842",
  blue: "#0080FF", red: "#FF4D6D", muted: "#8B9DC3", border: "rgba(0,201,167,0.15)",
};

const MODES: Record<string, string> = {
  virement: "Virement", mobile_money: "Mobile Money",
  especes: "Espèces", cheque: "Chèque", autre: "Autre",
};
const STATUTS: Record<string, { label: string; color: string }> = {
  confirme: { label: "Confirmé", color: C.cyan },
  en_attente: { label: "En attente", color: C.gold },
  echec: { label: "Échec", color: C.red },
};

export default function GestionLicences() {
  const [licencesExp, setLicencesExp] = useState<any[]>([]);
  const [paiements, setPaiements] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreMode, setFiltreMode] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [sRes, lRes, pRes] = await Promise.all([
        saasApi.getStats() as any,
        saasApi.getLicencesExpirant() as any,
        saasApi.getPaiements() as any,
      ]);
      setStats(sRes.data);
      setLicencesExp(lRes.data ?? []);
      setPaiements(pRes.data ?? []);
    } catch { } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function renouveler(etabId: string) {
    const duree = prompt("Durée de renouvellement (mois) :");
    if (!duree) return;
    try {
      await saasApi.renouvelerLicence(etabId, { duree_mois: Number(duree) });
      await load();
    } catch (e: any) { alert(e.message); }
  }

  const filteredPaiements = paiements.filter((p: any) => {
    if (filtreStatut && p.paiement.statut !== filtreStatut) return false;
    if (filtreMode && p.paiement.mode_paiement !== filtreMode) return false;
    if (dateDebut && p.paiement.date_paiement < dateDebut) return false;
    if (dateFin && p.paiement.date_paiement > dateFin) return false;
    return true;
  });

  const totalConfirme = filteredPaiements
    .filter((p: any) => p.paiement.statut === "confirme")
    .reduce((acc: number, p: any) => acc + Number(p.paiement.montant), 0);

  // Grouper paiements par mois pour le graphique
  const paiementsParMois: Record<string, number> = {};
  paiements.forEach((p: any) => {
    if (p.paiement.statut !== "confirme") return;
    const mois = p.paiement.date_paiement?.substring(0, 7) ?? "";
    paiementsParMois[mois] = (paiementsParMois[mois] ?? 0) + Number(p.paiement.montant);
  });
  const chartData = Object.entries(paiementsParMois)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([mois, total]) => ({ mois, total }));

  const kpis = stats ? [
    { label: "Licences actives", value: stats.etablissements?.actifs ?? 0, color: C.cyan, bg: "rgba(0,201,167,.12)" },
    { label: "Expirant < 30j", value: stats.licences?.expirant_30j ?? 0, color: C.gold, bg: "rgba(245,200,66,.12)" },
    { label: "Revenus ce mois", value: `${(stats.revenus?.ce_mois ?? 0).toLocaleString("fr-FR")} FCFA`, color: "#34D399", bg: "rgba(52,211,153,.12)" },
    { label: "Revenus cette année", value: `${(stats.revenus?.cette_annee ?? 0).toLocaleString("fr-FR")} FCFA`, color: C.blue, bg: "rgba(0,128,255,.12)" },
  ] : [];

  return (
    <div className="p-8 min-h-screen" style={{ backgroundColor: C.navy }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)]">Licences & Paiements</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Gestion des licences et suivi des paiements</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: "rgba(0,201,167,.12)", color: C.cyan, border: `1px solid ${C.border}` }}>
          <RefreshCw className="w-4 h-4" /> Actualiser
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: C.cyan, borderTopColor: "transparent" }} />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.border }}>
                <p className="text-xs mb-2" style={{ color: C.muted }}>{k.label}</p>
                <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Licences expirant bientôt */}
          {licencesExp.length > 0 && (
            <div className="mb-8 rounded-xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: C.border }}>
                <AlertTriangle className="w-4 h-4" style={{ color: C.gold }} />
                <h3 className="text-sm font-semibold text-[var(--m15-white)]">Licences expirant dans 30 jours</h3>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    {["Établissement", "Type", "Expiration", "Jours restants", "Montant", "Action"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: C.muted }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {licencesExp.map((l: any) => {
                    const daysLeft = Math.floor((new Date(l.licence.date_expiration).getTime() - Date.now()) / 86400_000);
                    return (
                      <tr key={l.licence.id} className="border-b" style={{ borderColor: C.border }}>
                        <td className="px-4 py-3">
                          <Link href={`/saas/etablissements/${l.etablissement.id}`}>
                            <a className="text-sm font-medium" style={{ color: C.cyan }}>{l.etablissement.nom}</a>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm capitalize" style={{ color: C.muted }}>{l.licence.type}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{new Date(l.licence.date_expiration).toLocaleDateString("fr-FR")}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: daysLeft <= 7 ? "rgba(255,77,109,.15)" : "rgba(245,200,66,.15)", color: daysLeft <= 7 ? C.red : C.gold }}>
                            {daysLeft}j
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[var(--m15-white)]">{Number(l.licence.montant).toLocaleString("fr-FR")} FCFA</td>
                        <td className="px-4 py-3">
                          <button onClick={() => renouveler(l.etablissement.id)} className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: "rgba(0,201,167,.1)", color: C.cyan }}>
                            Renouveler
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <div className="rounded-xl p-5 border" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <h3 className="text-sm font-semibold text-[var(--m15-white)] mb-4">Revenus par mois (FCFA)</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,.1)" />
                    <XAxis dataKey="mois" tick={{ fill: C.muted, fontSize: 10 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 10 }} />
                    <Tooltip contentStyle={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: "var(--m15-white)" }} formatter={(v: number) => [`${v.toLocaleString("fr-FR")} FCFA`, "Revenus"]} />
                    <Bar dataKey="total" fill={C.cyan} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center" style={{ color: C.muted }}>
                  <p className="text-sm">Aucun paiement confirmé</p>
                </div>
              )}
            </div>
            <div className="rounded-xl p-5 border" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <h3 className="text-sm font-semibold text-[var(--m15-white)] mb-4">Répartition par type</h3>
              <div className="space-y-3 mt-2">
                {(stats?.par_type ?? []).map((t: any) => (
                  <div key={t.type} className="flex items-center gap-3">
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm capitalize" style={{ color: C.muted }}>{t.type}</span>
                      <span className="text-sm font-semibold text-[var(--m15-white)]">{t.nb}</span>
                    </div>
                    <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(139,157,195,.2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(t.nb / (stats?.etablissements?.total || 1)) * 100}%`, backgroundColor: C.cyan }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Tous les paiements */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: C.border }}>
              <h3 className="text-sm font-semibold text-[var(--m15-white)]">Tous les paiements</h3>
              <p className="text-xs" style={{ color: C.cyan }}>Total filtré : {totalConfirme.toLocaleString("fr-FR")} FCFA</p>
            </div>

            {/* Filtres */}
            <div className="px-5 py-3 flex gap-3 border-b" style={{ borderColor: C.border }}>
              <select className="px-3 py-2 rounded-lg text-sm border outline-none" style={{ backgroundColor: C.navy, borderColor: C.border, color: filtreStatut ? "white" : C.muted }} value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
                <option value="">Tous statuts</option>
                <option value="confirme">Confirmé</option>
                <option value="en_attente">En attente</option>
                <option value="echec">Échec</option>
              </select>
              <select className="px-3 py-2 rounded-lg text-sm border outline-none" style={{ backgroundColor: C.navy, borderColor: C.border, color: filtreMode ? "white" : C.muted }} value={filtreMode} onChange={(e) => setFiltreMode(e.target.value)}>
                <option value="">Tous modes</option>
                {Object.entries(MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <input type="date" className="px-3 py-2 rounded-lg text-sm border outline-none" style={{ backgroundColor: C.navy, borderColor: C.border, color: C.muted }} value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
              <input type="date" className="px-3 py-2 rounded-lg text-sm border outline-none" style={{ backgroundColor: C.navy, borderColor: C.border, color: C.muted }} value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
            </div>

            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Établissement", "Date", "Montant", "Mode", "Référence", "Statut", "Note"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPaiements.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-8 text-center text-sm" style={{ color: C.muted }}>Aucun paiement</td></tr>
                ) : filteredPaiements.map((p: any) => {
                  const s = STATUTS[p.paiement.statut] ?? STATUTS.en_attente;
                  return (
                    <tr key={p.paiement.id} className="border-b" style={{ borderColor: C.border }}>
                      <td className="px-4 py-3">
                        <Link href={`/saas/etablissements/${p.etablissement.id}`}>
                          <a className="text-sm font-medium" style={{ color: C.cyan }}>{p.etablissement.nom}</a>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{new Date(p.paiement.date_paiement).toLocaleDateString("fr-FR")}</td>
                      <td className="px-4 py-3 text-sm font-medium text-[var(--m15-white)]">{Number(p.paiement.montant).toLocaleString("fr-FR")} FCFA</td>
                      <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{MODES[p.paiement.mode_paiement]}</td>
                      <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{p.paiement.reference ?? "—"}</td>
                      <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${s.color}20`, color: s.color }}>{s.label}</span></td>
                      <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{p.paiement.note ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
