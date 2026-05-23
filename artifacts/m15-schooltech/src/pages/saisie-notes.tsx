import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useSaisirNotesGroupe, useGetNotesClasse, useGetMoyennesClasse,
  useListerClasses, useListerAnneesScolaires,
  getGetMoyennesClasseQueryKey, getGetNotesClasseQueryKey,
} from "@workspace/api-client-react";
import {
  Award, Plus, Save, RefreshCw, ChevronDown, AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ─────────────────────────────────────────────────── */
type Evaluation = {
  id?: string; intitule: string; type_evaluation: string;
  trimestre: string; note_sur: number; coefficient: number; date_evaluation: string;
};
type NoteItem = {
  id: string; eleve_id: string; eleve_nom?: string; eleve_prenoms?: string;
  intitule: string; note: number; note_sur: number; coefficient: number;
  matiere: string; trimestre: string; type_evaluation: string;
};
type EleveClassement = {
  rang: number; eleve_id: string; eleve_nom: string; eleve_prenoms: string; moyenne_generale: number;
};
type Classe = { id: string; nom: string };

const TRIMESTRES = ["1", "2", "3"] as const;
const TYPE_EVAL = [
  { value: "devoir", label: "Devoir" },
  { value: "interrogation", label: "Interrogation" },
  { value: "composition", label: "Composition" },
  { value: "examen_blanc", label: "Examen blanc" },
];

function noteColor(note: number, noteSur: number): string {
  const pct = note / noteSur;
  if (pct >= 0.5) return "rgba(0,201,167,0.15)";
  if (pct >= 0.4) return "rgba(245,200,66,0.15)";
  return "rgba(255,77,109,0.15)";
}

function noteTextColor(note: number, noteSur: number): string {
  const pct = note / noteSur;
  if (pct >= 0.5) return "#00C9A7";
  if (pct >= 0.4) return "#F5C842";
  return "#FF4D6D";
}

/* ─── Modal Nouvelle Évaluation ──────────────────────────────── */
function NouvelleEvalModal({
  trimestre, onClose, onCreated,
}: {
  trimestre: string;
  onClose: () => void;
  onCreated: (e: Evaluation) => void;
}) {
  const [form, setForm] = useState<Evaluation>({
    intitule: "",
    type_evaluation: "devoir",
    trimestre,
    note_sur: 20,
    coefficient: 1,
    date_evaluation: new Date().toISOString().slice(0, 10),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl p-6 w-full max-w-md"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <h2 className="text-lg font-bold mb-5" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Nouvelle évaluation
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                Type
              </label>
              <select value={form.type_evaluation}
                onChange={e => setForm(f => ({ ...f, type_evaluation: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                {TYPE_EVAL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                Trimestre
              </label>
              <select value={form.trimestre}
                onChange={e => setForm(f => ({ ...f, trimestre: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                {TRIMESTRES.map(t => <option key={t} value={t}>T{t}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
              Intitulé *
            </label>
            <input type="text" value={form.intitule}
              onChange={e => setForm(f => ({ ...f, intitule: e.target.value }))}
              placeholder="Ex: Devoir N°1"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                Note sur
              </label>
              <input type="number" min={1} max={100} value={form.note_sur}
                onChange={e => setForm(f => ({ ...f, note_sur: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none text-center"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                Coeff.
              </label>
              <input type="number" min={0.5} max={10} step={0.5} value={form.coefficient}
                onChange={e => setForm(f => ({ ...f, coefficient: Number(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none text-center"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                Date
              </label>
              <input type="date" value={form.date_evaluation}
                onChange={e => setForm(f => ({ ...f, date_evaluation: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "var(--elevate-1)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
            Annuler
          </button>
          <button onClick={() => { if (!form.intitule) return; onCreated(form); onClose(); }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page principale ──────────────────────────────────────── */
export default function SaisieNotes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const saisirMut = useSaisirNotesGroupe();

  const { data: classesData } = useListerClasses();
  const { data: anneesData } = useListerAnneesScolaires();
  const classes = (Array.isArray(classesData) ? classesData : []) as Classe[];
  const annees = (anneesData as unknown as { annees?: { id: string; libelle: string; est_active?: boolean }[] })?.annees ?? [];
  const anneeActive = annees.find(a => a.est_active) ?? annees[0];
  const anneeId = anneeActive?.id ?? "";

  const [classeId, setClasseId] = useState(() => {
    if (typeof window !== "undefined") return new URLSearchParams(window.location.search).get("classe") ?? "";
    return "";
  });
  const [matiere, setMatiere] = useState("");
  const [trimestre, setTrimestre] = useState<"1" | "2" | "3">("1");
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [notesMap, setNotesMap] = useState<Record<string, Record<string, string>>>({});
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Charger notes existantes
  const { data: notesData, refetch: refetchNotes } = useGetNotesClasse(
    classeId,
    { matiere: matiere || undefined, trimestre: trimestre || undefined, annee_scolaire_id: anneeId || undefined },
    { query: { queryKey: getGetNotesClasseQueryKey(classeId, { matiere: matiere || undefined, trimestre, annee_scolaire_id: anneeId || undefined }), enabled: !!classeId && !!matiere } }
  );
  const notesExistantes = (notesData as unknown as { notes?: NoteItem[] })?.notes ?? [];

  // Classement + moyennes
  const { data: moyennesData } = useGetMoyennesClasse(
    classeId,
    { trimestre, annee_scolaire_id: anneeId || undefined },
    { query: { queryKey: getGetMoyennesClasseQueryKey(classeId, { trimestre, annee_scolaire_id: anneeId || undefined }), enabled: !!classeId } }
  );
  const classement = (moyennesData as unknown as { classement?: EleveClassement[] })?.classement ?? [];

  // Pré-remplir le tableau avec les notes existantes
  useEffect(() => {
    if (notesExistantes.length > 0) {
      const map: Record<string, Record<string, string>> = {};
      const evs: Map<string, Evaluation> = new Map();

      for (const n of notesExistantes) {
        if (!map[n.eleve_id]) map[n.eleve_id] = {};
        map[n.eleve_id][n.intitule] = String(n.note);

        if (!evs.has(n.intitule)) {
          evs.set(n.intitule, {
            intitule: n.intitule,
            type_evaluation: n.type_evaluation,
            trimestre: n.trimestre,
            note_sur: n.note_sur,
            coefficient: n.coefficient,
            date_evaluation: "",
          });
        }
      }

      setNotesMap(prev => ({ ...prev, ...map }));
      if (evaluations.length === 0) setEvaluations(Array.from(evs.values()));
    }
  }, [notesData]);

  // Autosave
  const triggerAutosave = () => {
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(handleSave, 30000);
  };

  const setNote = (eleveId: string, intitule: string, val: string) => {
    setNotesMap(prev => ({
      ...prev,
      [eleveId]: { ...prev[eleveId], [intitule]: val },
    }));
    triggerAutosave();
  };

  const handleSave = async () => {
    if (!classeId || !matiere || evaluations.length === 0) {
      toast({ title: "Sélectionnez une classe, une matière et créez au moins une évaluation.", variant: "destructive" });
      return;
    }

    setSaving(true);
    let totalSaisies = 0;

    for (const ev of evaluations) {
      const notesArr = classement.map(e => ({
        eleve_id: e.eleve_id,
        note: Number(notesMap[e.eleve_id]?.[ev.intitule] ?? ""),
      })).filter(n => !isNaN(n.note) && n.note >= 0 && n.note <= ev.note_sur);

      if (notesArr.length === 0) continue;

      await new Promise<void>(resolve => {
        saisirMut.mutate(
          {
            data: {
              classe_id: classeId,
              matiere,
              type_evaluation: ev.type_evaluation as "devoir" | "interrogation" | "composition" | "examen_blanc",
              trimestre: trimestre as "1" | "2" | "3",
              intitule: ev.intitule,
              annee_scolaire_id: anneeId,
              note_sur: ev.note_sur,
              coefficient: ev.coefficient,
              date_evaluation: ev.date_evaluation || new Date().toISOString().slice(0, 10),
              notes: notesArr,
            },
          },
          {
            onSuccess: (data) => {
              const res = data as unknown as { saisies?: number };
              totalSaisies += res.saisies ?? 0;
              resolve();
            },
            onError: () => resolve(),
          }
        );
      });
    }

    setSaving(false);
    toast({ title: `${totalSaisies} note(s) enregistrée(s) avec succès.` });
    refetchNotes();
  };

  const handleAddEval = (ev: Evaluation) => {
    setEvaluations(prev => [...prev, ev]);
  };

  const eleves = classement;

  // Calcul moyennes par éval (ligne de bas)
  const moyenneParEval = (ev: Evaluation): string => {
    const vals = eleves.map(e => Number(notesMap[e.eleve_id]?.[ev.intitule] ?? "")).filter(n => !isNaN(n));
    if (vals.length === 0) return "—";
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Saisie des notes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            {anneeActive?.libelle ?? "—"}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Enregistrement..." : "Enregistrer tout"}
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
            Classe
          </label>
          <select value={classeId} onChange={e => setClasseId(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            <option value="">Sélectionner une classe</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
            Matière
          </label>
          <input type="text" value={matiere} onChange={e => setMatiere(e.target.value)}
            placeholder="Ex: Mathématiques"
            className="px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", minWidth: "180px" }} />
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
            Trimestre
          </label>
          <div className="flex gap-1 rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--m15-border)", background: "var(--m15-card)" }}>
            {TRIMESTRES.map(t => (
              <button key={t}
                onClick={() => setTrimestre(t)}
                className="px-4 py-2.5 text-sm font-medium transition-all"
                style={{
                  background: trimestre === t ? "rgba(0,201,167,0.1)" : "transparent",
                  color: trimestre === t ? "#00C9A7" : "var(--m15-muted)",
                }}>
                T{t}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setEvalModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all self-end"
          style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.2)" }}
        >
          <Plus className="w-4 h-4" />
          Nouvelle évaluation
        </button>
      </div>

      {/* Tableau */}
      {!classeId || !matiere ? (
        <div className="rounded-2xl p-16 text-center"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <Award className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--m15-muted)" }} />
          <p className="font-semibold" style={{ color: "var(--m15-white)" }}>
            Sélectionnez une classe et une matière
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Le tableau de saisie apparaîtra ici
          </p>
        </div>
      ) : eleves.length === 0 ? (
        <div className="rounded-2xl p-16 text-center"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--m15-muted)" }} />
          <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Aucun élève trouvé</p>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Ajoutez d'abord des notes pour voir les élèves de cette classe
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid var(--m15-border)", background: "var(--m15-card)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--elevate-1)", borderBottom: "1px solid var(--m15-border)" }}>
                  <th className="text-left px-4 py-3 font-semibold sticky left-0 z-10"
                    style={{ color: "var(--m15-muted)", background: "var(--elevate-1)", minWidth: "180px" }}>
                    Élève
                  </th>
                  {evaluations.map(ev => (
                    <th key={ev.intitule} className="px-3 py-3 text-center font-semibold"
                      style={{ color: "var(--m15-muted)", minWidth: "100px" }}>
                      <div>{ev.intitule}</div>
                      <div className="text-xs font-normal">/{ ev.note_sur} · c{ev.coefficient}</div>
                    </th>
                  ))}
                  {evaluations.length === 0 && (
                    <th className="px-3 py-3 text-center" style={{ color: "var(--m15-muted)" }}>
                      — Créez une évaluation —
                    </th>
                  )}
                  <th className="px-4 py-3 text-center font-semibold"
                    style={{ color: "#00C9A7", minWidth: "100px" }}>
                    Moyenne
                  </th>
                </tr>
              </thead>
              <tbody>
                {eleves.map((e, i) => (
                  <tr key={e.eleve_id}
                    style={{ borderBottom: "1px solid var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td className="px-4 py-3 sticky left-0 z-10"
                      style={{ background: i % 2 === 0 ? "var(--m15-card)" : "var(--m15-card)" }}>
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}>
                          {e.rang}
                        </div>
                        <span className="font-medium" style={{ color: "var(--m15-white)" }}>
                          {e.eleve_prenoms} {e.eleve_nom}
                        </span>
                      </div>
                    </td>
                    {evaluations.map(ev => {
                      const val = notesMap[e.eleve_id]?.[ev.intitule] ?? "";
                      const num = Number(val);
                      const isValid = !isNaN(num) && num >= 0 && num <= ev.note_sur;
                      const hasVal = val !== "";
                      return (
                        <td key={ev.intitule} className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min={0}
                            max={ev.note_sur}
                            step={0.25}
                            value={val}
                            onChange={e2 => setNote(e.eleve_id, ev.intitule, e2.target.value)}
                            className="w-16 text-center py-1.5 rounded-lg text-sm outline-none font-semibold"
                            style={{
                              background: hasVal && isValid ? noteColor(num, ev.note_sur) : "var(--elevate-1)",
                              color: hasVal && isValid ? noteTextColor(num, ev.note_sur) : "var(--m15-muted)",
                              border: `1px solid ${hasVal && !isValid ? "#FF4D6D" : "var(--m15-border)"}`,
                            }}
                          />
                        </td>
                      );
                    })}
                    {evaluations.length === 0 && <td />}
                    <td className="px-4 py-3 text-center font-bold"
                      style={{ color: e.moyenne_generale >= 10 ? "#00C9A7" : e.moyenne_generale >= 8 ? "#F5C842" : "#FF4D6D" }}>
                      {e.moyenne_generale > 0 ? e.moyenne_generale.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
                {/* Ligne moyenne classe */}
                {eleves.length > 0 && evaluations.length > 0 && (
                  <tr style={{ background: "rgba(0,201,167,0.04)", borderTop: "2px solid var(--m15-border)" }}>
                    <td className="px-4 py-3 font-semibold sticky left-0"
                      style={{ background: "rgba(0,201,167,0.04)", color: "#00C9A7" }}>
                      Moyenne classe
                    </td>
                    {evaluations.map(ev => (
                      <td key={ev.intitule} className="px-3 py-3 text-center font-bold"
                        style={{ color: "#00C9A7" }}>
                        {moyenneParEval(ev)}
                      </td>
                    ))}
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal nouvelle éval */}
      {evalModalOpen && (
        <NouvelleEvalModal
          trimestre={trimestre}
          onClose={() => setEvalModalOpen(false)}
          onCreated={handleAddEval}
        />
      )}
    </div>
  );
}
