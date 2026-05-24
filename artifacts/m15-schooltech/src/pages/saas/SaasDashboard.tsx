import { useState, useEffect } from "react";
import { Link } from "wouter";
import { saasApi } from "@/services/saasApi";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Building2, AlertTriangle, Clock, TrendingUp,
  Plus, RefreshCw, ChevronRight, CheckCircle, XCircle,
} from "lucide-react";

const C = {
  navy: "var(--m15-navy)", card: "var(--m15-card)", cyan: "#00C9A7", gold: "#F5C842",
  blue: "#0080FF", red: "#FF4D6D", muted: "#8B9DC3",
  border: "rgba(0,201,167,0.15)",
};

function fmt(n: number) {
  return n.toLocaleString("fr-FR");
}

interface Stats {
  etablissements: { total: number; actifs: number; suspendus: number; essai: number; nouveaux_ce_mois: number };
  licences: { expirant_30j: number };
  revenus: { ce_mois: number; ce_trimestre: number; cette_annee: number };
  evolution: { mois: string; nb: number }[];
  revenus_mensuels?: { mois: string; total: number }[];
  par_type: { type: string; nb: number }[];
  par_ville: { ville: string; nb: number }[];
}

function Badge({ statut }: { statut: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    actif:    { label: "Actif",    bg: "rgba(0,201,167,.15)",   color: C.cyan },
    expiré:   { label: "Expiré",   bg: "rgba(255,77,109,.15)",  color: C.red },
    suspendu: { label: "Suspendu", bg: "rgba(139,157,195,.15)", color: C.muted },
    essai:    { label: "Essai",    bg: "rgba(245,200,66,.15)",  color: C.gold },
  };
  const s = map[statut] ?? map.suspendu;
  return (
    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export default function SaasDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [etabs, setEtabs] = useState<any[]>([]);
  const [licencesExp, setLicencesExp] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [sRes, eRes, lRes] = await Promise.all([
        saasApi.getStats() as any,
        saasApi.getEtablissements() as any,
        saasApi.getLicencesExpirant() as any,
      ]);
      setStats(sRes.data);
      setEtabs((eRes.data ?? []).slice(0, 6));
      setLicencesExp(lRes.data ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const kpis = stats ? [
    { label: "Établissements actifs", value: stats.etablissements.actifs, icon: Building2, color: C.cyan, bg: "rgba(0,201,167,.12)" },
    { label: "Licences expirant < 30j", value: stats.licences.expirant_30j, icon: Clock, color: C.gold, bg: "rgba(245,200,66,.12)" },
    { label: "Établissements suspendus", value: stats.etablissements.suspendus, icon: XCircle, color: C.red, bg: "rgba(255,77,109,.12)" },
    { label: "Revenus ce mois (FCFA)", value: fmt(stats.revenus.ce_mois), icon: TrendingUp, color: "#34D399", bg: "rgba(52,211,153,.12)" },
    { label: "Nouveaux ce mois", value: stats.etablissements.nouveaux_ce_mois, icon: Plus, color: C.blue, bg: "rgba(0,128,255,.12)" },
  ] : [];

  const alertes7j = licencesExp.filter((l) => {
    const diff = (new Date(l.licence.date_expiration).getTime() - Date.now()) / 86400_000;
    return diff >= 0 && diff <= 7;
  });
  const alertes30j = licencesExp.filter((l) => {
    const diff = (new Date(l.licence.date_expiration).getTime() - Date.now()) / 86400_000;
    return diff > 7 && diff <= 30;
  });
  const alertesExpirees = licencesExp.filter((l) => {
    return new Date(l.licence.date_expiration) < new Date();
  });

  return (
    <div className="p-4 md:p-8 min-h-screen" style={{ backgroundColor: C.navy }}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--m15-white)]">Dashboard SaaS</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>Vue d'ensemble de la plateforme M15-SchoolTech</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={load}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all"
            style={{ backgroundColor: "rgba(0,201,167,.12)", color: C.cyan, border: `1px solid ${C.border}` }}
          >
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </button>
          <Link href="/saas/etablissements">
            <a
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[var(--m15-white)]"
              style={{ backgroundColor: C.cyan }}
            >
              <Plus className="w-4 h-4" />
              Nouvel établissement
            </a>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: C.cyan, borderTopColor: "transparent" }} />
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-xl p-4 border" style={{ backgroundColor: C.card, borderColor: C.border }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs" style={{ color: C.muted }}>{k.label}</p>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: k.bg }}>
                    <k.icon className="w-4 h-4" style={{ color: k.color }} />
                  </div>
                </div>
                <p className="text-2xl font-bold" style={{ color: k.color }}>{k.value}</p>
              </div>
            ))}
          </div>

          {/* Alertes */}
          {(alertesExpirees.length > 0 || alertes7j.length > 0 || alertes30j.length > 0) && (
            <div className="mb-8 space-y-3">
              <h2 className="text-sm font-semibold text-[var(--m15-white)] mb-3">Alertes</h2>
              {alertesExpirees.length > 0 && (
                <div className="rounded-xl p-4 border" style={{ backgroundColor: "rgba(255,77,109,.06)", borderColor: "rgba(255,77,109,.25)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" style={{ color: C.red }} />
                      <span className="text-sm font-medium" style={{ color: C.red }}>
                        {alertesExpirees.length} licence(s) expirée(s)
                      </span>
                    </div>
                    <Link href="/saas/licences">
                      <a className="text-xs font-medium" style={{ color: C.red }}>Gérer <ChevronRight className="inline w-3 h-3" /></a>
                    </Link>
                  </div>
                </div>
              )}
              {alertes7j.length > 0 && (
                <div className="rounded-xl p-4 border" style={{ backgroundColor: "rgba(245,200,66,.06)", borderColor: "rgba(245,200,66,.25)" }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" style={{ color: C.gold }} />
                      <span className="text-sm font-medium" style={{ color: C.gold }}>
                        {alertes7j.length} licence(s) expirant dans 7 jours
                      </span>
                    </div>
                    <Link href="/saas/licences">
                      <a className="text-xs font-medium" style={{ color: C.gold }}>Renouveler <ChevronRight className="inline w-3 h-3" /></a>
                    </Link>
                  </div>
                </div>
              )}
              {alertes30j.length > 0 && (
                <div className="rounded-xl p-4 border" style={{ backgroundColor: "rgba(0,128,255,.06)", borderColor: "rgba(0,128,255,.25)" }}>
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" style={{ color: C.blue }} />
                    <span className="text-sm font-medium" style={{ color: C.blue }}>
                      {alertes30j.length} licence(s) expirant dans les 30 prochains jours
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Courbe croissance */}
            <div className="rounded-xl p-5 border" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <h3 className="text-sm font-semibold text-[var(--m15-white)] mb-4">Croissance plateforme</h3>
              {(stats?.evolution?.length ?? 0) > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={stats!.evolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,.1)" />
                    <XAxis dataKey="mois" tick={{ fill: C.muted, fontSize: 11 }} />
                    <YAxis tick={{ fill: C.muted, fontSize: 11 }} />
                    <Tooltip contentStyle={{ backgroundColor: C.card, border: `1px solid ${C.border}`, color: "var(--m15-white)" }} />
                    <Line type="monotone" dataKey="nb" stroke={C.cyan} strokeWidth={2} dot={{ fill: C.cyan, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center" style={{ color: C.muted }}>
                  <p className="text-sm">Aucune donnée de croissance disponible</p>
                </div>
              )}
            </div>

            {/* Répartition par type */}
            <div className="rounded-xl p-5 border" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <h3 className="text-sm font-semibold text-[var(--m15-white)] mb-4">Revenus annuels : {fmt(stats?.revenus.cette_annee ?? 0)} FCFA</h3>
              <div className="space-y-3 mt-4">
                <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: C.border }}>
                  <span className="text-sm" style={{ color: C.muted }}>Ce mois</span>
                  <span className="text-sm font-semibold" style={{ color: C.cyan }}>{fmt(stats?.revenus.ce_mois ?? 0)} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b" style={{ borderColor: C.border }}>
                  <span className="text-sm" style={{ color: C.muted }}>Ce trimestre</span>
                  <span className="text-sm font-semibold" style={{ color: C.gold }}>{fmt(stats?.revenus.ce_trimestre ?? 0)} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm" style={{ color: C.muted }}>Cette année</span>
                  <span className="text-sm font-semibold text-[var(--m15-white)]">{fmt(stats?.revenus.cette_annee ?? 0)} FCFA</span>
                </div>
                <div className="mt-4">
                  <p className="text-xs mb-2" style={{ color: C.muted }}>Répartition par type</p>
                  {(stats?.par_type ?? []).map((t) => (
                    <div key={t.type} className="flex justify-between text-xs py-1">
                      <span className="capitalize" style={{ color: C.muted }}>{t.type}</span>
                      <span style={{ color: C.cyan }}>{t.nb}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Derniers établissements */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
              <h3 className="text-sm font-semibold text-[var(--m15-white)]">Derniers établissements ajoutés</h3>
              <Link href="/saas/etablissements">
                <a className="text-xs" style={{ color: C.cyan }}>Voir tous <ChevronRight className="inline w-3 h-3" /></a>
              </Link>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Établissement", "Type", "Ville", "Licence", "Expiration", "Utilisateurs"].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {etabs.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: C.muted }}>Aucun établissement</td></tr>
                ) : etabs.map((e) => {
                  const licenceStatut = !e.licence_active ? "suspendu" : e.licence?.type === "essai" ? "essai" : "actif";
                  return (
                    <tr key={e.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: C.border }}>
                      <td className="px-5 py-3">
                        <Link href={`/saas/etablissements/${e.id}`}>
                          <a className="text-sm font-medium" style={{ color: C.cyan }}>{e.nom}</a>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-sm capitalize" style={{ color: C.muted }}>{e.type ?? "—"}</td>
                      <td className="px-5 py-3 text-sm" style={{ color: C.muted }}>{e.ville ?? "—"}</td>
                      <td className="px-5 py-3"><Badge statut={licenceStatut} /></td>
                      <td className="px-5 py-3 text-sm" style={{ color: C.muted }}>
                        {e.date_expiration_licence ? new Date(e.date_expiration_licence).toLocaleDateString("fr-FR") : "—"}
                      </td>
                      <td className="px-5 py-3 text-sm" style={{ color: C.muted }}>{e.nb_utilisateurs}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
