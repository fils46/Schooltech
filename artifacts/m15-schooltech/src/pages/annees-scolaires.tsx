import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useListerAnneesScolaires, getListerAnneesScolairesQueryKey,
  useCreerAnneeScolaire, useActiverAnneeScolaire,
  useCloturerAnneeScolaire, useModifierTrimestres,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Plus, CheckCircle, Circle, Lock, Settings,
  AlertTriangle, ChevronDown, ChevronUp, Clock,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────── */
type Trimestre = { numero: 1 | 2 | 3; date_debut: string; date_fin: string };
type AnneeRow = {
  id: string; libelle: string; date_debut: string; date_fin: string;
  est_active: boolean; statut?: string; trimestres?: Trimestre[] | null;
};

/* ─── Helpers UI ──────────────────────────────────────────── */
const STATUT_CFG: Record<string, { label: string; color: string; bg: string; Icon: typeof CheckCircle }> = {
  a_venir:  { label: "À venir",  color: "#8B9DC3", bg: "rgba(139,157,195,0.12)", Icon: Clock       },
  en_cours: { label: "En cours", color: "#00C9A7", bg: "rgba(0,201,167,0.15)",   Icon: CheckCircle },
  cloturee: { label: "Clôturée", color: "#FF6B6B", bg: "rgba(255,107,107,0.15)", Icon: Lock        },
};

function StatutBadge({ statut, est_active }: { statut?: string; est_active: boolean }) {
  const key = statut ?? (est_active ? "en_cours" : "a_venir");
  const cfg = STATUT_CFG[key] ?? STATUT_CFG.a_venir;
  const { Icon } = cfg;
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shrink-0"
      style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="w-3 h-3" /> {cfg.label}
    </span>
  );
}

