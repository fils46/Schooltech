import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useListerAbsences,
  useGetStatistiquesAbsences,
  useGetElevesARisque,
  useListerJustifications,
  useTraiterJustification,
  useListerClasses,
  useListerAnneesScolaires,
  getListerAbsencesQueryKey,
  getListerJustificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserMinus, AlertTriangle, Clock, CheckCircle, XCircle,
  Filter, FileDown, RefreshCw, BarChart2,
} from "lucide-react";

interface Classe { id: string; nom: string; }
interface AnneeScolaire { id: string; annee: string; courante?: boolean; }
interface AbsenceItem {
  id: string; eleve_nom: string; eleve_prenoms: string; classe_nom: string;
  matiere: string; date_absence: string; type: string; statut: string;
  professeur_nom: string; justification?: unknown;
}
interface JustifItem {
  id: string; motif: string; statut: string; soumis_par_nom: string;
  document_url?: string; created_at: string;
  absence: { date_absence: string; matiere: string; eleve_id: string } | null;
}
interface EleveRisque {
  eleve_id: string; nom: string; prenoms: string; classe_nom: string;
  nb_absences: number; derniere_absence: string;
}

const TABS = [
  { id: "dashboard", label: "Tableau de bord", icon: BarChart2 },
  { id: "liste",     label: "Liste absences",  icon: UserMinus },
  { id: "justifs",   label: "Justifications",  icon: FileDown },
  { id: "risque",    label: "Élèves à risque", icon: AlertTriangle },
] as const;

type Tab = typeof TABS[number]["id"];

const STATUT_BADGE: Record<string, { label: string; color: string }> = {
  non_justifiee: { label: "Non justifiée", color: "#FF4D6D" },
  en_attente:    { label: "En attente",    color: "#F5C842" },
  justifiee:     { label: "Justifiée",     color: "#00C9A7" },
  rejetee:       { label: "Rejetée",       color: "var(--m15-muted)" },
};

