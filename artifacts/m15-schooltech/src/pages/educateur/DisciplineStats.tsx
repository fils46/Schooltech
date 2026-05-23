import { useState, useEffect } from "react";
import { Link } from "wouter";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ShieldAlert, Clock, Users, TrendingUp, Download, AlertTriangle } from "lucide-react";
import { disciplineApi, TYPE_INCIDENT_LABELS, TYPE_SANCTION_LABELS, type TypeIncident, type TypeSanction } from "@/services/disciplineService";

const COLORS = ["#FF4D6D", "#F5C842", "#0080FF", "#00C9A7", "#A78BFA", "#8B9DC3", "#F5A623"];

function StatCard({ label, value, icon: Icon, color, badge }: { label: string; value: number | string; icon: React.ElementType; color: string; badge?: number }) {
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", borderTop: `3px solid ${color}` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>{label}</span>
        <div className="relative">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}18` }}>
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          {badge !== undefined && badge > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold animate-pulse"
              style={{ background: color, color: "#0A1628" }}>
              {badge}
            </span>
          )}
        </div>
      </div>
      <span className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>{value}</span>
    </div>
  );
}

export default function DisciplineStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    disciplineApi.statistiques()
      .then((res: any) => setStats(res?.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="space-y-6 page-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl animate-pulse" style={{ background: "var(--m15-card)" }} />)}
      </div>
    </div>
  );

  const parType = (stats?.par_type ?? []).map((t: any) => ({
    name: TYPE_INCIDENT_LABELS[t.type as TypeIncident] ?? t.type,
    value: t.nb,
  }));

  const parMois = (stats?.par_mois ?? []).slice(-6).map((m: any) => ({
    name: m.mois.slice(5), value: m.nb,
  }));

  const sanctionsType = (stats?.sanctions_par_type ?? []).map((s: any) => ({
    name: TYPE_SANCTION_LABELS[s.type as TypeSanction] ?? s.type,
    value: s.nb,
  }));

  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Tableau de bord disciplinaire
        </h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total incidents" value={stats?.total_incidents ?? 0} icon={ShieldAlert} color="#FF4D6D" />
        <StatCard label="Sanctions en attente" value={stats?.sanctions_en_attente ?? 0} icon={Clock} color="#F5C842" badge={stats?.sanctions_en_attente} />
        <StatCard label="Types d'incidents" value={parType.length} icon={AlertTriangle} color="#0080FF" />
        <StatCard label="Élèves récidivistes" value={(stats?.top_eleves ?? []).filter((e: any) => e.nb_incidents >= 3).length} icon={Users} color="#A78BFA" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incidents par type */}
        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <h3 className="font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Incidents par type
          </h3>
          {parType.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "var(--m15-muted)" }}>Aucune donnée disponible.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={parType} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8B9DC3" }} />
                <YAxis tick={{ fontSize: 10, fill: "#8B9DC3" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.15)", borderRadius: 12, color: "#fff" }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {parType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Évolution par mois */}
        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <h3 className="font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Évolution (6 derniers mois)
          </h3>
          {parMois.length === 0 ? (
            <p className="text-center py-10 text-sm" style={{ color: "var(--m15-muted)" }}>Aucune donnée disponible.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={parMois} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8B9DC3" }} />
                <YAxis tick={{ fontSize: 10, fill: "#8B9DC3" }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.15)", borderRadius: 12, color: "#fff" }} />
                <Line type="monotone" dataKey="value" stroke="#FF4D6D" strokeWidth={2} dot={{ fill: "#FF4D6D", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      {sanctionsType.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <h3 className="font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Répartition des sanctions
          </h3>
          <div className="flex items-center gap-6 flex-wrap">
            <ResponsiveContainer width={200} height={200}>
              <PieChart>
                <Pie data={sanctionsType} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {sanctionsType.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.15)", borderRadius: 12, color: "#fff" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-2">
              {sanctionsType.map((s: any, i: number) => (
                <div key={s.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs flex-1" style={{ color: "var(--m15-white)" }}>{s.name}</span>
                  <span className="text-xs font-bold" style={{ color: COLORS[i % COLORS.length] }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top élèves */}
      {(stats?.top_eleves ?? []).length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
            <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Top élèves à incidents
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                  {["#", "Élève", "Classe", "Incidents", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--m15-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.top_eleves.map((e: any, i: number) => (
                  <tr key={e.eleve_id} style={{ borderBottom: "1px solid var(--m15-border)" }}>
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: i < 3 ? "#FF4D6D" : "var(--m15-muted)" }}>#{i + 1}</span>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--m15-white)" }}>
                      {e.prenoms} {e.nom}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--m15-muted)" }}>{e.classe_nom || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="font-bold" style={{ color: e.nb_incidents >= 5 ? "#FF4D6D" : e.nb_incidents >= 3 ? "#F5C842" : "#00C9A7" }}>
                        {e.nb_incidents}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/discipline/historique/${e.eleve_id}`}>
                        <button className="text-xs font-semibold hover:underline" style={{ color: "#00C9A7" }}>
                          Voir historique
                        </button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
