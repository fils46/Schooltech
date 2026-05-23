import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useListerAbsences,
  useGetResumeAbsencesEleve,
  useSoumettreJustification,
  useListerAnneesScolaires,
  getListerAbsencesQueryKey,
  getGetResumeAbsencesEleveQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMinus, Clock, CheckCircle, XCircle, FileText, TrendingDown } from "lucide-react";

interface AnneeScolaire { id: string; annee: string; courante?: boolean; }
interface AbsenceItem {
  id: string; date_absence: string; matiere: string; type: string; statut: string;
  eleve_id: string; justification?: unknown;
}
interface Resume {
  total: number; justifiees: number; non_justifiees: number; retards: number; taux_presence: number;
}

const STATUT_BADGE: Record<string, { label: string; color: string }> = {
  non_justifiee: { label: "Non justifiée", color: "#FF4D6D" },
  en_attente:    { label: "En attente",    color: "#F5C842" },
  justifiee:     { label: "Justifiée",     color: "#00C9A7" },
  rejetee:       { label: "Rejetée",       color: "#8B9DC3" },
};

export default function AbsencesParent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [anneeId, setAnneeId] = useState("");
  const [justifModal, setJustifModal] = useState<{ absenceId: string; date: string } | null>(null);
  const [motif, setMotif] = useState("");

  const eleveId = user?.id ?? "";

  const { data: anneesData } = useListerAnneesScolaires();
  const annees: AnneeScolaire[] = (anneesData as unknown as { annees?: AnneeScolaire[] })?.annees ?? [];

  const absParams = { eleve_id: eleveId, annee_scolaire_id: anneeId || undefined };
  const absQKey = getListerAbsencesQueryKey(absParams);
  const { data: absData, isLoading: loadAbs } = useListerAbsences(absParams, {
    query: { queryKey: absQKey, enabled: !!eleveId },
  });
  const absences: AbsenceItem[] = (absData as { absences?: AbsenceItem[] })?.absences ?? [];

  const resumeParams = { annee_scolaire_id: anneeId || undefined };
  const resumeQKey = getGetResumeAbsencesEleveQueryKey(eleveId, resumeParams);
  const { data: resumeData } = useGetResumeAbsencesEleve(eleveId || "skip", resumeParams, {
    query: { queryKey: resumeQKey, enabled: !!eleveId },
  });
  const resume: Resume | undefined = (resumeData as { resume?: Resume })?.resume;

  const soumettre = useSoumettreJustification();

  function handleSoumettre() {
    if (!justifModal || !motif.trim()) return;
    soumettre.mutate({ id: justifModal.absenceId, data: { motif } }, {
      onSuccess: () => {
        toast({ title: "Justification soumise avec succès." });
        setJustifModal(null); setMotif("");
        void qc.invalidateQueries({ queryKey: absQKey });
      },
      onError: () => toast({ title: "Erreur lors de la soumission.", variant: "destructive" }),
    });
  }

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
            Absences de mon enfant
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>Suivi des présences et justifications</p>
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

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total absences",  val: resume?.total ?? 0,          icon: UserMinus,    color: "#0080FF" },
          { label: "Justifiées",      val: resume?.justifiees ?? 0,      icon: CheckCircle,  color: "#00C9A7" },
          { label: "Non justifiées",  val: resume?.non_justifiees ?? 0,  icon: XCircle,      color: "#FF4D6D" },
          { label: "Retards",         val: resume?.retards ?? 0,         icon: Clock,        color: "#F5C842" },
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
          <div className="flex items-center justify-between mb-2">
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

      {/* Liste absences */}
      <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--m15-border)" }}>
        <div className="px-5 py-3 font-semibold" style={{ background: "var(--m15-card)", borderBottom: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
          Historique des absences
        </div>
        {loadAbs ? (
          <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
        ) : absences.length === 0 ? (
          <div className="p-8 text-center" style={{ color: "var(--m15-muted)" }}>Aucune absence enregistrée.</div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
            {absences.map(a => {
              const badge = STATUT_BADGE[a.statut] ?? { label: a.statut, color: "#8B9DC3" };
              const peutJustifier = a.statut === "non_justifiee" || a.statut === "rejetee";
              return (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium" style={{ color: "var(--m15-white)" }}>{a.date_absence}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: a.type === "retard" ? "rgba(245,200,66,0.12)" : "rgba(255,77,109,0.12)", color: a.type === "retard" ? "#F5C842" : "#FF4D6D" }}>
                        {a.type === "retard" ? "Retard" : "Absence"}
                      </span>
                    </div>
                    <span className="text-sm" style={{ color: "var(--m15-muted)" }}>{a.matiere}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ background: `${badge.color}18`, color: badge.color }}>
                      {badge.label}
                    </span>
                    {peutJustifier && (
                      <button onClick={() => { setJustifModal({ absenceId: a.id, date: a.date_absence }); setMotif(""); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                        style={{ background: "rgba(0,128,255,0.12)", color: "#0080FF", border: "1px solid rgba(0,128,255,0.25)" }}>
                        <FileText className="w-3.5 h-3.5" /> Justifier
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal justification */}
      <Dialog open={!!justifModal} onOpenChange={() => setJustifModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Soumettre une justification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
              Absence du {justifModal?.date}
            </p>
            <div>
              <Label className="mb-2 block">Motif de l'absence <span style={{ color: "#FF4D6D" }}>*</span></Label>
              <Textarea value={motif} onChange={e => setMotif(e.target.value)}
                placeholder="Expliquez la raison de l'absence..."
                className="min-h-[100px]" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setJustifModal(null)}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ background: "var(--m15-card)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
                Annuler
              </button>
              <button onClick={handleSoumettre} disabled={!motif.trim() || soumettre.isPending}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#0080FF", color: "#fff", opacity: motif.trim() ? 1 : 0.5 }}>
                {soumettre.isPending ? "Envoi…" : "Soumettre"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
