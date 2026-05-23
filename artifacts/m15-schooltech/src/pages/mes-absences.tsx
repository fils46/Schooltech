import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useListerAbsences,
  useGetResumeAbsencesEleve,
  useListerAnneesScolaires,
  getListerAbsencesQueryKey,
  getGetResumeAbsencesEleveQueryKey,
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMinus, Clock, CheckCircle, XCircle, BookOpen } from "lucide-react";

interface AnneeScolaire { id: string; annee: string; courante?: boolean; }
interface AbsenceItem {
  id: string; date_absence: string; matiere: string; type: string; statut: string;
}
interface MatiereStats { matiere: string; total: number; type_absence: number; type_retard: number; }
interface Resume {
  total: number; justifiees: number; non_justifiees: number; retards: number;
  taux_presence: number; par_matiere: MatiereStats[];
}

const STATUT_BADGE: Record<string, { label: string; color: string }> = {
  non_justifiee: { label: "Non justifiée", color: "#FF4D6D" },
  en_attente:    { label: "En attente",    color: "#F5C842" },
  justifiee:     { label: "Justifiée",     color: "#00C9A7" },
  rejetee:       { label: "Rejetée",       color: "var(--m15-muted)" },
};

export default function MesAbsences() {
  const { user } = useAuth();
  const [anneeId, setAnneeId] = useState("");

  const eleveId = user?.id ?? "";

  const { data: anneesData } = useListerAnneesScolaires();
  const annees: AnneeScolaire[] = (anneesData as unknown as { annees?: AnneeScolaire[] })?.annees ?? [];

  const absParams = { eleve_id: eleveId, annee_scolaire_id: anneeId || undefined };
  const absQKey = getListerAbsencesQueryKey(absParams);
  const { data: absData, isLoading: loadAbs } = useListerAbsences(absParams, {
    query: { queryKey: absQKey, enabled: !!eleveId },
  });
  const absences: AbsenceItem[] = (absData as unknown as { absences?: AbsenceItem[] })?.absences ?? [];

  const resumeParams = { annee_scolaire_id: anneeId || undefined };
  const resumeQKey = getGetResumeAbsencesEleveQueryKey(eleveId, resumeParams);
  const { data: resumeData } = useGetResumeAbsencesEleve(eleveId || "skip", resumeParams, {
    query: { queryKey: resumeQKey, enabled: !!eleveId },
  });
  const resume: Resume | undefined = (resumeData as unknown as { resume?: Resume })?.resume;
  const parMatiere: MatiereStats[] = resume?.par_matiere ?? [];

  const tauxColor = !resume ? "#8B9DC3"
    : resume.taux_presence >= 90 ? "#00C9A7"
    : resume.taux_presence >= 75 ? "#F5C842"
    : "#FF4D6D";

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Mes Absences
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>Suivi de vos présences et absences</p>
        </div>
        <Select value={anneeId || "__all__"} onValueChange={v => setAnneeId(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-44" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            <SelectValue placeholder="Toutes années" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Toutes années</SelectItem>
            {annees.map(a => <SelectItem key={a.id} value={a.id}>{a.annee}{a.courante ? " ★" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total",          val: resume?.total ?? 0,          icon: UserMinus,    color: "#0080FF" },
          { label: "Justifiées",     val: resume?.justifiees ?? 0,      icon: CheckCircle,  color: "#00C9A7" },
          { label: "Non justifiées", val: resume?.non_justifiees ?? 0,  icon: XCircle,      color: "#FF4D6D" },
          { label: "Retards",        val: resume?.retards ?? 0,         icon: Clock,        color: "#F5C842" },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="p-4 rounded-2xl" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs" style={{ color: "var(--m15-muted)" }}>{card.label}</span>
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <p className="text-2xl font-bold" style={{ color: card.color, fontFamily: "'Syne', sans-serif" }}>{card.val}</p>
            </div>
          );
        })}
      </div>

      {/* Taux de présence */}
      {resume && (
        <div className="p-5 rounded-2xl" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="font-semibold" style={{ color: "var(--m15-white)" }}>Taux de présence global</span>
            <span className="text-2xl font-bold" style={{ color: tauxColor, fontFamily: "'Syne', sans-serif" }}>
              {resume.taux_presence}%
            </span>
          </div>
          <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "var(--elevate-1)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, resume.taux_presence)}%`, background: tauxColor }} />
          </div>
        </div>
      )}

      {/* Par matière */}
      {parMatiere.length > 0 && (
        <div className="p-5 rounded-2xl" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--m15-white)" }}>
            <BookOpen className="w-4 h-4" style={{ color: "#00C9A7" }} /> Absences par matière
          </h3>
          <div className="space-y-3">
            {parMatiere.map(m => {
              const max = Math.max(...parMatiere.map(x => x.total));
              const pct = max > 0 ? (m.total / max) * 100 : 0;
              return (
                <div key={m.matiere}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>{m.matiere}</span>
                    <span className="text-sm font-bold" style={{ color: "#FF4D6D" }}>{m.total}</span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--elevate-1)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg, #FF4D6D, #F5C842)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Liste chronologique */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--m15-border)" }}>
        <div className="px-5 py-3 font-semibold" style={{ background: "var(--m15-card)", borderBottom: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
          Historique
        </div>
        {loadAbs ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : absences.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#00C9A7" }} />
            <p style={{ color: "var(--m15-muted)" }}>Aucune absence enregistrée.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
            {absences.map(a => {
              const badge = STATUT_BADGE[a.statut] ?? { label: a.statut, color: "var(--m15-muted)" };
              return (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <span className="font-medium" style={{ color: "var(--m15-white)" }}>{a.date_absence}</span>
                    <span className="text-sm ml-3" style={{ color: "var(--m15-muted)" }}>{a.matiere}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: a.type === "retard" ? "rgba(245,200,66,0.12)" : "rgba(255,77,109,0.12)", color: a.type === "retard" ? "#F5C842" : "#FF4D6D" }}>
                      {a.type === "retard" ? "Retard" : "Absence"}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${badge.color}18`, color: badge.color }}>
                      {badge.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
