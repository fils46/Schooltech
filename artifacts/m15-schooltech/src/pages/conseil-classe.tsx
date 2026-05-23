import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useListerConseils,
  usePlanifierConseil,
  useDemarrerConseil,
  useTerminerConseil,
  useEnvoyerConvocations,
  getListerConseilsQueryKey,
  useListerClasses,
  useListerAnneesScolaires,
  useListerUtilisateurs,
  type PlanifierConseilInputTrimestre,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Users, Plus, Play, CheckCircle, Loader2, Calendar, Eye, SendHorizonal,
  ExternalLink, FileText, Clock, AlignLeft, UserCheck,
} from "lucide-react";

type ConseilItem = {
  id: string;
  classe_id: string;
  classe_nom: string;
  annee_scolaire_id: string;
  trimestre: string;
  date_conseil: string;
  heure_debut?: string | null;
  heure_fin?: string | null;
  ordre_du_jour?: string | null;
  president_id: string;
  president_nom: string;
  observations_generales: string | null;
  statut: "planifie" | "en_cours" | "termine";
  convocations_envoyees: boolean;
  pv_genere: boolean;
  pv_url?: string | null;
};
type Classe       = { id: string; nom: string };
type AnneeScolaire = { id: string; libelle: string };
type Utilisateur  = { id: string; nom: string; prenoms: string; role: string };

const STATUT_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  planifie: { label: "Planifié",  color: "#F5C842", bg: "rgba(245,200,66,0.12)" },
  en_cours: { label: "En cours",  color: "#0080FF", bg: "rgba(0,128,255,0.12)" },
  termine:  { label: "Terminé",   color: "#00C9A7", bg: "rgba(0,201,167,0.12)" },
};

const ROLE_PARTICIPANT_OPTIONS = [
  { value: "professeur",      label: "Professeur" },
  { value: "delegue_eleves",  label: "Délégué(e) élèves" },
  { value: "delegue_parents", label: "Délégué(e) parents" },
  { value: "censeur",         label: "Censeur" },
  { value: "directeur",       label: "Directeur" },
];