const iStyle = { background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" };
const iClass = "w-full rounded-xl px-4 py-2.5 text-sm outline-none";
const lClass = "block text-xs font-semibold mb-1.5 uppercase tracking-wide";
const lStyle = { color: "var(--m15-muted)" };

/* ─── Modal Créer Année ───────────────────────────────────── */
function ModalCreerAnnee({
  onClose, etablissementId, isDevRole,
}: { onClose: () => void; etablissementId: string | null; isDevRole: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const creerMut = useCreerAnneeScolaire();
  const [libelle, setLibelle] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [activer, setActiver] = useState(false);
  const [etabId, setEtabId] = useState(etablissementId ?? "");

  const submit = async () => {
    if (!libelle.trim() || !dateDebut || !dateFin) {
      toast({ title: "Champs requis", variant: "destructive" }); return;
    }
    try {
      await creerMut.mutateAsync({
        data: { libelle: libelle.trim(), date_debut: dateDebut, date_fin: dateFin, est_active: activer,
          ...(isDevRole ? { etablissement_id: etabId } : {}) },
      });
      await qc.invalidateQueries({ queryKey: getListerAnneesScolairesQueryKey() });
      toast({ title: "Année créée", description: `Année ${libelle} ajoutée.` });
      onClose();
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer l'année.", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,201,167,0.15)" }}>
            <Calendar className="w-5 h-5" style={{ color: "#00C9A7" }} />
          </div>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Nouvelle année scolaire
          </h2>
        </div>
        <div className="space-y-4">
          {isDevRole && (
            <div>
              <label className={lClass} style={lStyle}>Établissement ID</label>
              <input value={etabId} onChange={e => setEtabId(e.target.value)} className={iClass} style={iStyle} />
            </div>
          )}
          <div>
            <label className={lClass} style={lStyle}>Libellé * (ex: 2025-2026)</label>
            <input value={libelle} onChange={e => setLibelle(e.target.value)} placeholder="2025-2026" className={iClass} style={iStyle} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lClass} style={lStyle}>Date début *</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} className={iClass} style={iStyle} />
            </div>
            <div>
              <label className={lClass} style={lStyle}>Date fin *</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} className={iClass} style={iStyle} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={activer} onChange={e => setActiver(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm" style={{ color: "var(--m15-white)" }}>Activer immédiatement</span>
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={creerMut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#00C9A7,#00A3FF)", color: "#fff" }}>
            {creerMut.isPending ? "Création…" : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Trimestres ────────────────────────────────────── */
function ModalTrimestres({ annee, onClose }: { annee: AnneeRow; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const modMut = useModifierTrimestres();
  const [trimestres, setTrimestres] = useState<Trimestre[]>(
    annee.trimestres?.length
      ? annee.trimestres
      : [1, 2, 3].map(n => ({ numero: n as 1 | 2 | 3, date_debut: "", date_fin: "" }))
  );

  const update = (i: number, f: "date_debut" | "date_fin", v: string) =>
    setTrimestres(prev => prev.map((t, j) => j === i ? { ...t, [f]: v } : t));

  const submit = async () => {
    const valides = trimestres.filter(t => t.date_debut && t.date_fin);
    if (!valides.length) { toast({ title: "Renseignez au moins un trimestre.", variant: "destructive" }); return; }
    try {
      await modMut.mutateAsync({ id: annee.id, data: { trimestres: valides } });
      await qc.invalidateQueries({ queryKey: getListerAnneesScolairesQueryKey() });
      toast({ title: "Trimestres enregistrés" });
      onClose();
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,163,255,0.15)" }}>
            <Settings className="w-5 h-5" style={{ color: "#00A3FF" }} />
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Trimestres — {annee.libelle}
            </h2>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Définissez les dates des 3 périodes</p>
          </div>
        </div>
        <div className="space-y-3">
          {trimestres.map((t, i) => (
            <div key={t.numero} className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)" }}>
              <p className="text-sm font-bold" style={{ color: "#00A3FF" }}>Trimestre {t.numero}</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--m15-muted)" }}>Début</label>
                  <input type="date" value={t.date_debut} onChange={e => update(i, "date_debut", e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={iStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: "var(--m15-muted)" }}>Fin</label>
                  <input type="date" value={t.date_fin} onChange={e => update(i, "date_fin", e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={iStyle} />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={modMut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#00A3FF,#00C9A7)", color: "#fff" }}>
            {modMut.isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Carte Année ─────────────────────────────────────────── */
function CarteAnnee({
  annee, canManage, onRefresh, onTrimestres,
}: { annee: AnneeRow; canManage: boolean; onRefresh: () => void; onTrimestres: (a: AnneeRow) => void }) {
  const { toast } = useToast();
  const activerMut = useActiverAnneeScolaire();
  const cloturerMut = useCloturerAnneeScolaire();
  const [showTrimestres, setShowTrimestres] = useState(false);

  const statut = annee.statut ?? (annee.est_active ? "en_cours" : "a_venir");
  const isActive   = statut === "en_cours";
  const isCloturee = statut === "cloturee";

  const activer = async () => {
    try {
      await activerMut.mutateAsync({ id: annee.id });
      toast({ title: "Année activée", description: `${annee.libelle} est maintenant active.` });
      onRefresh();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const cloturer = async () => {
    if (!confirm(`Clôturer l'année ${annee.libelle} ? Action irréversible.`)) return;
    try {
      await cloturerMut.mutateAsync({ id: annee.id });
      toast({ title: "Année clôturée", description: `${annee.libelle} est maintenant clôturée.` });
      onRefresh();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  return (
    <div className="rounded-2xl p-5 space-y-3 transition-all"
      style={{
        background: "var(--m15-card)",
        border: isActive ? "1px solid rgba(0,201,167,0.35)" : "1px solid var(--m15-border)",
        boxShadow: isActive ? "0 0 24px rgba(0,201,167,0.07)" : "none",
      }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: isActive ? "rgba(0,201,167,0.15)" : "rgba(139,157,195,0.08)" }}>
          <Calendar className="w-5 h-5" style={{ color: isActive ? "#00C9A7" : "var(--m15-muted)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            {annee.libelle}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>
            {annee.date_debut} → {annee.date_fin}
          </p>
        </div>
        <StatutBadge statut={statut} est_active={annee.est_active} />
      </div>

      {annee.trimestres && annee.trimestres.length > 0 && (
        <div>
          <button onClick={() => setShowTrimestres(p => !p)}
            className="flex items-center gap-1.5 text-xs font-semibold"
            style={{ color: "var(--m15-muted)" }}>
            {showTrimestres ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {annee.trimestres.length} trimestre{annee.trimestres.length > 1 ? "s" : ""} configuré{annee.trimestres.length > 1 ? "s" : ""}
          </button>
          {showTrimestres && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {annee.trimestres.map(t => (
                <div key={t.numero} className="rounded-lg p-2 text-center"
                  style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)" }}>
                  <p className="text-xs font-bold" style={{ color: "#00A3FF" }}>T{t.numero}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{t.date_debut}</p>
                  <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{t.date_fin}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {canManage && !isCloturee && (
        <div className="flex flex-wrap gap-2 pt-1">
          <button onClick={() => onTrimestres(annee)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
            style={{ background: "rgba(0,163,255,0.1)", color: "#00A3FF" }}>
            <Settings className="w-3.5 h-3.5" /> Trimestres
          </button>
          {!isActive && (
            <button onClick={activer} disabled={activerMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
              style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>
              <CheckCircle className="w-3.5 h-3.5" />
              {activerMut.isPending ? "…" : "Activer"}
            </button>
          )}
          {isActive && (
            <button onClick={cloturer} disabled={cloturerMut.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold hover:opacity-80 transition-opacity"
              style={{ background: "rgba(255,107,107,0.1)", color: "#FF6B6B" }}>
              <Lock className="w-3.5 h-3.5" />
              {cloturerMut.isPending ? "…" : "Clôturer l'année"}
            </button>
          )}
        </div>
      )}
      {isCloturee && (
        <p className="text-xs flex items-center gap-2" style={{ color: "var(--m15-muted)" }}>
          <Lock className="w-3.5 h-3.5" /> Année clôturée — lecture seule
        </p>
      )}
    </div>
  );
}

/* ─── Page principale ─────────────────────────────────────── */
export default function AnneesScolaires() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [anneeTrimestres, setAnneeTrimestres] = useState<AnneeRow | null>(null);

  const isDevRole = user?.role === "dev";
  const canManage = ["dev", "directeur"].includes(user?.role ?? "");

  const { data, isLoading, error } = useListerAnneesScolaires();
  const annees: AnneeRow[] = (data?.annees ?? []) as AnneeRow[];
  const invalidate = () => qc.invalidateQueries({ queryKey: getListerAnneesScolairesQueryKey() });

  const actives   = annees.filter(a => a.est_active || a.statut === "en_cours");
  const inactives = annees.filter(a => !a.est_active && a.statut !== "en_cours");

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 rounded-full border-2 animate-spin"
        style={{ borderColor: "#00C9A7 transparent transparent" }} />
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center h-64 gap-3" style={{ color: "#FF6B6B" }}>
      <AlertTriangle className="w-6 h-6" /><span>Impossible de charger les années scolaires.</span>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 page-fade-in">
      {/* En-tête */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Années scolaires
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            {annees.length} année{annees.length !== 1 ? "s" : ""} · {actives.length} active
          </p>
        </div>
        {canManage && (
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#00C9A7,#00A3FF)", color: "#fff" }}>
            <Plus className="w-4 h-4" /> Nouvelle année
          </button>
        )}
      </div>

      {/* Année en cours */}
      {actives.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#00C9A7" }}>En cours</h2>
          {actives.map(a => (
            <CarteAnnee key={a.id} annee={a} canManage={canManage}
              onRefresh={invalidate} onTrimestres={setAnneeTrimestres} />
          ))}
        </section>
      )}

      {/* Autres années */}
      {inactives.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>
            Autres années
          </h2>
          {inactives.map(a => (
            <CarteAnnee key={a.id} annee={a} canManage={canManage}
              onRefresh={invalidate} onTrimestres={setAnneeTrimestres} />
          ))}
        </section>
      )}

      {annees.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: "rgba(139,157,195,0.08)" }}>
            <Calendar className="w-8 h-8" style={{ color: "var(--m15-muted)" }} />
          </div>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucune année scolaire configurée.</p>
          {canManage && (
            <button onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>
              Créer la première année
            </button>
          )}
        </div>
      )}

      {showModal && (
        <ModalCreerAnnee onClose={() => setShowModal(false)}
          etablissementId={user?.etablissement_id ?? null} isDevRole={isDevRole} />
      )}
      {anneeTrimestres && (
        <ModalTrimestres annee={anneeTrimestres} onClose={() => setAnneeTrimestres(null)} />
      )}
    </div>
  );
}
