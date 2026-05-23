import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, ShieldAlert, MapPin, Calendar, Clock, User,
  AlertTriangle, CheckCircle, ArrowUpRight, Plus, X,
} from "lucide-react";
import { disciplineApi, TYPE_INCIDENT_LABELS, TYPE_INCIDENT_COLORS, TYPE_SANCTION_LABELS, SANCTIONS_LOURDES, type TypeIncident, type TypeSanction } from "@/services/disciplineService";

function BadgeStatut({ statut }: { statut: string }) {
  const map: Record<string, { color: string; label: string }> = {
    en_attente: { color: "#F5C842", label: "En attente" },
    traite: { color: "#00C9A7", label: "Traité" },
    escalade: { color: "#FF4D6D", label: "Escaladé" },
  };
  const { color, label } = map[statut] ?? { color: "#8B9DC3", label: statut };
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${color}18`, color }}>{label}</span>;
}

function BadgeSanctionStatut({ statut }: { statut: string }) {
  const map: Record<string, { color: string; label: string }> = {
    en_attente: { color: "#F5C842", label: "En attente" },
    validee: { color: "#00C9A7", label: "Validée" },
    executee: { color: "#0080FF", label: "Exécutée" },
    annulee: { color: "#8B9DC3", label: "Annulée" },
  };
  const { color, label } = map[statut] ?? { color: "#8B9DC3", label: statut };
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: `${color}18`, color }}>{label}</span>;
}

async function fetchAdmins(token: string | null, etabId: string): Promise<any[]> {
  if (!token) return [];
  try {
    const res = await fetch(`/api/utilisateurs/liste?role=censeur&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    const censeurs = json.utilisateurs ?? [];
    const res2 = await fetch(`/api/utilisateurs/liste?role=directeur&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json2 = await res2.json();
    const directeurs = json2.utilisateurs ?? [];
    return [...censeurs, ...directeurs];
  } catch { return []; }
}

export default function IncidentDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, token } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [incident, setIncident] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [showModalSanction, setShowModalSanction] = useState(false);
  const [showModalEscalade, setShowModalEscalade] = useState(false);
  const [admins, setAdmins] = useState<any[]>([]);
  const [escaladeVers, setEscaladeVers] = useState("");
  const [motifEscalade, setMotifEscalade] = useState("");

  const [sanction, setSanction] = useState({
    type_sanction: "avertissement_oral" as TypeSanction,
    description: "", date_sanction: new Date().toISOString().slice(0, 10),
    duree_heures: "", date_execution: "", notifier_parent: true, observations: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = ["directeur", "censeur", "dev"].includes(user?.role ?? "");
  const isAuthor = incident?.data?.incident?.signale_par === user?.id;
  const canEdit = isAuthor && incident?.data?.incident?.statut === "en_attente";
  const isLourde = SANCTIONS_LOURDES.includes(sanction.type_sanction);

  async function charger() {
    setLoading(true);
    try {
      const res = await disciplineApi.getIncident(id as string);
      setIncident(res);
    } catch { setLocation("/discipline/incidents"); }
    finally { setLoading(false); }
  }

  useEffect(() => { charger(); }, [id]);

  useEffect(() => {
    if (showModalEscalade && admins.length === 0) {
      fetchAdmins(token, user?.etablissement_id ?? "").then(setAdmins);
    }
  }, [showModalEscalade]);

  async function handleCloturer() {
    try {
      await disciplineApi.cloturerIncident(id as string);
      toast({ title: "Incident clôturé" });
      charger();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    }
  }

  async function handleEscalader(e: React.FormEvent) {
    e.preventDefault();
    if (!escaladeVers || !motifEscalade) {
      toast({ title: "Remplissez tous les champs", variant: "destructive" }); return;
    }
    setSubmitting(true);
    try {
      await disciplineApi.escaladerIncident(id as string, { escalade_vers: escaladeVers, motif_escalade: motifEscalade });
      toast({ title: "Incident escaladé" });
      setShowModalEscalade(false);
      charger();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  async function handlePrononcerSanction(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await disciplineApi.prononcerSanction({
        ...sanction,
        eleve_id: inc.eleve_id,
        incident_id: id,
        duree_heures: sanction.duree_heures ? parseInt(sanction.duree_heures) : undefined,
      });
      toast({ title: "Sanction prononcée", description: isLourde && user?.role === "educateur" ? "En attente de validation par l'administration." : "Sanction enregistrée." });
      setShowModalSanction(false);
      charger();
    } catch (err: any) {
      toast({ title: "Erreur", description: err.message, variant: "destructive" });
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-64">
      <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: "#FF4D6D", borderTopColor: "transparent" }} />
    </div>
  );

  const inc = incident?.data?.incident;
  if (!inc) return null;

  const color = TYPE_INCIDENT_COLORS[inc.type_incident as TypeIncident] ?? "#8B9DC3";

  return (
    <div className="space-y-6 page-fade-in">
      {/* Retour */}
      <button onClick={() => setLocation("/discipline/incidents")}
        className="flex items-center gap-2 text-sm font-semibold hover:underline" style={{ color: "var(--m15-muted)" }}>
        <ArrowLeft className="w-4 h-4" /> Retour aux incidents
      </button>

      {/* Header incident */}
      <div className="rounded-2xl p-6" style={{ background: "var(--m15-card)", border: `1px solid ${color}30`, borderTop: `3px solid ${color}` }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-5 h-5" style={{ color }} />
              <span className="font-bold text-lg" style={{ fontFamily: "'Syne', sans-serif", color }}>
                {TYPE_INCIDENT_LABELS[inc.type_incident as TypeIncident] ?? inc.type_incident}
              </span>
              <BadgeStatut statut={inc.statut} />
            </div>
            <h2 className="text-xl font-bold mb-1" style={{ color: "var(--m15-white)" }}>
              {inc.eleve_prenoms} {inc.eleve_nom}
            </h2>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>{inc.classe_nom} · Matricule : {inc.eleve_matricule}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {isAdmin && inc.statut !== "traite" && (
              <button onClick={handleCloturer}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
                <CheckCircle className="w-4 h-4" /> Clôturer
              </button>
            )}
            {(user?.role === "educateur" || isAdmin) && inc.statut === "en_attente" && (
              <button onClick={() => setShowModalEscalade(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,77,109,0.1)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.2)" }}>
                <ArrowUpRight className="w-4 h-4" /> Escalader
              </button>
            )}
            {(user?.role === "educateur" || isAdmin) && (
              <button onClick={() => setShowModalSanction(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#FF4D6D", color: "#fff" }}>
                <Plus className="w-4 h-4" /> Prononcer une sanction
              </button>
            )}
          </div>
        </div>

        {/* Détails */}
        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Calendar, label: "Date", value: inc.date_incident },
            { icon: Clock, label: "Heure", value: inc.heure_incident ?? "—" },
            { icon: MapPin, label: "Lieu", value: inc.lieu ?? "—" },
            { icon: User, label: "Signalé par", value: `${inc.signale_par_prenoms} ${inc.signale_par_nom}` },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-2">
              <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "var(--m15-muted)" }} />
              <div>
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "var(--m15-muted)" }}>{label}</p>
                <p className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>{value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl p-4" style={{ background: "var(--elevate-1)" }}>
          <p className="text-xs uppercase tracking-widest font-semibold mb-2" style={{ color: "var(--m15-muted)" }}>Description</p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--m15-white)" }}>{inc.description}</p>
        </div>

        {inc.statut === "escalade" && inc.motif_escalade && (
          <div className="mt-4 rounded-xl p-4" style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.15)" }}>
            <p className="text-xs uppercase tracking-widest font-semibold mb-1" style={{ color: "#FF4D6D" }}>Motif d'escalade</p>
            <p className="text-sm" style={{ color: "var(--m15-white)" }}>{inc.motif_escalade}</p>
          </div>
        )}
      </div>

      {/* Historique élève rapide */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Historique disciplinaire
          </h3>
          <button onClick={() => setLocation(`/discipline/historique/${inc.eleve_id}`)}
            className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: "#00C9A7" }}>
            Historique complet <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4">
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Cliquez sur "Historique complet" pour voir tous les incidents et sanctions de cet élève.
          </p>
        </div>
      </div>

      {/* Sanctions liées */}
      {inc.sanctions && inc.sanctions.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
            <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Sanctions liées ({inc.sanctions.length})
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
            {inc.sanctions.map((s: any) => (
              <div key={s.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>
                    {TYPE_SANCTION_LABELS[s.type_sanction as TypeSanction] ?? s.type_sanction}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{s.date_sanction}</p>
                </div>
                <BadgeSanctionStatut statut={s.statut} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Sanction */}
      {showModalSanction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                Prononcer une sanction
              </h3>
              <button onClick={() => setShowModalSanction(false)}><X className="w-5 h-5" style={{ color: "var(--m15-muted)" }} /></button>
            </div>
            <form onSubmit={handlePrononcerSanction} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)" }}>
                  Type de sanction *
                </label>
                <select value={sanction.type_sanction} onChange={e => setSanction(s => ({ ...s, type_sanction: e.target.value as TypeSanction }))}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  {Object.entries(TYPE_SANCTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                {user?.role === "educateur" && isLourde && (
                  <p className="mt-2 text-xs rounded-lg px-3 py-2" style={{ background: "rgba(245,200,66,0.08)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.2)" }}>
                    ⚠️ Cette sanction nécessitera la validation du censeur ou du directeur.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--m15-muted)" }}>Date *</label>
                  <input type="date" value={sanction.date_sanction} onChange={e => setSanction(s => ({ ...s, date_sanction: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                </div>
                {sanction.type_sanction === "retenue" && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--m15-muted)" }}>Durée (heures)</label>
                    <input type="number" min="1" value={sanction.duree_heures} onChange={e => setSanction(s => ({ ...s, duree_heures: e.target.value }))}
                      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                      style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--m15-muted)" }}>Date exécution</label>
                  <input type="date" value={sanction.date_execution} onChange={e => setSanction(s => ({ ...s, date_execution: e.target.value }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--m15-muted)" }}>Description / observations</label>
                <textarea rows={3} value={sanction.description} onChange={e => setSanction(s => ({ ...s, description: e.target.value }))}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={sanction.notifier_parent} onChange={e => setSanction(s => ({ ...s, notifier_parent: e.target.checked }))}
                  className="w-4 h-4 rounded" />
                <span className="text-sm" style={{ color: "var(--m15-white)" }}>Notifier le parent</span>
              </label>
              <div className="flex gap-3 justify-end pt-2">
                <button type="button" onClick={() => setShowModalSanction(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}>
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: "#FF4D6D", color: "#fff" }}>
                  {submitting ? "Enregistrement..." : "Prononcer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Escalade */}
      {showModalEscalade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="rounded-2xl p-6 w-full max-w-md" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Escalader l'incident</h3>
              <button onClick={() => setShowModalEscalade(false)}><X className="w-5 h-5" style={{ color: "var(--m15-muted)" }} /></button>
            </div>
            <form onSubmit={handleEscalader} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)" }}>Escalader vers *</label>
                <select value={escaladeVers} onChange={e => setEscaladeVers(e.target.value)}
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <option value="">Sélectionner...</option>
                  {admins.map(a => <option key={a.id} value={a.id}>{a.prenoms} {a.nom} ({a.role})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)" }}>Motif *</label>
                <textarea rows={3} value={motifEscalade} onChange={e => setMotifEscalade(e.target.value)}
                  placeholder="Raison de l'escalade..."
                  className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={() => setShowModalEscalade(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}>Annuler</button>
                <button type="submit" disabled={submitting}
                  className="px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
                  style={{ background: "#FF4D6D", color: "#fff" }}>
                  {submitting ? "..." : "Escalader"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
