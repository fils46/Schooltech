import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useListerConseils,
  usePlanifierConseil,
  useDemarrerConseil,
  useTerminerConseil,
  useGetConseil,
  useListerClasses,
  useListerAnneesScolaires,
  getListerConseilsQueryKey,
  getGetConseilQueryKey,
  type PlanifierConseilInputTrimestre,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Plus, Play, CheckCircle, Loader2, Calendar, AlertCircle, Eye,
} from "lucide-react";

type ConseilItem = {
  id: string;
  classe_id: string;
  classe_nom: string;
  annee_scolaire_id: string;
  trimestre: string;
  date_conseil: string;
  president_id: string;
  president_nom: string;
  observations_generales: string | null;
  statut: "planifie" | "en_cours" | "termine";
};
type Classe = { id: string; nom: string };
type AnneeScolaire = { id: string; libelle: string };
type Utilisateur = { id: string; nom: string; prenoms: string; role: string };

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planifie:  { label: "Planifié",   color: "#F5C842", bg: "rgba(245,200,66,0.12)" },
  en_cours:  { label: "En cours",   color: "#0080FF", bg: "rgba(0,128,255,0.12)" },
  termine:   { label: "Terminé",    color: "#00C9A7", bg: "rgba(0,201,167,0.12)" },
};

