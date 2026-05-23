import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ShieldAlert, AlertTriangle, Clock, MessageSquare,
  ChevronRight, Users, CheckCircle,
} from "lucide-react";
import { disciplineApi, TYPE_INCIDENT_LABELS, TYPE_INCIDENT_COLORS, type TypeIncident } from "@/services/disciplineService";

function BadgeIncident({ type }: { type: string }) {
  const color = TYPE_INCIDENT_COLORS[type as TypeIncident] ?? "#8B9DC3";
  const label = TYPE_INCIDENT_LABELS[type as TypeIncident] ?? type;
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}20`, color }}>
      {label}
    </span>
  );
}

export default function EducateurDashboard() {
  const { user } = useAuth();
  const today = format(new Date(), "EEEE d MMMM yyyy", { locale: fr });
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const [incidentsAujourdhui, setIncidentsAujourdhui] = useState<any[]>([]);
  const [sanctionsAttente, setSanctionsAttente] = useState<any[]>([]);
  const [topEleves, setTopEleves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [incRes, sanRes] = await Promise.allSettled([
          disciplineApi.listerIncidents({ date_debut: todayStr, date_fin: todayStr, limit: 10 }) as Promise<any>,
          disciplineApi.listerSanctions({ statut: "en_attente", limit: 5 }) as Promise<any>,
        ]);
        if (incRes.status === "fulfilled") setIncidentsAujourdhui((incRes.value as any)?.data?.incidents ?? []);
        if (sanRes.status === "fulfilled") setSanctionsAttente((sanRes.value as any)?.data?.sanctions ?? []);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [todayStr]);

  const nonTraites = incidentsAujourdhui.filter((i: any) => i.statut === "en_attente").length;

  return (
    <div className="space-y-6 page-fade-in">
      {/* Bannière */}
      <div className="relative rounded-2xl p-6 md:p-8 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, var(--m15-card2) 0%, rgba(255,77,109,0.08) 100%)",
          border: "1px solid rgba(255,77,109,0.2)",
        }}>
        <div className="absolute right-0 top-0 w-72 h-72 pointer-events-none"
          style={{ background: "radial-gradient(circle at top right, rgba(255,77,109,0.08) 0%, transparent 60%)" }} />
        <div className="relative z-10">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--m15-muted)" }}>
            {today.charAt(0).toUpperCase() + today.slice(1)}
          </p>
          <h2 className="text-4xl font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: "#FF4D6D" }}>
            Bonjour, {user?.prenoms ?? user?.nom} 👋
          </h2>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Espace Éducateur — Discipline &amp; Surveillance.</p>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", borderTop: "3px solid #FF4D6D" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>Incidents aujourd'hui</span>
            <ShieldAlert className="w-4 h-4" style={{ color: "#FF4D6D" }} />
          </div>
          {loading ? (
            <div className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "var(--elevate-2)" }} />
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#FF4D6D" }}>
                {incidentsAujourdhui.length}
              </span>
              {nonTraites > 0 && (
                <span className="mb-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D" }}>
                  {nonTraites} non traité{nonTraites > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", borderTop: "3px solid #F5C842" }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>Sanctions en attente</span>
            <Clock className="w-4 h-4" style={{ color: "#F5C842" }} />
          </div>
          {loading ? (
            <div className="h-8 w-16 rounded-lg animate-pulse" style={{ background: "var(--elevate-2)" }} />
          ) : (
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "#F5C842" }}>
                {sanctionsAttente.length}
              </span>
              {sanctionsAttente.length > 0 && (
                <span className="mb-1 w-2.5 h-2.5 rounded-full animate-pulse inline-block" style={{ background: "#F5C842" }} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Incidents du jour */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" style={{ color: "#FF4D6D" }} />
            <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Mes incidents du jour</h3>
          </div>
          <Link href="/discipline/incidents" className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "#FF4D6D" }}>
            Voir tout <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "var(--elevate-1)" }} />)}
          </div>
        ) : incidentsAujourdhui.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <CheckCircle className="w-8 h-8 mx-auto mb-2" style={{ color: "#00C9A7" }} />
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun incident signalé aujourd'hui.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
            {incidentsAujourdhui.map((inc: any) => (
              <Link key={inc.id} href={`/discipline/incidents/${inc.id}`}>
                <div className="flex items-center gap-3 px-5 py-3 cursor-pointer transition-colors"
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>
                        {inc.eleve_prenoms} {inc.eleve_nom}
                      </p>
                      {inc.classe_nom && <span className="text-xs" style={{ color: "var(--m15-muted)" }}>{inc.classe_nom}</span>}
                    </div>
                    <BadgeIncident type={inc.type_incident} />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    inc.statut === "en_attente" ? "text-amber-400" : inc.statut === "traite" ? "text-green-400" : "text-red-400"
                  }`} style={{ background: inc.statut === "en_attente" ? "rgba(245,200,66,0.1)" : inc.statut === "traite" ? "rgba(0,201,167,0.1)" : "rgba(255,77,109,0.1)" }}>
                    {inc.statut === "en_attente" ? "En attente" : inc.statut === "traite" ? "Traité" : "Escaladé"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Sanctions en attente */}
      {sanctionsAttente.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid rgba(245,200,66,0.2)" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(245,200,66,0.15)" }}>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: "#F5C842" }} />
              <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Sanctions en attente de validation</h3>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold animate-pulse"
                style={{ background: "#F5C842", color: "#0A1628" }}>
                {sanctionsAttente.length}
              </span>
            </div>
            <Link href="/discipline/sanctions" className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "#F5C842" }}>
              Voir tout <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(245,200,66,0.1)" }}>
            {sanctionsAttente.slice(0, 3).map((s: any) => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>
                    {s.eleve_prenoms} {s.eleve_nom}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{s.type_sanction.replace(/_/g, " ")}</p>
                </div>
                <span className="text-xs" style={{ color: "#F5C842" }}>{s.date_sanction}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accès rapides */}
      <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <h3 className="font-bold mb-3 text-sm uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>
          Accès rapides
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {[
            { href: "/discipline/incidents", label: "Signaler un incident", icon: ShieldAlert, color: "#FF4D6D" },
            { href: "/discipline/sanctions", label: "Sanctions en attente", icon: Clock, color: "#F5C842" },
            { href: "/absences", label: "Absences (lecture)", icon: Users, color: "#00C9A7" },
            { href: "/messagerie", label: "Messagerie", icon: MessageSquare, color: "#0080FF" },
          ].map(({ href, label, icon: Icon, color }) => (
            <Link key={href} href={href}>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-colors"
                style={{ background: `${color}0C`, border: `1px solid ${color}20` }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = `${color}18`; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = `${color}0C`; }}>
                <Icon className="w-4 h-4 flex-shrink-0" style={{ color }} />
                <span className="text-xs font-semibold" style={{ color }}>{label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
