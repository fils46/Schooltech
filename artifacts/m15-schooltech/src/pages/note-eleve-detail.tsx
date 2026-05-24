import { useState } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetNotesEleve, useGetPresencesEleve,
  useListerAnneesScolaires,
  getGetNotesEleveQueryKey, getGetPresencesEleveQueryKey,
} from "@workspace/api-client-react";
import { Award, ChevronLeft, TrendingUp, BookOpen, UserCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/* ─── Types ─────────────────────────────────────────────────── */
type NoteItem = {
  id: string; eleve_id: string; eleve_nom?: string; eleve_prenoms?: string;
  matiere: string; trimestre: string; intitule: string; note: number;
  note_sur: number; coefficient: number; type_evaluation: string; date_evaluation: string;
};
type Moyenne = { matiere: string; trimestre: string; moyenne: number; coefficient_total: number };
type PresenceTaux = { matiere: string; taux: number; presents: number; total: number };

const TRIMESTRES = ["1", "2", "3"] as const;
const TYPE_EVAL_LABEL: Record<string, string> = {
  devoir: "Devoir", interrogation: "Interro", composition: "Compo", examen_blanc: "Examen blanc",
};

function noteColor(note: number, noteSur: number) {
  const p = note / noteSur;
  if (p >= 0.5) return "#00C9A7";
  if (p >= 0.4) return "#F5C842";
  return "#FF4D6D";
}

/* ─── Mini Bar Chart ─────────────────────────────────────────── */
function BarChart({ data }: { data: { label: string; value: number; max?: number }[] }) {
  const max = Math.max(...data.map(d => d.max ?? d.value), 20);
  return (
    <div className="flex items-end gap-2 h-20">
      {data.map((d, i) => {
        const h = Math.max(2, (d.value / max) * 80);
        const color = d.value >= 10 ? "#00C9A7" : d.value >= 8 ? "#F5C842" : "#FF4D6D";
        return (
          <div key={i} className="flex flex-col items-center gap-1 flex-1">
            <span className="text-xs font-bold" style={{ color }}>{d.value.toFixed(1)}</span>
            <div className="w-full rounded-t-lg transition-all"
              style={{ height: `${h}px`, background: `${color}33`, border: `1px solid ${color}55` }} />
            <span className="text-xs truncate w-full text-center" style={{ color: "var(--m15-muted)" }}>
              {d.label.slice(0, 6)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Page principale ──────────────────────────────────────── */
export default function NoteEleveDetail() {
  const { user } = useAuth();
  const params = useParams<{ eleveId: string }>();
  const [, setLocation] = useLocation();
  const eleveId = params.eleveId ?? "";

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as unknown as { annees?: { id: string; libelle: string; est_active?: boolean }[] })?.annees ?? [];
  const anneeActive = annees.find(a => a.est_active) ?? annees[0];
  const anneeId = anneeActive?.id ?? "";

  const [trimestre, setTrimestre] = useState<"1" | "2" | "3">("1");
  const [onglet, setOnglet] = useState<"notes" | "presences">("notes");

  const { data: notesData } = useGetNotesEleve(
    eleveId,
    { trimestre, annee_scolaire_id: anneeId || undefined },
    {
      query: {
        queryKey: getGetNotesEleveQueryKey(eleveId, { trimestre, annee_scolaire_id: anneeId || undefined }),
        enabled: !!eleveId,
      },
    }
  );

  const { data: presencesData } = useGetPresencesEleve(
    eleveId,
    { annee_scolaire_id: anneeId || undefined },
    {
      query: {
        queryKey: getGetPresencesEleveQueryKey(eleveId, { annee_scolaire_id: anneeId || undefined }),
        enabled: !!eleveId,
      },
    }
  );

  const notes: NoteItem[] = (notesData as unknown as { notes?: NoteItem[] })?.notes ?? [];
  const moyennes: Moyenne[] = (notesData as unknown as { moyennes?: Moyenne[] })?.moyennes ?? [];
  const tauxParMatiere: PresenceTaux[] = (presencesData as unknown as { taux_par_matiere?: PresenceTaux[] })?.taux_par_matiere ?? [];

  const eleveNom = notes[0] ? `${notes[0].eleve_prenoms ?? ""} ${notes[0].eleve_nom ?? ""}`.trim() : "Élève";

  // Grouper notes par matière
  const parMatiere: Record<string, NoteItem[]> = {};
  for (const n of notes) {
    if (!parMatiere[n.matiere]) parMatiere[n.matiere] = [];
    parMatiere[n.matiere].push(n);
  }

  // Moyennes par trimestre (pour graphique)
  const moyTrimestres = TRIMESTRES.map(t => {
    const moysT = moyennes.filter(m => m.trimestre === t);
    if (moysT.length === 0) return { label: `T${t}`, value: 0 };
    const totalCoef = moysT.reduce((a, m) => a + m.coefficient_total, 0);
    const sommePond = moysT.reduce((a, m) => a + m.moyenne * m.coefficient_total, 0);
    return { label: `T${t}`, value: totalCoef > 0 ? sommePond / totalCoef : 0 };
  });

  const moyGenT = moyTrimestres.find(m => m.label === `T${trimestre}`)?.value ?? 0;

  const canSeePresences = ["directeur", "censeur", "dev", "professeur", "parent", "eleve"].includes(user?.role ?? "");

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setLocation(-1 as unknown as string)}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Relevé de notes
          </h1>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            {eleveNom || "Chargement..."} · {anneeActive?.libelle ?? "—"}
          </p>
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Moyenne T1", value: moyTrimestres[0].value > 0 ? moyTrimestres[0].value.toFixed(2) : "—", color: moyTrimestres[0].value >= 10 ? "#00C9A7" : moyTrimestres[0].value >= 8 ? "#F5C842" : "#FF4D6D" },
          { label: "Moyenne T2", value: moyTrimestres[1].value > 0 ? moyTrimestres[1].value.toFixed(2) : "—", color: moyTrimestres[1].value >= 10 ? "#00C9A7" : moyTrimestres[1].value >= 8 ? "#F5C842" : "#FF4D6D" },
          { label: "Moyenne T3", value: moyTrimestres[2].value > 0 ? moyTrimestres[2].value.toFixed(2) : "—", color: moyTrimestres[2].value >= 10 ? "#00C9A7" : moyTrimestres[2].value >= 8 ? "#F5C842" : "#FF4D6D" },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: s.color }}>
              {s.value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* Graphique évolution */}
      {moyTrimestres.some(m => m.value > 0) && (
        <div className="rounded-2xl p-5"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5" style={{ color: "#0080FF" }} />
            <span className="font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Évolution des moyennes
            </span>
          </div>
          <BarChart data={moyTrimestres} />
        </div>
      )}

      {/* Onglets */}
      <div className="flex gap-1">
        {[
          { key: "notes", label: "Notes", icon: Award },
          ...(canSeePresences ? [{ key: "presences", label: "Présences", icon: UserCheck }] : []),
        ].map(({ key, label, icon: Icon }) => (
          <button key={key}
            onClick={() => setOnglet(key as "notes" | "presences")}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: onglet === key ? "rgba(0,201,167,0.1)" : "var(--m15-card)",
              color: onglet === key ? "#00C9A7" : "var(--m15-muted)",
              border: "1px solid var(--m15-border)",
            }}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {onglet === "notes" && (
        <>
          {/* Sélecteur trimestre */}
          <div className="flex gap-1 rounded-xl p-1"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", width: "fit-content" }}>
            {TRIMESTRES.map(t => (
              <button key={t}
                onClick={() => setTrimestre(t)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: trimestre === t ? "rgba(0,201,167,0.1)" : "transparent",
                  color: trimestre === t ? "#00C9A7" : "var(--m15-muted)",
                }}>
                Trimestre {t}
              </button>
            ))}
          </div>

          {/* Moyenne générale trimestre */}
          {moyGenT > 0 && (
            <div className="flex items-center gap-4 p-4 rounded-2xl"
              style={{ background: "var(--m15-card)", border: `2px solid ${moyGenT >= 10 ? "#00C9A7" : "#F5C842"}44` }}>
              <Award className="w-8 h-8" style={{ color: moyGenT >= 10 ? "#00C9A7" : "#F5C842" }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
                  Moyenne générale — Trimestre {trimestre}
                </p>
                <p className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: moyGenT >= 10 ? "#00C9A7" : "#F5C842" }}>
                  {moyGenT.toFixed(2)} / 20
                </p>
              </div>
            </div>
          )}

          {/* Notes par matière */}
          {Object.entries(parMatiere).length === 0 ? (
            <div className="rounded-2xl p-16 text-center"
              style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--m15-muted)" }} />
              <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Aucune note pour ce trimestre</p>
            </div>
          ) : (
            Object.entries(parMatiere).map(([mat, ns]) => {
              const moyMat = moyennes.find(m => m.matiere === mat && m.trimestre === trimestre);
              return (
                <div key={mat} className="rounded-2xl overflow-hidden"
                  style={{ border: "1px solid var(--m15-border)" }}>
                  <div className="flex items-center justify-between px-5 py-3"
                    style={{ background: "var(--elevate-1)", borderBottom: "1px solid var(--m15-border)" }}>
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4" style={{ color: "#0080FF" }} />
                      <span className="font-semibold" style={{ color: "var(--m15-white)" }}>{mat}</span>
                    </div>
                    {moyMat && (
                      <div className="text-right">
                        <span className="text-sm font-bold" style={{ color: noteColor(moyMat.moyenne, 20) }}>
                          Moy: {moyMat.moyenne.toFixed(2)}/20
                        </span>
                        <span className="text-xs ml-2" style={{ color: "var(--m15-muted)" }}>
                          (coeff total: {moyMat.coefficient_total})
                        </span>
                      </div>
                    )}
                  </div>
                  <div style={{ background: "var(--m15-card)" }}>
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                          {["Évaluation", "Type", "Date", "Coeff.", "Note"].map(h => (
                            <th key={h} className="px-4 py-2 text-left font-semibold"
                              style={{ color: "var(--m15-muted)" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {ns.map((n, i) => (
                          <tr key={n.id}
                            style={{ borderBottom: i < ns.length - 1 ? "1px solid var(--m15-border)" : "none" }}>
                            <td className="px-4 py-2.5 font-medium" style={{ color: "var(--m15-white)" }}>
                              {n.intitule}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs px-2 py-0.5 rounded-full"
                                style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}>
                                {TYPE_EVAL_LABEL[n.type_evaluation] ?? n.type_evaluation}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-sm" style={{ color: "var(--m15-muted)" }}>
                              {n.date_evaluation}
                            </td>
                            <td className="px-4 py-2.5 text-center font-medium" style={{ color: "var(--m15-muted)" }}>
                              ×{n.coefficient}
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="font-bold text-sm px-2.5 py-1 rounded-lg"
                                style={{ background: `${noteColor(n.note, n.note_sur)}22`, color: noteColor(n.note, n.note_sur) }}>
                                {n.note}/{n.note_sur}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {onglet === "presences" && (
        <div className="space-y-4">
          {tauxParMatiere.length === 0 ? (
            <div className="rounded-2xl p-16 text-center"
              style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <UserCheck className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--m15-muted)" }} />
              <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Aucun appel enregistré</p>
            </div>
          ) : (
            tauxParMatiere.map(t => (
              <div key={t.matiere} className="flex items-center gap-4 p-4 rounded-2xl"
                style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold flex-shrink-0"
                  style={{
                    background: t.taux >= 80 ? "rgba(0,201,167,0.15)" : t.taux >= 60 ? "rgba(245,200,66,0.15)" : "rgba(255,77,109,0.15)",
                    color: t.taux >= 80 ? "#00C9A7" : t.taux >= 60 ? "#F5C842" : "#FF4D6D",
                    fontFamily: "'Syne', sans-serif",
                  }}>
                  {t.taux}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold" style={{ color: "var(--m15-white)" }}>{t.matiere}</p>
                  <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
                    {t.presents} présences sur {t.total} cours
                  </p>
                  <div className="mt-1.5 rounded-full h-1.5 overflow-hidden"
                    style={{ background: "var(--elevate-2)" }}>
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${t.taux}%`,
                        background: t.taux >= 80 ? "#00C9A7" : t.taux >= 60 ? "#F5C842" : "#FF4D6D",
                      }} />
                  </div>
                </div>
                {t.taux < 70 && (
                  <span className="text-xs px-2 py-1 rounded-full font-semibold flex-shrink-0"
                    style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D" }}>
                    ⚠ Alerte
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