export default function AbsenceGestion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [tab, setTab] = useState<Tab>("dashboard");
  const [anneeId, setAnneeId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [rejetModal, setRejetModal] = useState<{ id: string; absenceDate: string } | null>(null);
  const [commentaire, setCommentaire] = useState("");

  if (!["dev", "directeur", "censeur"].includes(user?.role ?? "")) {
    return <div className="p-6" style={{ color: "var(--m15-muted)" }}>Accès réservé.</div>;
  }

  const { data: classesData } = useListerClasses();
  const { data: anneesData } = useListerAnneesScolaires();
  const classes: Classe[] = (classesData as unknown as { classes?: Classe[] })?.classes ?? [];
  const annees: AnneeScolaire[] = (anneesData as unknown as { annees?: AnneeScolaire[] })?.annees ?? [];

  const absParams = { annee_scolaire_id: anneeId || undefined, classe_id: classeId || undefined, statut: statutFilter || undefined };
  const absQKey = getListerAbsencesQueryKey(absParams);
  const { data: absData, isLoading: loadAbs } = useListerAbsences(absParams, {
    query: { queryKey: absQKey, enabled: true },
  });
  const absences: AbsenceItem[] = (absData as { absences?: AbsenceItem[] })?.absences ?? [];

  const { data: statsData } = useGetStatistiquesAbsences(
    { annee_scolaire_id: anneeId || undefined, classe_id: classeId || undefined },
    { query: { queryKey: ["abs-stats", anneeId, classeId], enabled: true } }
  );
  const stats = (statsData as { statistiques?: { total: number; non_justifiees: number; en_attente: number } })?.statistiques;

  const justQKey = getListerJustificationsQueryKey({ statut: "en_attente" });
  const { data: justData, isLoading: loadJust } = useListerJustifications(
    { statut: "en_attente" },
    { query: { queryKey: justQKey, enabled: true } }
  );
  const justifs: JustifItem[] = (justData as { justifications?: JustifItem[] })?.justifications ?? [];

  const { data: risqueData, isLoading: loadRisque } = useGetElevesARisque(
    { annee_scolaire_id: anneeId || undefined },
    { query: { queryKey: ["eleves-risque", anneeId], enabled: true } }
  );
  const elevesRisque: EleveRisque[] = (risqueData as { eleves?: EleveRisque[] })?.eleves ?? [];
  const seuil: number = (risqueData as { seuil?: number })?.seuil ?? 3;

  const traiter = useTraiterJustification();

  function handleTraiter(id: string, decision: "validee" | "rejetee", absDate: string) {
    if (decision === "rejetee" && !commentaire) {
      setRejetModal({ id, absenceDate: absDate });
      return;
    }
    traiter.mutate({ id, data: { decision, commentaire: commentaire || undefined } }, {
      onSuccess: () => {
        toast({ title: decision === "validee" ? "Justification validée." : "Justification rejetée." });
        setRejetModal(null); setCommentaire("");
        void qc.invalidateQueries({ queryKey: justQKey });
        void qc.invalidateQueries({ queryKey: absQKey });
      },
      onError: () => toast({ title: "Erreur lors du traitement.", variant: "destructive" }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Gestion des Absences
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Suivi, justifications et alertes
          </p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select value={anneeId} onValueChange={setAnneeId}>
            <SelectTrigger className="w-44" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Année scolaire" />
            </SelectTrigger>
            <SelectContent>
              {annees.map(a => <SelectItem key={a.id} value={a.id}>{a.annee}{a.courante ? " ★" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classeId || "__all__"} onValueChange={v => setClasseId(v === "__all__" ? "" : v)}>
            <SelectTrigger className="w-36" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Toutes classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="flex items-center gap-2 flex-1 justify-center px-3 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: active ? "rgba(0,201,167,0.12)" : "transparent",
                color: active ? "#00C9A7" : "var(--m15-muted)",
                border: active ? "1px solid rgba(0,201,167,0.25)" : "1px solid transparent",
              }}>
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{t.label}</span>
              {t.id === "justifs" && justifs.length > 0 && (
                <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ml-1"
                  style={{ background: "#F5C842", color: "var(--m15-navy)" }}>{justifs.length}</span>
              )}
              {t.id === "risque" && elevesRisque.length > 0 && (
                <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ml-1"
                  style={{ background: "#FF4D6D", color: "#fff" }}>{elevesRisque.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Dashboard ── */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total absences", val: stats?.total ?? 0, icon: UserMinus, color: "#0080FF" },
              { label: "Non justifiées", val: stats?.non_justifiees ?? 0, icon: XCircle, color: "#FF4D6D" },
              { label: "En attente",     val: stats?.en_attente ?? 0, icon: Clock, color: "#F5C842" },
              { label: "Élèves à risque", val: elevesRisque.length, icon: AlertTriangle, color: "#FF4D6D" },
            ].map(card => {
              const Icon = card.icon;
              return (
                <div key={card.label} className="p-5 rounded-2xl" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm" style={{ color: "var(--m15-muted)" }}>{card.label}</span>
                    <Icon className="w-4 h-4" style={{ color: card.color }} />
                  </div>
                  <p className="text-3xl font-bold" style={{ color: card.color, fontFamily: "'Syne', sans-serif" }}>{card.val}</p>
                </div>
              );
            })}
          </div>
          {absences.length === 0 && !loadAbs && (
            <div className="p-8 rounded-2xl text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#00C9A7" }} />
              <p style={{ color: "var(--m15-white)" }}>Aucune absence enregistrée pour cette sélection.</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Liste absences ── */}
      {tab === "liste" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={statutFilter || "__all__"} onValueChange={v => setStatutFilter(v === "__all__" ? "" : v)}>
              <SelectTrigger className="w-44" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                <SelectValue placeholder="Tous statuts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tous statuts</SelectItem>
                <SelectItem value="non_justifiee">Non justifiée</SelectItem>
                <SelectItem value="en_attente">En attente</SelectItem>
                <SelectItem value="justifiee">Justifiée</SelectItem>
                <SelectItem value="rejetee">Rejetée</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loadAbs ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--m15-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--m15-card)", borderBottom: "1px solid var(--m15-border)" }}>
                    {["Date", "Élève", "Classe", "Matière", "Type", "Statut"].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "var(--m15-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {absences.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-8 text-center" style={{ color: "var(--m15-muted)" }}>Aucune absence.</td></tr>
                  ) : absences.map(a => {
                    const badge = STATUT_BADGE[a.statut] ?? { label: a.statut, color: "var(--m15-muted)" };
                    return (
                      <tr key={a.id} style={{ borderBottom: "1px solid var(--m15-border)" }}
                        className="transition-colors hover:opacity-90"
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--m15-card)"}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ""}>
                        <td className="px-4 py-3" style={{ color: "var(--m15-white)" }}>{a.date_absence}</td>
                        <td className="px-4 py-3" style={{ color: "var(--m15-white)" }}>{a.eleve_prenoms} {a.eleve_nom}</td>
                        <td className="px-4 py-3" style={{ color: "var(--m15-muted)" }}>{a.classe_nom}</td>
                        <td className="px-4 py-3" style={{ color: "var(--m15-muted)" }}>{a.matiere}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: a.type === "retard" ? "rgba(245,200,66,0.12)" : "rgba(255,77,109,0.12)", color: a.type === "retard" ? "#F5C842" : "#FF4D6D" }}>
                            {a.type === "retard" ? "Retard" : "Absence"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: `${badge.color}18`, color: badge.color }}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Justifications en attente ── */}
      {tab === "justifs" && (
        <div className="space-y-4">
          {loadJust ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          ) : justifs.length === 0 ? (
            <div className="p-8 rounded-2xl text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#00C9A7" }} />
              <p style={{ color: "var(--m15-white)" }}>Aucune justification en attente.</p>
            </div>
          ) : justifs.map(j => (
            <div key={j.id} className="p-4 rounded-2xl" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold" style={{ color: "var(--m15-white)" }}>
                    Absence du {j.absence?.date_absence ?? "—"} — {j.absence?.matiere ?? "—"}
                  </p>
                  <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>Soumis par : {j.soumis_par_nom}</p>
                  <p className="text-sm mt-2 p-3 rounded-xl" style={{ color: "var(--m15-white)", background: "var(--elevate-1)" }}>{j.motif}</p>
                  {j.document_url && (
                    <a href={j.document_url} target="_blank" rel="noreferrer" className="text-sm underline mt-1 inline-block" style={{ color: "#0080FF" }}>
                      Voir pièce jointe
                    </a>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleTraiter(j.id, "validee", j.absence?.date_absence ?? "")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: "rgba(0,201,167,0.12)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.25)" }}>
                    <CheckCircle className="w-4 h-4" /> Valider
                  </button>
                  <button onClick={() => { setRejetModal({ id: j.id, absenceDate: j.absence?.date_absence ?? "" }); setCommentaire(""); }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                    style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.25)" }}>
                    <XCircle className="w-4 h-4" /> Rejeter
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Élèves à risque ── */}
      {tab === "risque" && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Élèves avec ≥ {seuil} absences non justifiées.
          </p>
          {loadRisque ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}</div>
          ) : elevesRisque.length === 0 ? (
            <div className="p-8 rounded-2xl text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <CheckCircle className="w-12 h-12 mx-auto mb-3" style={{ color: "#00C9A7" }} />
              <p style={{ color: "var(--m15-white)" }}>Aucun élève à risque.</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--m15-border)" }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "var(--m15-card)", borderBottom: "1px solid var(--m15-border)" }}>
                    {["Élève", "Classe", "Absences NJ", "Dernière absence"].map(h => (
                      <th key={h} className="px-4 py-3 text-left font-semibold" style={{ color: "var(--m15-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {elevesRisque.map(e => (
                    <tr key={e.eleve_id} style={{ borderBottom: "1px solid var(--m15-border)" }}>
                      <td className="px-4 py-3 font-medium" style={{ color: "var(--m15-white)" }}>{e.prenoms} {e.nom}</td>
                      <td className="px-4 py-3" style={{ color: "var(--m15-muted)" }}>{e.classe_nom}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D" }}>{e.nb_absences}</span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--m15-muted)" }}>{e.derniere_absence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal rejet */}
      <Dialog open={!!rejetModal} onOpenChange={() => setRejetModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter la justification</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="mb-2 block">Commentaire (obligatoire)</Label>
              <Textarea value={commentaire} onChange={e => setCommentaire(e.target.value)}
                placeholder="Raison du rejet..."
                className="min-h-[100px]" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setRejetModal(null)}
                className="px-4 py-2 rounded-xl text-sm"
                style={{ background: "var(--m15-card)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
                Annuler
              </button>
              <button onClick={() => rejetModal && handleTraiter(rejetModal.id, "rejetee", rejetModal.absenceDate)}
                disabled={!commentaire.trim()}
                className="px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "#FF4D6D", color: "#fff", opacity: commentaire.trim() ? 1 : 0.5 }}>
                Confirmer le rejet
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
