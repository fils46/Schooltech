import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetEleaveDashboard, getGetEleaveDashboardQueryKey,
  useGetNotesEleve, getGetNotesEleveQueryKey,
  useListerAnneesScolaires,
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, ChevronDown, ChevronUp, BookOpen, TrendingUp } from "lucide-react";

type NoteItem = {
  id: string; eleve_id: string;
  matiere: string; trimestre: string; intitule: string; note: number;
  note_sur: number; coefficient: number; type_evaluation: string; date_evaluation: string;
  observations?: string;
};
type Moyenne = { matiere: string; trimestre: string; moyenne: number; coefficient_total: number };

const TYPE_LABEL: Record<string, string> = {
  devoir: "Devoir", interrogation: "Interro", composition: "Compo",
  examen_blanc: "Examen blanc", tp: "TP", expose: "Exposé", autre: "Autre",
};
const TRIMESTRE_LABELS: Record<string, string> = {
  "1": "1er Trimestre", "2": "2ème Trimestre", "3": "3ème Trimestre",
};

function noteColor(note: number, sur: number) {
  const p = note / (sur || 20);
  if (p >= 0.5) return "#00C9A7";
  if (p >= 0.4) return "#F5C842";
  return "#FF4D6D";
}

function MoyenneBadge({ moy }: { moy: number }) {
  const color = moy >= 10 ? "#00C9A7" : moy >= 8 ? "#F5C842" : "#FF4D6D";
  const bg = moy >= 10 ? "rgba(0,201,167,0.12)" : moy >= 8 ? "rgba(245,200,66,0.12)" : "rgba(255,77,109,0.12)";
  return (
    <span className="px-3 py-1 rounded-xl text-sm font-bold" style={{ background: bg, color, fontFamily: "'Syne', sans-serif" }}>
      {moy.toFixed(2)}/20
    </span>
  );
}

