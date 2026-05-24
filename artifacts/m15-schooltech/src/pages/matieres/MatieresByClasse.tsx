import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useListerAnneesScolaires, getListerAnneesScolairesQueryKey,
  useListerClasses, getListerClassesQueryKey,
  useListerMatieres, getListerMatieresQueryKey,
  useGetMatieresByClasse, getGetMatieresByClasseQueryKey,
  useAssignerMatiereClasse, useAssignerMatieresMasse,
  useModifierCoefficientClasse, useRetirerMatiereClasse,
  useDupliquerMatieresPourClasse,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutGrid, Plus, Trash2, Pencil, AlertTriangle,
  Copy, ChevronDown, BookMarked,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────── */
type MatiereClasse = {
  id: string; matiere_id: string; classe_id: string; annee_scolaire_id: string;
  coefficient: number; nb_heures_semaine?: number | null; est_eliminatoire: boolean;
  matiere_nom: string; matiere_code: string; matiere_couleur?: string | null;
};

/* ─── Modal Assigner Matière ──────────────────────────────── */
function ModalAssigner({
  classeId, anneeId, onClose,
}: { classeId: string; anneeId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: matieresData } = useListerMatieres({ actif: true });
  const assignerMut = useAssignerMatiereClasse();

  const [matiereId, setMatiereId]   = useState("");
  const [coefficient, setCoefficient] = useState("1");
  const [heures, setHeures]           = useState("");
  const [elim, setElim]               = useState(false);

  const submit = async () => {
    if (!matiereId) { toast({ title: "Sélectionnez une matière", variant: "destructive" }); return; }
    try {
      await assignerMut.mutateAsync({
        data: {
          matiere_id: matiereId, classe_id: classeId, annee_scolaire_id: anneeId,
          coefficient: parseFloat(coefficient) || 1,
          nb_heures_semaine: heures ? parseFloat(heures) : undefined,
          est_eliminatoire: elim,
        },
      });
      await qc.invalidateQueries({ queryKey: getGetMatieresByClasseQueryKey(classeId) });
      toast({ title: "Matière assignée" });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ title: "Erreur", description: msg ?? "Opération impossible.", variant: "destructive" });
    }
  };

  const iStyle = { background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" };
  const lStyle = { color: "var(--m15-muted)" };
  const matieres = matieresData?.matieres ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,201,167,0.15)" }}>
            <Plus className="w-5 h-5" style={{ color: "#00C9A7" }} />
          </div>
          <h2 className="font-bold text-lg" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Assigner une matière
          </h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={lStyle}>Matière *</label>
            <div className="relative">
              <select value={matiereId} onChange={e => setMatiereId(e.target.value)}
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none appearance-none" style={iStyle}>
                <option value="">Sélectionner une matière…</option>
                {matieres.map(m => (
                  <option key={m.id} value={m.id}>{m.nom} ({m.code})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "var(--m15-muted)" }} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={lStyle}>Coefficient *</label>
              <input type="number" value={coefficient} onChange={e => setCoefficient(e.target.value)}
                min="0.5" max="10" step="0.5" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={iStyle} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={lStyle}>Heures/sem.</label>
              <input type="number" value={heures} onChange={e => setHeures(e.target.value)}
                min="0.5" step="0.5" placeholder="ex: 3"
                className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={iStyle} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={elim} onChange={e => setElim(e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm" style={{ color: "var(--m15-white)" }}>Matière éliminatoire</span>
          </label>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={assignerMut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#00C9A7,#00A3FF)", color: "#fff" }}>
            {assignerMut.isPending ? "Assignation…" : "Assigner"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal Modifier Coefficient ──────────────────────────── */
function ModalCoeff({
  liaison, onClose,
}: { liaison: MatiereClasse; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const modifierMut = useModifierCoefficientClasse();

  const [coefficient, setCoefficient] = useState(String(liaison.coefficient));
  const [heures, setHeures]           = useState(liaison.nb_heures_semaine != null ? String(liaison.nb_heures_semaine) : "");
  const [elim, setElim]               = useState(liaison.est_eliminatoire);

  const submit = async () => {
    try {
      await modifierMut.mutateAsync({
        id: liaison.id,
        data: {
          coefficient: parseFloat(coefficient) || 1,
          nb_heures_semaine: heures ? parseFloat(heures) : null,
          est_eliminatoire: elim,
        },
      });
      await qc.invalidateQueries({ queryKey: getGetMatieresByClasseQueryKey(liaison.classe_id) });
      toast({ title: "Coefficient modifié" });
      onClose();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const iStyle = { background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" };
  const lStyle = { color: "var(--m15-muted)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `${liaison.matiere_couleur ?? "#00C9A7"}22` }}>
            <Pencil className="w-5 h-5" style={{ color: liaison.matiere_couleur ?? "#00C9A7" }} />
          </div>
          <div>
            <h2 className="font-bold" style={{ color: "var(--m15-white)" }}>{liaison.matiere_nom}</h2>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Modifier le coefficient</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={lStyle}>Coefficient</label>
            <input type="number" value={coefficient} onChange={e => setCoefficient(e.target.value)}
              min="0.5" max="10" step="0.5" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={iStyle} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={lStyle}>Heures/sem.</label>
            <input type="number" value={heures} onChange={e => setHeures(e.target.value)}
              min="0.5" step="0.5" className="w-full rounded-xl px-4 py-2.5 text-sm outline-none" style={iStyle} />
          </div>
        </div>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={elim} onChange={e => setElim(e.target.checked)} className="w-4 h-4 rounded" />
          <span className="text-sm" style={{ color: "var(--m15-white)" }}>Éliminatoire</span>
        </label>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={modifierMut.isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#00A3FF,#00C9A7)", color: "#fff" }}>
            {modifierMut.isPending ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Ligne Matière-Classe ────────────────────────────────── */
function LigneMatiereClasse({
  liaison, canManage, onModify, onRefresh,
}: {
  liaison: MatiereClasse; canManage: boolean;
  onModify: (l: MatiereClasse) => void; onRefresh: () => void;
}) {
  const { toast } = useToast();
  const retirerMut = useRetirerMatiereClasse();
  const couleur = liaison.matiere_couleur ?? "#8B9DC3";

  const retirer = async () => {
    if (!confirm(`Retirer "${liaison.matiere_nom}" de cette classe ?`)) return;
    try {
      await retirerMut.mutateAsync({ id: liaison.id });
      toast({ title: "Matière retirée" });
      onRefresh();
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-xl transition-all"
      style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: `${couleur}22` }}>
        <span className="text-xs font-black" style={{ color: couleur }}>
          {liaison.matiere_code.slice(0, 3)}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-semibold text-sm truncate" style={{ color: "var(--m15-white)" }}>
            {liaison.matiere_nom}
          </p>
          {liaison.est_eliminatoire && (
            <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,107,107,0.12)", color: "#FF6B6B" }}>
              Élim.
            </span>
          )}
        </div>
        <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>
          Coeff. {liaison.coefficient}
          {liaison.nb_heures_semaine != null && ` · ${liaison.nb_heures_semaine}h/sem`}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="px-3 py-1 rounded-lg text-sm font-black"
          style={{ background: `${couleur}22`, color: couleur }}>
          ×{liaison.coefficient}
        </div>
        {canManage && (
          <>
            <button onClick={() => onModify(liaison)}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80"
              style={{ background: "rgba(0,163,255,0.1)" }}>
              <Pencil className="w-3.5 h-3.5" style={{ color: "#00A3FF" }} />
            </button>
            <button onClick={retirer} disabled={retirerMut.isPending}
              className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80"
              style={{ background: "rgba(255,107,107,0.1)" }}>
              <Trash2 className="w-3.5 h-3.5" style={{ color: "#FF6B6B" }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Page principale ─────────────────────────────────────── */
export default function MatieresByClasse() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [anneeId, setAnneeId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [classeIdSource, setClasseIdSource] = useState("");
  const [showAssigner, setShowAssigner] = useState(false);
  const [liaisonEdit, setLiaisonEdit] = useState<MatiereClasse | null>(null);
  const [showDupliquer, setShowDupliquer] = useState(false);

  const canManage = ["dev", "directeur", "censeur"].includes(user?.role ?? "");

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = anneesData?.annees ?? [];

  const { data: classesData } = useListerClasses(
    anneeId ? { annee_scolaire_id: anneeId } : undefined,
    { query: { queryKey: getListerClassesQueryKey({ annee_scolaire_id: anneeId }), enabled: !!anneeId } }
  );
  const classes = classesData?.classes ?? [];

  const { data: matieresData, isLoading } = useGetMatieresByClasse(
    classeId,
    anneeId ? { annee_scolaire_id: anneeId } : undefined,
    { query: { queryKey: getGetMatieresByClasseQueryKey(classeId, anneeId ? { annee_scolaire_id: anneeId } : undefined), enabled: !!(classeId && anneeId) } }
  );
  const liaisons: MatiereClasse[] = (matieresData?.matieres ?? []) as MatiereClasse[];
  const totalCoeff = matieresData?.total_coefficient ?? 0;

  const dupliquerMut = useDupliquerMatieresPourClasse();

  const invalidate = () => qc.invalidateQueries({
    queryKey: getGetMatieresByClasseQueryKey(classeId, { annee_scolaire_id: anneeId }),
  });

  const dupliquer = async () => {
    if (!classeIdSource) { toast({ title: "Sélectionnez une classe source", variant: "destructive" }); return; }
    try {
      const res = await dupliquerMut.mutateAsync({
        data: { source_classe_id: classeIdSource, cible_classe_id: classeId, annee_scolaire_id: anneeId },
      });
      await invalidate();
      toast({ title: "Matières dupliquées", description: `${res.total} matière(s) copiée(s).` });
      setShowDupliquer(false);
      setClasseIdSource("");
    } catch { toast({ title: "Erreur", variant: "destructive" }); }
  };

  const sStyle = { background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" };

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-fade-in">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-black" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Matières par classe
        </h1>
        <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
          Configurez les coefficients et heures pour chaque classe
        </p>
      </div>

      {/* Sélecteurs */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>
            Année scolaire
          </label>
          <div className="relative">
            <select value={anneeId} onChange={e => { setAnneeId(e.target.value); setClasseId(""); }}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none appearance-none" style={sStyle}>
              <option value="">Sélectionner…</option>
              {annees.map(a => <option key={a.id} value={a.id}>{a.libelle}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--m15-muted)" }} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>
            Classe
          </label>
          <div className="relative">
            <select value={classeId} onChange={e => setClasseId(e.target.value)}
              disabled={!anneeId} className="w-full rounded-xl px-4 py-2.5 text-sm outline-none appearance-none"
              style={{ ...sStyle, opacity: anneeId ? 1 : 0.5 }}>
              <option value="">Sélectionner…</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.nom} — {c.niveau}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--m15-muted)" }} />
          </div>
        </div>
      </div>

      {/* Actions quand classe sélectionnée */}
      {classeId && anneeId && canManage && (
        <div className="flex flex-wrap gap-3">
          <button onClick={() => setShowAssigner(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg,#00C9A7,#00A3FF)", color: "#fff" }}>
            <Plus className="w-4 h-4" /> Assigner une matière
          </button>
          <button onClick={() => setShowDupliquer(p => !p)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: showDupliquer ? "rgba(245,200,66,0.15)" : "var(--m15-card)",
              color: "#F5C842", border: "1px solid var(--m15-border)",
            }}>
            <Copy className="w-4 h-4" /> Dupliquer depuis…
          </button>
        </div>
      )}

      {/* Panneau dupliquer */}
      {showDupliquer && classeId && anneeId && (
        <div className="rounded-xl p-4 space-y-3"
          style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.2)" }}>
          <p className="text-sm font-semibold" style={{ color: "#F5C842" }}>Dupliquer les matières depuis une autre classe</p>
          <div className="relative">
            <select value={classeIdSource} onChange={e => setClasseIdSource(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none appearance-none"
              style={{ ...sStyle, background: "var(--m15-card2)" }}>
              <option value="">Classe source…</option>
              {classes.filter(c => c.id !== classeId).map(c => (
                <option key={c.id} value={c.id}>{c.nom} — {c.niveau}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "var(--m15-muted)" }} />
          </div>
          <button onClick={dupliquer} disabled={!classeIdSource || dupliquerMut.isPending}
            className="px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842", opacity: classeIdSource ? 1 : 0.5 }}>
            {dupliquerMut.isPending ? "Duplication…" : "Dupliquer"}
          </button>
        </div>
      )}

      {/* Liste des matières */}
      {classeId && anneeId ? (
        isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-7 h-7 rounded-full border-2 animate-spin"
              style={{ borderColor: "#00C9A7 transparent transparent" }} />
          </div>
        ) : (
          <div className="space-y-3">
            {/* Résumé */}
            {liaisons.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl"
                style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
                  <span className="font-bold" style={{ color: "var(--m15-white)" }}>{liaisons.length}</span> matière{liaisons.length !== 1 ? "s" : ""}
                </p>
                <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
                  Total coeff. :{" "}
                  <span className="font-bold" style={{ color: "#00C9A7" }}>{totalCoeff}</span>
                </p>
              </div>
            )}

            {liaisons.length > 0 ? (
              <div className="space-y-2">
                {liaisons.map(l => (
                  <LigneMatiereClasse key={l.id} liaison={l} canManage={canManage}
                    onModify={setLiaisonEdit} onRefresh={invalidate} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 space-y-3">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                  style={{ background: "rgba(139,157,195,0.08)" }}>
                  <BookMarked className="w-7 h-7" style={{ color: "var(--m15-muted)" }} />
                </div>
                <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
                  Aucune matière assignée à cette classe.
                </p>
                {canManage && (
                  <button onClick={() => setShowAssigner(true)}
                    className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>
                    Assigner la première matière
                  </button>
                )}
              </div>
            )}
          </div>
        )
      ) : (
        <div className="flex flex-col items-center justify-center py-20 space-y-3 rounded-2xl"
          style={{ border: "2px dashed var(--m15-border)" }}>
          <LayoutGrid className="w-10 h-10" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            {!anneeId ? "Sélectionnez une année scolaire" : "Sélectionnez une classe"}
          </p>
        </div>
      )}

      {showAssigner && classeId && anneeId && (
        <ModalAssigner classeId={classeId} anneeId={anneeId} onClose={() => setShowAssigner(false)} />
      )}
      {liaisonEdit && (
        <ModalCoeff liaison={liaisonEdit} onClose={() => setLiaisonEdit(null)} />
      )}

      {/* Alerte erreur */}
      {!classeId && !anneeId && (
        <div className="hidden" />
      )}
    </div>
  );
}