export default function ConseilClasse() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [filterClasse, setFilterClasse] = useState("");
  const [filterAnnee, setFilterAnnee] = useState("");
  const [filterTrimestre, setFilterTrimestre] = useState("");
  const [filterStatut, setFilterStatut] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [showTerminer, setShowTerminer] = useState<{ id: string } | null>(null);
  const [observations, setObservations] = useState("");

  const [form, setForm] = useState({
    classe_id: "", annee_scolaire_id: "", trimestre: "1",
    date_conseil: "", president_id: "", heure_debut: "", heure_fin: "", ordre_du_jour: "",
  });

  type ParticipantEntry = { utilisateur_id: string; role_conseil: string };
  const [participants, setParticipants] = useState<ParticipantEntry[]>([]);

  const { data: classesData }     = useListerClasses();
  const { data: anneesData }      = useListerAnneesScolaires();
  const classes: Classe[]         = (classesData as { classes?: Classe[] })?.classes ?? [];
  const annees: AnneeScolaire[]   = (anneesData as { annees?: AnneeScolaire[] })?.annees ?? [];

  const { data: utilisateursData } = useListerUtilisateurs();
  const utilisateurs: Utilisateur[] = (utilisateursData as { utilisateurs?: Utilisateur[] })?.utilisateurs ?? [];
  const staffForParticipant = utilisateurs.filter(u => ["directeur","censeur","professeur"].includes(u.role));

  const listParams = {
    ...(filterClasse    && { classe_id: filterClasse }),
    ...(filterAnnee     && { annee_scolaire_id: filterAnnee }),
    ...(filterTrimestre && { trimestre: filterTrimestre as "1"|"2"|"3" }),
    ...(filterStatut    && { statut: filterStatut as "planifie"|"en_cours"|"termine" }),
  };

  const { data: conseilsData, isLoading } = useListerConseils(listParams);
  const conseils: ConseilItem[] = (conseilsData as { conseils?: ConseilItem[] })?.conseils ?? [];

  const planifier = usePlanifierConseil();
  const demarrer  = useDemarrerConseil();
  const terminer  = useTerminerConseil();
  const convoquer = useEnvoyerConvocations();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListerConseilsQueryKey(listParams) });

  function handlePlanifier() {
    if (!form.classe_id || !form.annee_scolaire_id || !form.date_conseil || !form.president_id) {
      toast({ title: "Tous les champs obligatoires doivent être remplis.", variant: "destructive" });
      return;
    }
    planifier.mutate(
      { data: { ...form, trimestre: form.trimestre as PlanifierConseilInputTrimestre, participants } },
      {
        onSuccess: () => {
          toast({ title: "Conseil planifié avec succès." });
          setShowCreate(false);
          setForm({ classe_id: "", annee_scolaire_id: "", trimestre: "1", date_conseil: "", president_id: "", heure_debut: "", heure_fin: "", ordre_du_jour: "" });
          setParticipants([]);
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
      onSuccess: () => {
        toast({ title: "Conseil démarré — la salle est ouverte." });
        invalidate();
        setLocation(`/conseils-classe/salle/${id}`);
      },
      onError: () => toast({ title: "Erreur.", variant: "destructive" }),
    });
  }

  function handleTerminer() {
    if (!showTerminer) return;
    terminer.mutate({ id: showTerminer.id, data: { observations_generales: observations || null } }, {
      onSuccess: () => {
        toast({ title: "Conseil terminé. Décisions synchronisées avec les bulletins." });
        setShowTerminer(null);
        setObservations("");
        invalidate();
      },
      onError: () => toast({ title: "Erreur.", variant: "destructive" }),
    });
  }

  function handleConvoquer(id: string) {
    convoquer.mutate({ id }, {
      onSuccess: (data) => {
        const d = data as { envoyes?: number };
        toast({ title: `Convocations envoyées à ${d.envoyes ?? 0} participant(s).` });
        invalidate();
      },
      onError: () => toast({ title: "Erreur lors de l'envoi.", variant: "destructive" }),
    });
  }

  function addParticipant() {
    setParticipants(prev => [...prev, { utilisateur_id: "", role_conseil: "professeur" }]);
  }

  function removeParticipant(idx: number) {
    setParticipants(prev => prev.filter((_, i) => i !== idx));
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
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Planification et gestion des conseils de classe</p>
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
        {[
          { label: "Classe", value: filterClasse, onChange: setFilterClasse, items: classes.map(c => ({ v: c.id, l: c.nom })), placeholder: "Toutes" },
          { label: "Trimestre", value: filterTrimestre, onChange: setFilterTrimestre, items: [{ v:"1",l:"T1" },{ v:"2",l:"T2" },{ v:"3",l:"T3" }], placeholder: "Tous" },
          { label: "Statut", value: filterStatut, onChange: setFilterStatut, items: [{ v:"planifie",l:"Planifié" },{ v:"en_cours",l:"En cours" },{ v:"termine",l:"Terminé" }], placeholder: "Tous" },
          { label: "Année", value: filterAnnee, onChange: setFilterAnnee, items: annees.map(a => ({ v: a.id, l: a.libelle })), placeholder: "Toutes" },
        ].map(f => (
          <div key={f.label}>
            <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>{f.label}</Label>
            <Select value={f.value} onValueChange={f.onChange}>
              <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                <SelectValue placeholder={f.placeholder} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">{f.placeholder}</SelectItem>
                {f.items.map(i => <SelectItem key={i.v} value={i.v}>{i.l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      {/* Stats */}
      {conseils.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total",     value: conseils.length,                                      color: "var(--m15-white)" },
            { label: "En cours",  value: conseils.filter(c => c.statut === "en_cours").length,  color: "#0080FF" },
            { label: "Terminés",  value: conseils.filter(c => c.statut === "termine").length,   color: "#00C9A7" },
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
        <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}</div>
      ) : conseils.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--m15-card)", border: "1px dashed var(--m15-border)" }}>
          <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
          <p style={{ color: "var(--m15-muted)" }}>Aucun conseil de classe trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {conseils.map(c => {
            const st = STATUT_CONFIG[c.statut];
            return (
              <div key={c.id} className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="font-bold" style={{ color: "var(--m15-white)" }}>{c.classe_nom}</span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(0,128,255,0.12)", color: "#0080FF" }}>T{c.trimestre}</span>
                      <span className="px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                      {c.convocations_envoyees && (
                        <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: "rgba(0,201,167,0.08)", color: "#00C9A7" }}>Convocations envoyées</span>
                      )}
                      {c.pv_genere && (
                        <span className="px-2 py-0.5 rounded-lg text-xs" style={{ background: "rgba(245,200,66,0.08)", color: "#F5C842" }}>PV généré</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <span style={{ color: "var(--m15-muted)" }}>
                        <Calendar className="w-3 h-3 inline mr-1" />{c.date_conseil}
                        {c.heure_debut && <><Clock className="w-3 h-3 inline ml-2 mr-1" />{c.heure_debut}{c.heure_fin ? `–${c.heure_fin}` : ""}</>}
                      </span>
                      <span style={{ color: "var(--m15-muted)" }}>
                        <UserCheck className="w-3 h-3 inline mr-1" />{c.president_nom}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Voir résultats */}
                    {(c.statut === "termine" || c.statut === "en_cours") && (
                      <button
                        onClick={() => setLocation(`/conseils-classe/resultats/${c.id}`)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
                        style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}
                      >
                        <FileText className="w-3.5 h-3.5" /> Résultats
                      </button>
                    )}

                    {canAction && c.statut === "planifie" && !c.convocations_envoyees && (
                      <button
                        onClick={() => handleConvoquer(c.id)}
                        disabled={convoquer.isPending}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium"
                        style={{ background: "rgba(245,200,66,0.1)", border: "1px solid rgba(245,200,66,0.2)", color: "#F5C842" }}
                      >
                        {convoquer.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <SendHorizonal className="w-3.5 h-3.5" />}
                        Convoquer
                      </button>
                    )}

                    {canAction && c.statut === "planifie" && (
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
                        onClick={() => setLocation(`/conseils-classe/salle/${c.id}`)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: "rgba(0,128,255,0.15)", border: "1px solid rgba(0,128,255,0.4)", color: "#0080FF" }}
                      >
                        <ExternalLink className="w-4 h-4" /> Entrer dans la salle
                      </button>
                    )}

                    {canAction && c.statut === "en_cours" && (
                      <button
                        onClick={() => setShowTerminer({ id: c.id })}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                        style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.25)", color: "#00C9A7" }}
                      >
                        <CheckCircle className="w-4 h-4" /> Terminer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal — Planifier */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
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
                  <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}</SelectContent>
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
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Année scolaire *</Label>
                <Select value={form.annee_scolaire_id} onValueChange={v => setForm(p => ({ ...p, annee_scolaire_id: v }))}>
                  <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>{annees.map(a => <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Date *</Label>
                <Input type="date" value={form.date_conseil} onChange={e => setForm(p => ({ ...p, date_conseil: e.target.value }))}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Heure début</Label>
                <Input type="time" value={form.heure_debut} onChange={e => setForm(p => ({ ...p, heure_debut: e.target.value }))}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Heure fin</Label>
                <Input type="time" value={form.heure_fin} onChange={e => setForm(p => ({ ...p, heure_fin: e.target.value }))}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Président(e) *</Label>
              <Select value={form.president_id} onValueChange={v => setForm(p => ({ ...p, president_id: v }))}>
                <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {utilisateurs.filter(u => ["directeur","censeur","professeur"].includes(u.role)).map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.prenoms} {u.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Ordre du jour</Label>
              <Textarea value={form.ordre_du_jour} onChange={e => setForm(p => ({ ...p, ordre_du_jour: e.target.value }))} rows={2} placeholder="Points à aborder..."
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>

            {/* Participants */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs" style={{ color: "var(--m15-muted)" }}>
                  <AlignLeft className="w-3 h-3 inline mr-1" />Participants invités
                </Label>
                <button onClick={addParticipant} className="text-xs px-2 py-1 rounded-lg flex items-center gap-1"
                  style={{ background: "var(--elevate-2)", color: "#00C9A7" }}>
                  <Plus className="w-3 h-3" /> Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {participants.map((p, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                    <Select value={p.utilisateur_id} onValueChange={v => setParticipants(prev => prev.map((pp, i) => i === idx ? { ...pp, utilisateur_id: v } : pp))}>
                      <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", fontSize: "0.8rem" }}>
                        <SelectValue placeholder="Personne" />
                      </SelectTrigger>
                      <SelectContent>
                        {staffForParticipant.map(u => <SelectItem key={u.id} value={u.id}>{u.prenoms} {u.nom}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={p.role_conseil} onValueChange={v => setParticipants(prev => prev.map((pp, i) => i === idx ? { ...pp, role_conseil: v } : pp))}>
                      <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", fontSize: "0.8rem", width: "140px" }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_PARTICIPANT_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <button onClick={() => removeParticipant(idx)} className="w-7 h-7 flex items-center justify-center rounded-lg text-red-400 hover:bg-red-500/10">✕</button>
                  </div>
                ))}
                {participants.length === 0 && (
                  <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Aucun participant ajouté. Vous pourrez en ajouter après la création.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>
                Annuler
              </button>
              <button onClick={handlePlanifier} disabled={planifier.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold" style={{ background: "#00C9A7", color: "#0A1628" }}>
                {planifier.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                Planifier
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal — Terminer */}
      <Dialog open={!!showTerminer} onOpenChange={() => setShowTerminer(null)}>
        <DialogContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)" }}>Terminer le conseil de classe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
              Les décisions seront synchronisées avec les bulletins de la classe.
            </p>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Observations générales</Label>
              <Textarea value={observations} onChange={e => setObservations(e.target.value)} rows={4} placeholder="Observations générales du conseil..."
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowTerminer(null)} className="px-4 py-2 rounded-xl text-sm" style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>
                Annuler
              </button>
              <button onClick={handleTerminer} disabled={terminer.isPending}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold" style={{ background: "#00C9A7", color: "#0A1628" }}>
                {terminer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Confirmer
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