function MatiereSection({ matiere, notes, moyenne }: { matiere: string; notes: NoteItem[]; moyenne?: Moyenne }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      {/* En-tête matière */}
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen(o => !o)}
        style={{ borderBottom: open ? "1px solid var(--m15-border)" : "none" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,128,255,0.12)", border: "1px solid rgba(0,128,255,0.2)" }}>
            <BookOpen className="w-4 h-4" style={{ color: "#0080FF" }} />
          </div>
          <span className="font-semibold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            {matiere}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,128,255,0.1)", color: "#8B9DC3" }}>
            {notes.length} note{notes.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {moyenne && <MoyenneBadge moy={moyenne.moyenne} />}
          {open ? <ChevronUp className="w-4 h-4" style={{ color: "var(--m15-muted)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />}
        </div>
      </button>

      {/* Liste des notes */}
      {open && (
        <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
          {notes.map((n, i) => {
            const note20 = n.note_sur > 0 ? (n.note / n.note_sur) * 20 : n.note;
            const color = noteColor(note20, 20);
            return (
              <div key={n.id ?? i} className="flex items-center justify-between px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--m15-white)" }}>{n.intitule}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs px-1.5 py-0.5 rounded-md"
                      style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}>
                      {TYPE_LABEL[n.type_evaluation] ?? n.type_evaluation}
                    </span>
                    {n.date_evaluation && (
                      <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
                        {new Date(n.date_evaluation).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    {n.coefficient > 1 && (
                      <span className="text-xs" style={{ color: "var(--m15-muted)" }}>Coeff {n.coefficient}</span>
                    )}
                  </div>
                  {n.observations && (
                    <p className="text-xs mt-1 italic" style={{ color: "var(--m15-muted)" }}>{n.observations}</p>
                  )}
                </div>
                <div className="text-right ml-4 flex-shrink-0">
                  <p className="text-xl font-extrabold" style={{ color, fontFamily: "'Syne', sans-serif" }}>
                    {note20.toFixed(2)}
                    <span className="text-sm font-normal" style={{ color: "var(--m15-muted)" }}>/20</span>
                  </p>
                  {n.note_sur !== 20 && (
                    <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                      ({n.note}/{n.note_sur})
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MesNotes() {
  const { user } = useAuth();
  const [trimestre, setTrimestre] = useState<"1" | "2" | "3">("1");
  const [anneeId, setAnneeId] = useState("");

  const { data: dashData } = useGetEleaveDashboard({
    query: { queryKey: getGetEleaveDashboardQueryKey() },
  });
  const d = dashData as Record<string, unknown> | undefined;
  const eleveRec = d?.eleve as Record<string, unknown> | null | undefined;
  const eleveId = (eleveRec?.id as string) ?? "";

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { annees?: { id: string; libelle: string; est_active?: boolean }[] })?.annees ?? [];

  const params = { trimestre, ...(anneeId ? { annee_scolaire_id: anneeId } : {}) };
  const { data: notesData, isLoading } = useGetNotesEleve(
    eleveId || "skip",
    params,
    { query: { queryKey: getGetNotesEleveQueryKey(eleveId, params), enabled: !!eleveId } }
  );

  const notes: NoteItem[] = (notesData as unknown as { notes?: NoteItem[] })?.notes ?? [];
  const moyennes: Moyenne[] = (notesData as unknown as { moyennes?: Moyenne[] })?.moyennes ?? [];

  const parMatiere: Record<string, NoteItem[]> = {};
  for (const n of notes) {
    if (!parMatiere[n.matiere]) parMatiere[n.matiere] = [];
    parMatiere[n.matiere].push(n);
  }

  const moyenneGenerale = (() => {
    if (moyennes.length === 0) return null;
    const total = moyennes.reduce((s, m) => s + m.moyenne * m.coefficient_total, 0);
    const coeff = moyennes.reduce((s, m) => s + m.coefficient_total, 0);
    return coeff > 0 ? total / coeff : null;
  })();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.25)" }}>
          <Award className="w-5 h-5" style={{ color: "#00C9A7" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Mes Notes
          </h2>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            {user?.prenoms} {user?.nom}
          </p>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-2xl p-4 flex flex-wrap gap-4"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex-1 min-w-[140px]">
          <p className="text-xs mb-1.5 font-semibold uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>Trimestre</p>
          <div className="flex gap-2">
            {(["1", "2", "3"] as const).map(t => (
              <button key={t}
                onClick={() => setTrimestre(t)}
                className="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                style={trimestre === t
                  ? { background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }
                  : { background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                T{t}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 min-w-[160px]">
          <p className="text-xs mb-1.5 font-semibold uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>Année scolaire</p>
          <Select value={anneeId || "__all__"} onValueChange={v => setAnneeId(v === "__all__" ? "" : v)}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes les années</SelectItem>
              {annees.map(a => <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Moyenne du trimestre */}
      {moyenneGenerale !== null && (
        <div className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.25)" }}>
            <TrendingUp className="w-6 h-6" style={{ color: "#00C9A7" }} />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-0.5" style={{ color: "var(--m15-muted)" }}>
              Moyenne générale — {TRIMESTRE_LABELS[trimestre]}
            </p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold"
                style={{ color: noteColor(moyenneGenerale, 20), fontFamily: "'Syne', sans-serif" }}>
                {moyenneGenerale.toFixed(2)}
              </span>
              <span className="text-lg font-semibold" style={{ color: "var(--m15-muted)" }}>/20</span>
              <span className="text-sm px-2 py-0.5 rounded-full ml-1"
                style={{
                  background: moyennes.length > 0 ? "rgba(0,128,255,0.1)" : "transparent",
                  color: "#8B9DC3",
                }}>
                {moyennes.length} matière{moyennes.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Contenu */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
        </div>
      ) : Object.keys(parMatiere).length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
            style={{ background: "rgba(245,200,66,0.12)" }}>
            <Award className="w-7 h-7" style={{ color: "#F5C842" }} />
          </div>
          <p className="font-semibold mb-1" style={{ color: "var(--m15-white)" }}>
            Aucune note pour le {TRIMESTRE_LABELS[trimestre]}
          </p>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Vos notes apparaîtront ici une fois saisies par vos professeurs.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(parMatiere).map(([mat, mNotes]) => (
            <MatiereSection
              key={mat}
              matiere={mat}
              notes={mNotes}
              moyenne={moyennes.find(m => m.matiere === mat && m.trimestre === trimestre)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
