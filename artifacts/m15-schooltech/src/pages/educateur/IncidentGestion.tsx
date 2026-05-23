import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  ShieldAlert, Plus, Filter, AlertTriangle, Clock, CheckCircle,
  Eye, ArrowUpRight, X, Search, ChevronRight,
} from "lucide-react";
import { disciplineApi, TYPE_INCIDENT_LABELS, TYPE_INCIDENT_COLORS, TYPE_SANCTION_LABELS, SANCTIONS_LOURDES, type TypeIncident, type TypeSanction } from "@/services/disciplineService";

/* ── Badge helpers ── */
function BadgeStatutIncident({ statut }: { statut: string }) {
  const map: Record<string, { color: string; label: string }> = {
    en_attente: { color: "#F5C842", label: "En attente" },
    traite: { color: "#00C9A7", label: "Traité" },
    escalade: { color: "#FF4D6D", label: "Escaladé" },
  };
  const { color, label } = map[statut] ?? { color: "var(--m15-muted)", label: statut };
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${color}18`, color }}>{label}</span>;
}

function BadgeType({ type }: { type: string }) {
  const color = TYPE_INCIDENT_COLORS[type as TypeIncident] ?? "#8B9DC3";
  const label = TYPE_INCIDENT_LABELS[type as TypeIncident] ?? type;
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${color}20`, color }}>{label}</span>;
}

