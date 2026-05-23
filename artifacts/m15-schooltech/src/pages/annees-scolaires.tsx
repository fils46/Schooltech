import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useListerAnneesScolaires, getListerAnneesScolairesQueryKey,
  useCreerAnneeScolaire, useActiverAnneeScolaire,
  useListerClasses, getListerClassesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar, Plus, CheckCircle, Circle, ArrowRight,
  ChevronLeft, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

/* ─── Helpers ─────────────────────────────────────────────── */
const NIVEAUX_COLLEGE = ["6ème", "5ème", "4ème", "3ème"];
const NIVEAUX_LYCEE   = ["2nde", "1ère", "Terminale"];

function Badge({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
      style={active
        ? { background: "rgba(0,201,167,0.15)", color: "#00C9A7" }
        : { background: "rgba(139,157,195,0.12)", color: "var(--m15-muted)" }}>
      {active ? <CheckCircle className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
      {active ? "En cours" : "Inactive"}
    </span>
  );
}

/* ─── Modal Créer Année ───────────────────────────────────── */
function ModalCreerAnnee({
  onClose, etablissementId, isDevRole,
}: { onClose: () => void; etablissementId: string | null; isDevRole: boolean }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const creerMut = useCreerAnneeScolaire();

  const [libelle, setLibelle]     = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin]     = useState("");
  const [activer, setActiver]     = useState(false);
  const [etabId, setEtabId]       = useState(etablissementId ?? "");

  const submit = async () => {
    if (!libelle.trim() || !dateDebut || !dateFin) {
      toast({ title: "Champs requis", description: "Remplissez tous les champs.", variant: "destructive" });
      return;
    }
    try {
      await creerMut.mutateAsync({
        data: {
          libelle: libelle.trim(),
          date_debut: dateDebut,
          date_fin: dateFin,
          est_active: activer,
          ...(isDevRole ? { etablissement_id: etabId } : {}),
        },
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
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>
                Établissement ID
              </label>
              <input value={etabId} onChange={e => setEtabId(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>
              Libellé *
            </label>
            <input value={libelle} onChange={e => setLibelle(e.target.value)}
              placeholder="ex : 2025-2026"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Date début *</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Date fin *</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={activer} onChange={e => setActiver(e.target.checked)}
              className="w-4 h-4 rounded accent-cyan-400" />
            <span className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>
              Activer immédiatement (désactivera l'année en cours)
            </span>
          </label>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={creerMut.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#00C9A7", color: "#fff" }}>
            {creerMut.isPending ? "Création..." : "Créer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Panneau Montée de classe ────────────────────────────── */
function MonteePanneau({ annees }: { annees: { id: string; libelle: string }[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [ancienneId, setAncienneId] = useState("");
  const [nouvelleId, setNouvelleId] = useState("");

  const { data: classesSource } = useListerClasses(
    ancienneId ? { annee_scolaire_id: ancienneId } : undefined,
    { query: { queryKey: getListerClassesQueryKey({ annee_scolaire_id: ancienneId }), enabled: !!ancienneId } }
  );
  const { data: classesDest } = useListerClasses(
    nouvelleId ? { annee_scolaire_id: nouvelleId } : undefined,
    { query: { queryKey: getListerClassesQueryKey({ annee_scolaire_id: nouvelleId }), enabled: !!nouvelleId } }
  );

  const [mappings, setMappings] = useState<Record<string, string>>({});

  const updateMapping = (sourceId: string, destId: string) => {
    setMappings(prev => ({ ...prev, [sourceId]: destId }));
  };

  const niveauSuivant: Record<string, string> = {
    "6ème": "5ème", "5ème": "4ème", "4ème": "3ème", "3ème": "2nde",
    "2nde": "1ère", "1ère": "Terminale",
  };

  return (
    <div className="rounded-2xl p-6 space-y-5"
      style={{ background: "var(--m15-card)", border: "1px solid rgba(245,200,66,0.2)" }}>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,200,66,0.15)" }}>
          <ArrowRight className="w-4 h-4" style={{ color: "#F5C842" }} />
        </div>
        <div>
          <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Montée de classe
          </h3>
          <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Transférer les élèves vers l'année suivante</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>
            Année source
          </label>
          <select value={ancienneId} onChange={e => setAncienneId(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            <option value="">Sélectionner...</option>
            {annees.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>
            Année destination
          </label>
          <select value={nouvelleId} onChange={e => setNouvelleId(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            <option value="">Sélectionner...</option>
            {annees.filter(a => a.id !== ancienneId).map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
          </select>
        </div>
      </div>

      {ancienneId && nouvelleId && (classesSource?.classes ?? []).length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>
            Associer les classes
          </p>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {(classesSource?.classes ?? []).filter(c => c.niveau !== "Terminale").map((src) => {
              const niveauDest = niveauSuivant[src.niveau];
              const destClasses = (classesDest?.classes ?? []).filter(c => c.niveau === niveauDest);
              return (
                <div key={src.id} className="flex items-center gap-3 p-3 rounded-xl"
                  style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)" }}>
                  <span className="text-sm font-medium flex-1" style={{ color: "var(--m15-white)" }}>{src.nom}</span>
                  <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "var(--m15-muted)" }} />
                  <select value={mappings[src.id] ?? ""} onChange={e => updateMapping(src.id, e.target.value)}
                    className="rounded-lg px-3 py-1.5 text-xs outline-none"
                    style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                    <option value="">-- choisir --</option>
                    {destClasses.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ancienneId && nouvelleId && (
        <div className="flex items-center gap-3 p-3 rounded-xl"
          style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.15)" }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: "#F5C842" }} />
          <p className="text-xs" style={{ color: "#F5C842" }}>
            Cette opération est irréversible. Les élèves des Terminales ne seront pas transférés.
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ─────────────────────────────────────── */
export default function AnneesScolaires() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useListerAnneesScolaires({
    query: { queryKey: getListerAnneesScolairesQueryKey() },
  });

  const activerMut = useActiverAnneeScolaire();

  const handleActiver = async (id: string) => {
    try {
      await activerMut.mutateAsync({ id });
      await qc.invalidateQueries({ queryKey: getListerAnneesScolairesQueryKey() });
      toast({ title: "Année activée", description: "Cette année est maintenant en cours." });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'activer l'année.", variant: "destructive" });
    }
  };

  const annees = data?.annees ?? [];
  const isDevRole = user?.role === "dev";

  return (
    <div className="space-y-6 page-fade-in">

      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Années scolaires
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Gérez vos années scolaires et activez l'année en cours.
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "#00C9A7", color: "#fff" }}>
          <Plus className="w-4 h-4" />
          Nouvelle année
        </button>
      </div>

      {/* ── Stat card année active ── */}
      {annees.find(a => a.est_active) && (() => {
        const active = annees.find(a => a.est_active)!;
        return (
          <div className="rounded-2xl p-5 flex items-center gap-4"
            style={{ background: "linear-gradient(135deg, rgba(0,201,167,0.1) 0%, rgba(0,201,167,0.03) 100%)", border: "1px solid rgba(0,201,167,0.25)" }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(0,201,167,0.2)" }}>
              <CheckCircle className="w-6 h-6" style={{ color: "#00C9A7" }} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "#00C9A7" }}>
                Année en cours
              </p>
              <p className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                {active.libelle}
              </p>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                {active.date_debut} → {active.date_fin}
              </p>
            </div>
          </div>
        );
      })()}

      {/* ── Liste des années ── */}
      <div className="rounded-2xl overflow-hidden"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Toutes les années
          </h3>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--elevate-1)" }} />
            ))}
          </div>
        ) : annees.length === 0 ? (
          <div className="py-16 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-20" style={{ color: "var(--m15-muted)" }} />
            <p className="text-sm font-medium mb-1" style={{ color: "var(--m15-white)" }}>Aucune année scolaire</p>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
              Créez votre première année scolaire pour commencer.
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
            {annees.map((annee) => (
              <div key={annee.id}
                className="flex items-center gap-4 px-5 py-4 transition-colors"
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0`}
                  style={{ background: annee.est_active ? "rgba(0,201,167,0.15)" : "rgba(139,157,195,0.1)" }}>
                  <Calendar className="w-4 h-4" style={{ color: annee.est_active ? "#00C9A7" : "#8B9DC3" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ color: "var(--m15-white)" }}>{annee.libelle}</p>
                  <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                    {annee.date_debut} → {annee.date_fin}
                  </p>
                </div>
                <Badge active={annee.est_active} />
                {!annee.est_active && (
                  <button
                    onClick={() => handleActiver(annee.id)}
                    disabled={activerMut.isPending}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,201,167,0.2)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(0,201,167,0.1)"; }}>
                    Activer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Montée de classe ── */}
      {(user?.role === "dev" || user?.role === "directeur") && annees.length >= 2 && (
        <MonteePanneau annees={annees.map(a => ({ id: a.id, libelle: a.libelle }))} />
      )}

      {showModal && (
        <ModalCreerAnnee
          onClose={() => setShowModal(false)}
          etablissementId={user?.etablissement_id ?? null}
          isDevRole={isDevRole}
        />
      )}
    </div>
  );
}
