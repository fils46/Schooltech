import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, ShieldAlert, AlertTriangle, CheckCircle,
  TrendingUp, Calendar,
} from "lucide-react";
import { disciplineApi, TYPE_INCIDENT_LABELS, TYPE_INCIDENT_COLORS, TYPE_SANCTION_LABELS, type TypeIncident, type TypeSanction } from "@/services/disciplineService";

function RisqueGauge({ nbIncidents }: { nbIncidents: number }) {
  const level = nbIncidents === 0 ? "faible" : nbIncidents <= 2 ? "modéré" : "élevé";
  const color = level === "faible" ? "#00C9A7" : level === "modéré" ? "#F5C842" : "#FF4D6D";
  const pct = Math.min(100, (nbIncidents / 10) * 100);
  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: `1px solid ${color}25` }}>
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--m15-muted)" }}>Niveau de risque</p>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-2xl font-bold uppercase" style={{ fontFamily: "'Syne', sans-serif", color }}>
          {level}
        </span>
        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: `${color}20`, color }}>
          {nbIncidents} incident{nbIncidents > 1 ? "s" : ""}
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "var(--elevate-1)" }}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function HistoriqueDisciplinaire() {
  const { eleveId } = useParams<{ eleveId: string }>();
  const [, setLocation] = useLocation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"timeline" | "incidents" | "sanctions">("timeline");

  useEffect(() => {
    disciplineApi.historiqueEleve(eleveId as string)
      .then(setData)
      .catch(() => setLocation("/discipline/incidents"))
      .finally(() => setLoading(false));
  }, [eleveId]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "#FF4D6D", borderTopColor: "transparent" }} />
    </div>
  );

  const { eleve, incidents, sanctions, resume } = (data as any)?.data ?? {};
  if (!eleve) return null;

  const timeline = [
    ...(incidents ?? []).map((i: any) => ({ ...i, _type: "incident", _date: i.date_incident })),
    ...(sanctions ?? []).map((s: any) => ({ ...s, _type: "sanction", _date: s.date_sanction })),
  ].sort((a, b) => b._date.localeCompare(a._date));

  return (
    <div className="space-y-6 page-fade-in">
      <button onClick={() => history.back()}
        className="flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: "var(--m15-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>

      {/* En-tête élève */}
      <div className="rounded-2xl p-6" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
            style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D", fontFamily: "'Syne', sans-serif" }}>
            {eleve.prenoms?.charAt(0)}{eleve.nom?.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              {eleve.prenoms} {eleve.nom}
            </h2>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Matricule : {eleve.matricule}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Total incidents", value: resume?.total_incidents ?? 0, color: "#FF4D6D" },
            { label: "Sanctions actives", value: resume?.sanctions_actives ?? 0, color: "#F5C842" },
            { label: "Total sanctions", value: resume?.total_sanctions ?? 0, color: "#0080FF" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl p-3 text-center" style={{ background: `${color}0A`, border: `1px solid ${color}20` }}>
              <p className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>{value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Jauge */}
      <RisqueGauge nbIncidents={resume?.total_incidents ?? 0} />

      {/* Tabs */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          {[
            { id: "timeline" as const, label: "Timeline" },
            { id: "incidents" as const, label: `Incidents (${incidents?.length ?? 0})` },
            { id: "sanctions" as const, label: `Sanctions (${sanctions?.length ?? 0})` },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="px-5 py-3.5 text-sm font-semibold transition-all"
              style={{
                color: activeTab === id ? "#FF4D6D" : "var(--m15-muted)",
                borderBottom: activeTab === id ? "2px solid #FF4D6D" : "2px solid transparent",
              }}>
              {label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* Timeline */}
          {activeTab === "timeline" && (
            <div className="space-y-3">
              {timeline.length === 0 ? (
                <p className="text-center py-10 text-sm" style={{ color: "var(--m15-muted)" }}>Aucun évènement disciplinaire.</p>
              ) : timeline.map((item: any) => {
                const isInc = item._type === "incident";
                const color = isInc ? (TYPE_INCIDENT_COLORS[item.type_incident as TypeIncident] ?? "#8B9DC3") : "#F5C842";
                return (
                  <div key={item.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                        {isInc ? <AlertTriangle className="w-4 h-4" style={{ color }} /> : <ShieldAlert className="w-4 h-4" style={{ color }} />}
                      </div>
                      <div className="flex-1 w-0.5 mt-1" style={{ background: "var(--m15-border)" }} />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
                            {isInc
                              ? TYPE_INCIDENT_LABELS[item.type_incident as TypeIncident]
                              : TYPE_SANCTION_LABELS[item.type_sanction as TypeSanction]}
                          </p>
                          {isInc && item.description && (
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--m15-muted)" }}>{item.description}</p>
                          )}
                        </div>
                        <span className="text-xs flex-shrink-0 mt-0.5" style={{ color: "var(--m15-muted)" }}>{item._date}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Incidents list */}
          {activeTab === "incidents" && (
            <div className="space-y-2">
              {(incidents ?? []).length === 0 ? (
                <p className="text-center py-10 text-sm" style={{ color: "var(--m15-muted)" }}>Aucun incident enregistré.</p>
              ) : (incidents ?? []).map((inc: any) => {
                const color = TYPE_INCIDENT_COLORS[inc.type_incident as TypeIncident] ?? "#8B9DC3";
                return (
                  <div key={inc.id} className="flex items-start gap-3 rounded-xl px-4 py-3"
                    style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
                    <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ background: color }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold" style={{ color }}>{TYPE_INCIDENT_LABELS[inc.type_incident as TypeIncident]}</span>
                        <span className="text-xs" style={{ color: "var(--m15-muted)" }}>{inc.date_incident}</span>
                      </div>
                      <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{inc.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sanctions list */}
          {activeTab === "sanctions" && (
            <div className="space-y-2">
              {(sanctions ?? []).length === 0 ? (
                <p className="text-center py-10 text-sm" style={{ color: "var(--m15-muted)" }}>Aucune sanction enregistrée.</p>
              ) : (sanctions ?? []).map((s: any) => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
                      {TYPE_SANCTION_LABELS[s.type_sanction as TypeSanction]}
                    </p>
                    <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{s.date_sanction}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      background: s.statut === "validee" || s.statut === "executee" ? "rgba(0,201,167,0.12)" : "rgba(139,157,195,0.12)",
                      color: s.statut === "validee" || s.statut === "executee" ? "#00C9A7" : "#8B9DC3",
                    }}>
                    {s.statut}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