/* ── Fetch Eleves helper ── */
async function fetchElevesEtab(token: string | null): Promise<any[]> {
  if (!token) return [];
  try {
    const res = await fetch("/api/eleves/liste?limit=500", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    return json.eleves ?? [];
  } catch { return []; }
}

export default function IncidentGestion() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"liste" | "signaler" | "attente">("liste");

  /* ── Liste state ── */
  const [incidents, setIncidents] = useState<any[]>([]);
  const [totalInc, setTotalInc] = useState(0);
  const [loadingInc, setLoadingInc] = useState(true);
  const [filtreType, setFiltreType] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreEleve, setFiltreEleve] = useState("");
  const [pageInc, setPageInc] = useState(1);

  /* ── Sanctions en attente state ── */
  const [sanctionsAttente, setSanctionsAttente] = useState<any[]>([]);
  const [loadingSanc, setLoadingSanc] = useState(false);
  const [refusMotif, setRefusMotif] = useState("");
  const [refusId, setRefusId] = useState<string | null>(null);

  /* ── Form state ── */
  const [eleves, setEleves] = useState<any[]>([]);
  const [eleveSearch, setEleveSearch] = useState("");
  const [form, setForm] = useState({
    eleve_id: "", type_incident: "retard" as TypeIncident,
    lieu: "", date_incident: new Date().toISOString().slice(0, 10),
    heure_incident: "", description: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = ["directeur", "censeur", "dev"].includes(user?.role ?? "");

  const chargerIncidents = useCallback(async () => {
    setLoadingInc(true);
    try {
      const res: any = await disciplineApi.listerIncidents({
        type_incident: filtreType || undefined,
        statut: filtreStatut || undefined,
        eleve_id: filtreEleve || undefined,
        page: pageInc, limit: 20,
      } as any);
      setIncidents(res?.data?.incidents ?? []);
      setTotalInc(res?.data?.total ?? 0);
    } catch { /* empty */ } finally { setLoadingInc(false); }
  }, [filtreType, filtreStatut, filtreEleve, pageInc]);

  const chargerSanctionsAttente = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingSanc(true);
    try {
      const res: any = await disciplineApi.getSanctionsEnAttente();
      setSanctionsAttente(res?.data?.sanctions ?? []);
    } catch { /* empty */ } finally { setLoadingSanc(false); }
  }, [isAdmin]);

  useEffect(() => { chargerIncidents(); }, [chargerIncidents]);
  useEffect(() => { if (activeTab === "attente") chargerSanctionsAttente(); }, [activeTab, chargerSanctionsAttente]);
  useEffect(() => {
    if (activeTab === "signaler") fetchElevesEtab(token).then(setEleves);
  }, [activeTab, token]);

  async function handleSignaler(e: React.FormEvent) {
    e.preventDefault();
    if (!form.eleve_id || !form.description) {
      toast({ title: "Champs manquants", description: "Élève et description sont requis.", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      const res: any = await disciplineApi.signalerIncident(form);
      toast({ title: "Incident signalé", description: "L'incident a été enregistré." });
      setActiveTab("liste");
      chargerIncidents();
      setLocation(`/discipline/incidents/${res?.data?.incident?.id}`);
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  async function handleValider(id: string) {
    try {
      await disciplineApi.validerSanction(id);
      toast({ title: "Sanction validée" });
      chargerSanctionsAttente();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  }

  async function handleRefuser() {
    if (!refusId) return;
    try {
      await disciplineApi.refuserSanction(refusId);
      toast({ title: "Sanction refusée" });
      setRefusId(null);
      setRefusMotif("");
      chargerSanctionsAttente();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  }

  const elevesFiltres = eleves.filter(el =>
    eleveSearch === "" ||
    `${el.nom} ${el.prenoms} ${el.matricule}`.toLowerCase().includes(eleveSearch.toLowerCase())
  );

  const tabs = [
    { id: "liste" as const, label: isAdmin ? "Tous les incidents" : "Mes incidents", icon: ShieldAlert },
    { id: "signaler" as const, label: "Signaler un incident", icon: Plus },
    ...(isAdmin ? [{ id: "attente" as const, label: "Sanctions en attente", icon: Clock }] : []),
  ];

  return (
    <div className="space-y-6 page-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Gestion de la Discipline
        </h1>
        {totalInc > 0 && (
          <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D" }}>
            {totalInc} incident{totalInc > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all relative"
              style={{
                color: activeTab === id ? "#FF4D6D" : "var(--m15-muted)",
                borderBottom: activeTab === id ? "2px solid #FF4D6D" : "2px solid transparent",
                background: activeTab === id ? "rgba(255,77,109,0.04)" : "transparent",
              }}>
              <Icon className="w-4 h-4" /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Tab: Liste ── */}
        {activeTab === "liste" && (
          <div>
            {/* Filtres */}
            <div className="flex gap-3 p-4 flex-wrap" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <select value={filtreType} onChange={e => { setFiltreType(e.target.value); setPageInc(1); }}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                <option value="">Tous les types</option>
                {Object.entries(TYPE_INCIDENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <select value={filtreStatut} onChange={e => { setFiltreStatut(e.target.value); setPageInc(1); }}
                className="rounded-xl px-3 py-2 text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                <option value="">Tous les statuts</option>
                <option value="en_attente">En attente</option>
                <option value="traite">Traité</option>
                <option value="escalade">Escaladé</option>
              </select>
              <button onClick={chargerIncidents}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
                <Filter className="w-4 h-4" /> Filtrer
              </button>
            </div>
            {/* Table */}
            {loadingInc ? (
              <div className="p-6 space-y-3">
                {[1,2,3,4].map(i => <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--elevate-1)" }} />)}
              </div>
            ) : incidents.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "#00C9A7" }} />
                <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Aucun incident trouvé</p>
                <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>Essayez d'autres filtres ou signalez un nouveau incident.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                      {["Date", "Élève", "Classe", "Type", "Statut", ""].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                          style={{ color: "var(--m15-muted)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((inc: any) => (
                      <tr key={inc.id} style={{ borderBottom: "1px solid var(--m15-border)" }}
                        className="transition-colors"
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        <td className="px-4 py-3" style={{ color: "var(--m15-muted)" }}>{inc.date_incident}</td>
                        <td className="px-4 py-3 font-medium" style={{ color: "var(--m15-white)" }}>
                          {inc.eleve_prenoms} {inc.eleve_nom}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--m15-muted)" }}>{inc.classe_nom || "—"}</td>
                        <td className="px-4 py-3"><BadgeType type={inc.type_incident} /></td>
                        <td className="px-4 py-3"><BadgeStatutIncident statut={inc.statut} /></td>
                        <td className="px-4 py-3">
                          <Link href={`/discipline/incidents/${inc.id}`}>
                            <button className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "#00C9A7" }}>
                              <Eye className="w-3.5 h-3.5" /> Voir
                            </button>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* Pagination */}
            {totalInc > 20 && (
              <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--m15-border)" }}>
                <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
                  {(pageInc - 1) * 20 + 1}–{Math.min(pageInc * 20, totalInc)} sur {totalInc}
                </span>
                <div className="flex gap-2">
                  <button disabled={pageInc === 1} onClick={() => setPageInc(p => p - 1)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
                    style={{ background: "var(--elevate-1)", color: "var(--m15-white)" }}>Préc.</button>
                  <button disabled={pageInc * 20 >= totalInc} onClick={() => setPageInc(p => p + 1)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold disabled:opacity-40"
                    style={{ background: "var(--elevate-1)", color: "var(--m15-white)" }}>Suiv.</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Signaler ── */}
        {activeTab === "signaler" && (
          <form onSubmit={handleSignaler} className="p-6 space-y-5">
            <h3 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Signaler un incident
            </h3>
            {/* Recherche élève */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)" }}>
                Élève *
              </label>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--m15-muted)" }} />
                <input value={eleveSearch} onChange={e => setEleveSearch(e.target.value)}
                  placeholder="Rechercher par nom ou matricule..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              {form.eleve_id ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: "rgba(0,201,167,0.08)", border: "1px solid rgba(0,201,167,0.2)" }}>
                  <span className="text-sm font-medium" style={{ color: "#00C9A7" }}>
                    {eleves.find(e => e.id === form.eleve_id)?.prenoms} {eleves.find(e => e.id === form.eleve_id)?.nom}
                  </span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, eleve_id: "" }))} className="ml-auto">
                    <X className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />
                  </button>
                </div>
              ) : eleveSearch.length >= 2 ? (
                <div className="rounded-xl overflow-hidden max-h-40 overflow-y-auto"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
                  {elevesFiltres.slice(0, 8).map(el => (
                    <button key={el.id} type="button"
                      onClick={() => { setForm(f => ({ ...f, eleve_id: el.id })); setEleveSearch(""); }}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors"
                      style={{ color: "var(--m15-white)", borderBottom: "1px solid var(--m15-border)" }}>
                      {el.prenoms} {el.nom} — <span style={{ color: "var(--m15-muted)" }}>{el.matricule}</span>
                    </button>
                  ))}
                  {elevesFiltres.length === 0 && <p className="px-4 py-3 text-sm" style={{ color: "var(--m15-muted)" }}>Aucun élève trouvé.</p>}
                </div>
              ) : null}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)" }}>
                  Type d'incident *
                </label>
                <select value={form.type_incident} onChange={e => setForm(f => ({ ...f, type_incident: e.target.value as TypeIncident }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  {Object.entries(TYPE_INCIDENT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)" }}>Lieu</label>
                <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))}
                  placeholder="Ex: Cour, Couloir, Classe..."
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)" }}>Date *</label>
                <input type="date" value={form.date_incident} onChange={e => setForm(f => ({ ...f, date_incident: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)" }}>Heure</label>
                <input type="time" value={form.heure_incident} onChange={e => setForm(f => ({ ...f, heure_incident: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)" }}>
                Description *
              </label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={4} placeholder="Décrivez l'incident en détail..."
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <button type="submit" disabled={submitting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-60"
              style={{ background: "#FF4D6D", color: "#fff" }}>
              {submitting ? "Enregistrement..." : <><ShieldAlert className="w-4 h-4" /> Signaler l'incident</>}
            </button>
          </form>
        )}

        {/* ── Tab: Sanctions en attente ── */}
        {activeTab === "attente" && (
          <div>
            {loadingSanc ? (
              <div className="p-6 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--elevate-1)" }} />)}
              </div>
            ) : sanctionsAttente.length === 0 ? (
              <div className="py-16 text-center">
                <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "#00C9A7" }} />
                <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Aucune sanction en attente</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
                {sanctionsAttente.map((s: any) => (
                  <div key={s.id} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>
                          {s.eleve_prenoms} {s.eleve_nom}
                        </p>
                        <span className="text-xs" style={{ color: "var(--m15-muted)" }}>{s.classe_nom}</span>
                      </div>
                      <p className="text-xs mb-0.5" style={{ color: "#F5C842" }}>
                        {TYPE_SANCTION_LABELS[s.type_sanction as TypeSanction] ?? s.type_sanction}
                      </p>
                      <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                        Prononcée par : {s.prononce_par_prenoms} {s.prononce_par_nom} · {s.date_sanction}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => handleValider(s.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                        style={{ background: "rgba(0,201,167,0.12)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
                        Valider
                      </button>
                      <button onClick={() => setRefusId(s.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
                        style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.2)" }}>
                        Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal refus */}
      {refusId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Refuser la sanction
            </h3>
            <textarea value={refusMotif} onChange={e => setRefusMotif(e.target.value)}
              rows={3} placeholder="Motif du refus (optionnel)..."
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none mb-4"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setRefusId(null); setRefusMotif(""); }}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}>
                Annuler
              </button>
              <button onClick={handleRefuser}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#FF4D6D", color: "#fff" }}>
                Confirmer le refus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