export default function ConseilClasse() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filterClasse, setFilterClasse] = useState("");
  const [filterAnnee, setFilterAnnee] = useState("");
  const [filterTrimestre, setFilterTrimestre] = useState("");
  const [filterStatut, setFilterStatut] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showTerminer, setShowTerminer] = useState<{ id: string } | null>(null);
  const [observations, setObservations] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);

  const [form, setForm] = useState({
    classe_id: "", annee_scolaire_id: "", trimestre: "1",
    date_conseil: "", president_id: "",
  });

  const { data: classesData } = useListerClasses();
  const { data: anneesData } = useListerAnneesScolaires();
  const classes: Classe[] = (classesData as { classes?: Classe[] })?.classes ?? [];
  const annees: AnneeScolaire[] = (anneesData as { annees?: AnneeScolaire[] })?.annees ?? [];

  const listParams = {
    ...(filterClasse && { classe_id: filterClasse }),
    ...(filterAnnee && { annee_scolaire_id: filterAnnee }),
    ...(filterTrimestre && { trimestre: filterTrimestre as "1"|"2"|"3" }),
    ...(filterStatut && { statut: filterStatut as "planifie"|"en_cours"|"termine" }),
  };

  const { data: conseilsData, isLoading } = useListerConseils(listParams);
  const conseils: ConseilItem[] = (conseilsData as { conseils?: ConseilItem[] })?.conseils ?? [];

  const { data: detailData } = useGetConseil(
    detailId ?? "skip",
    { query: { queryKey: getGetConseilQueryKey(detailId ?? ""), enabled: !!detailId } }
  );
  const detailConseil: ConseilItem | null = (detailData as { conseil?: ConseilItem })?.conseil ?? null;

  const planifier = usePlanifierConseil();
  const demarrer = useDemarrerConseil();
  const terminer = useTerminerConseil();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListerConseilsQueryKey(listParams) });

  function handlePlanifier() {
    if (!form.classe_id || !form.annee_scolaire_id || !form.date_conseil || !form.president_id) {
      toast({ title: "Tous les champs obligatoires doivent être remplis.", variant: "destructive" });
      return;
    }
    planifier.mutate(
      { data: { ...form, trimestre: form.trimestre as PlanifierConseilInputTrimestre } },
      {
        onSuccess: () => {
          toast({ title: "Conseil planifié." });
          setShowCreate(false);
          setForm({ classe_id: "", annee_scolaire_id: "", trimestre: "1", date_conseil: "", president_id: "" });
          invalidate();
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur lors de la planification.";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleDemarrer(id: string) {
    demarrer.mutate({ id }, {
      onSuccess: () => { toast({ title: "Conseil démarré." }); invalidate(); },
      onError: () => toast({ title: "Erreur.", variant: "destructive" }),
    });
  }

  function handleTerminer() {
    if (!showTerminer) return;
    terminer.mutate(
      { id: showTerminer.id, data: { observations_generales: observations || null } },
      {
        onSuccess: () => {
          toast({ title: "Conseil terminé." });
          setShowTerminer(null);
          setObservations("");
          invalidate();
        },
        onError: () => toast({ title: "Erreur.", variant: "destructive" }),
      }
    );
  }

  const canAction = ["dev", "directeur", "censeur"].includes(user?.role ?? "");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(245,200,66,0.12)", border: "1px solid rgba(245,200,66,0.25)" }}>
            <Users className="w-5 h-5" style={{ color: "#F5C842" }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Conseils de Classe</h2>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Planification et suivi des conseils de classe</p>
          </div>
        </div>
        {canAction && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm"
            style={{ background: "#00C9A7", color: "#0A1628" }}
          >
            <Plus className="w-4 h-4" /> Planifier un conseil
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Classe</Label>
          <Select value={filterClasse} onValueChange={setFilterClasse}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Trimestre</Label>
          <Select value={filterTrimestre} onValueChange={setFilterTrimestre}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              <SelectItem value="1">Trimestre 1</SelectItem>
              <SelectItem value="2">Trimestre 2</SelectItem>
              <SelectItem value="3">Trimestre 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Statut</Label>
          <Select value={filterStatut} onValueChange={setFilterStatut}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tous</SelectItem>
              <SelectItem value="planifie">Planifié</SelectItem>
              <SelectItem value="en_cours">En cours</SelectItem>
              <SelectItem value="termine">Terminé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Année</Label>
          <Select value={filterAnnee} onValueChange={setFilterAnnee}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Toutes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Toutes</SelectItem>
              {annees.map(a => <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      {conseils.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total", value: conseils.length, color: "var(--m15-white)" },
            { label: "En cours", value: conseils.filter(c => c.statut === "en_cours").length, color: "#0080FF" },
            { label: "Terminés", value: conseils.filter(c => c.statut === "termine").length, color: "#00C9A7" },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>{s.label}</p>
              <p className="text-2xl font-bold" style={{ color: s.color, fontFamily: "'Syne', sans-serif" }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
        </div>
      ) : conseils.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--m15-card)", border: "1px dashed var(--m15-border)" }}>
          <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
          <p style={{ color: "var(--m15-muted)" }}>Aucun conseil de classe trouvé</p>
          {canAction && <p className="text-sm mt-1" style={{ color: "var(--m15-muted)", opacity: 0.7 }}>Planifiez un conseil depuis le bouton ci-dessus</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {conseils.map(c => {
            const st = STATUT_CONFIG[c.statut];
            return (
              <div key={c.id} className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-bold" style={{ color: "var(--m15-white)" }}>{c.classe_nom}</span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(0,128,255,0.12)", color: "#0080FF" }}>T{c.trimestre}</span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span style={{ color: "var(--m15-muted)" }}>Date : </span>
                        <span style={{ color: "var(--m15-white)" }}>{c.date_conseil}</span>
                      </div>
                      <div>
                        <span style={{ color: "var(--m15-muted)" }}>Président : </span>
                        <span style={{ color: "var(--m15-white)" }}>{c.president_nom}</span>
                      </div>
                      {c.observations_generales && (
                        <div className="col-span-2 sm:col-span-3">
                          <span style={{ color: "var(--m15-muted)" }}>Observations : </span>
                          <span className="italic" style={{ color: "var(--m15-white)" }}>{c.observations_generales}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {canAction && (
                    <div className="flex items-center gap-2">
                      <button onClick={() => setDetailId(c.id)} className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>
                        <Eye className="w-4 h-4" />
                      </button>
                      {c.statut === "planifie" && (
                        <button
                          onClick={() => handleDemarrer(c.id)}
                          disabled={demarrer.isPending}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: "rgba(0,128,255,0.12)", border: "1px solid rgba(0,128,255,0.25)", color: "#0080FF" }}
                        >
                          {demarrer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                          Démarrer
                        </button>
                      )}
                      {c.statut === "en_cours" && (
                        <button
                          onClick={() => setShowTerminer({ id: c.id })}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                          style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.25)", color: "#00C9A7" }}
                        >
                          <CheckCircle className="w-4 h-4" /> Terminer
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal créer conseil */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)" }}>Planifier un conseil de classe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Classe *</Label>
                <Select value={form.classe_id} onValueChange={v => setForm(p => ({ ...p, classe_id: v }))}>
                  <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Trimestre *</Label>
                <Select value={form.trimestre} onValueChange={v => setForm(p => ({ ...p, trimestre: v }))}>
                  <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Trimestre 1</SelectItem>
                    <SelectItem value="2">Trimestre 2</SelectItem>
                    <SelectItem value="3">Trimestre 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Année scolaire *</Label>
              <Select value={form.annee_scolaire_id} onValueChange={v => setForm(p => ({ ...p, annee_scolaire_id: v }))}>
                <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {annees.map(a => <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Date du conseil *</Label>
              <Input
                type="date"
                value={form.date_conseil}
                onChange={e => setForm(p => ({ ...p, date_conseil: e.target.value }))}
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>ID du président *</Label>
              <Input
                value={form.president_id}
                onChange={e => setForm(p => ({ ...p, president_id: e.target.value }))}
                placeholder="UUID du directeur ou censeur"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
              />
              <p className="text-xs mt-1" style={{ color: "var(--m15-muted)" }}>ID de l'utilisateur présidant le conseil</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handlePlanifier}
                disabled={planifier.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold"
                style={{ background: "#00C9A7", color: "#0A1628" }}
              >
                {planifier.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Planifier
              </button>
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl font-semibold" style={{ background: "var(--elevate-2)", color: "var(--m15-white)" }}>
                Annuler
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal terminer */}
      <Dialog open={!!showTerminer} onOpenChange={() => setShowTerminer(null)}>
        <DialogContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)" }}>Terminer le conseil de classe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Observations générales (facultatif)</Label>
              <textarea
                rows={4}
                value={observations}
                onChange={e => setObservations(e.target.value)}
                placeholder="Ex: La classe a montré de bons progrès ce trimestre..."
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
              />
            </div>
            <div className="flex items-start gap-3 p-3 rounded-xl" style={{ background: "rgba(0,201,167,0.08)", border: "1px solid rgba(0,201,167,0.2)" }}>
              <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#00C9A7" }} />
              <p className="text-sm" style={{ color: "var(--m15-white)" }}>
                Les rangs seront automatiquement recalculés pour cette classe et ce trimestre.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleTerminer}
                disabled={terminer.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold"
                style={{ background: "#00C9A7", color: "#0A1628" }}
              >
                {terminer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Terminer le conseil
              </button>
              <button onClick={() => setShowTerminer(null)} className="flex-1 py-2.5 rounded-xl font-semibold" style={{ background: "var(--elevate-2)", color: "var(--m15-white)" }}>
                Annuler
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
