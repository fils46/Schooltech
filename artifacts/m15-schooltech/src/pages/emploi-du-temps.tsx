import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import {
  useListerCreneaux, useCreerCreneau, useModifierCreneau, useSupprimerCreneau,
  useListerSalles, useCreerSalle, useModifierSalle, useDesactiverSalle,
  useGetEmploiClasse, getGetEmploiClasseQueryKey,
  useGetEmploiProfesseur, getGetEmploiProfesseurQueryKey,
  useVerifierConflits, getVerifierConflitsQueryKey,
  useCreerCours, useModifierCours, useSupprimerCours, useVerifierDisponibilite,
  useListerClasses,
  useListerUtilisateurs,
  useListerAnneesScolaires,
  CoursInputJour,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar, Clock, Building2, AlertTriangle, Plus, Pencil, Trash2,
  X, ChevronDown, CheckCircle, RefreshCw, Copy, Eye, EyeOff,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────── */
const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
type Jour = typeof JOURS[number];
const JOURS_LABELS: Record<Jour, string> = {
  lundi: "Lundi", mardi: "Mardi", mercredi: "Mercredi",
  jeudi: "Jeudi", vendredi: "Vendredi", samedi: "Samedi",
};

const COULEURS_MATIERES = [
  "#00C9A7", "#0080FF", "#F5C842", "#FF4D6D",
  "#9B59B6", "#E67E22", "#1ABC9C", "#3498DB",
];
function couleurMatiere(matiere: string) {
  let h = 0;
  for (let i = 0; i < matiere.length; i++) h = (h * 31 + matiere.charCodeAt(i)) & 0xffffff;
  return COULEURS_MATIERES[h % COULEURS_MATIERES.length];
}

/* ─── Composant Select custom ─────────────────────────────── */
function Select({
  value, onChange, options, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-full px-3 py-2.5 pr-9 rounded-xl text-sm appearance-none outline-none transition-all"
        style={{
          background: "var(--m15-card)",
          border: "1px solid var(--m15-border)",
          color: value ? "var(--m15-white)" : "var(--m15-muted)",
          fontFamily: "'DM Sans', sans-serif",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value} style={{ background: "var(--m15-card)", color: "#fff" }}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--m15-muted)" }} />
    </div>
  );
}

/* ─── Modal de cours ─────────────────────────────────────── */
interface CoursFormData {
  classe_id: string;
  professeur_id: string;
  salle_id: string;
  matiere: string;
  jour: string;
  creneau_id: string;
  annee_scolaire_id: string;
  couleur: string;
}

function CoursModal({
  open,
  onClose,
  coursToEdit,
  defaultJour,
  defaultCreneauId,
  defaultClasseId,
  anneeId,
  etablissementId,
}: {
  open: boolean;
  onClose: () => void;
  coursToEdit?: Record<string, string> | null;
  defaultJour?: string;
  defaultCreneauId?: string;
  defaultClasseId?: string;
  anneeId: string;
  etablissementId: string;
}) {
  const { toast } = useToast();
  const isEdit = !!coursToEdit;

  const [form, setForm] = useState<CoursFormData>({
    classe_id: defaultClasseId || "",
    professeur_id: "",
    salle_id: "",
    matiere: "",
    jour: defaultJour || "",
    creneau_id: defaultCreneauId || "",
    annee_scolaire_id: anneeId,
    couleur: "",
  });
  const [conflitsRT, setConflitsRT] = useState<{ type: string; message: string }[]>([]);

  useEffect(() => {
    if (coursToEdit) {
      setForm({
        classe_id: coursToEdit.classe_id || "",
        professeur_id: coursToEdit.professeur_id || "",
        salle_id: coursToEdit.salle_id || "",
        matiere: coursToEdit.matiere || "",
        jour: coursToEdit.jour || "",
        creneau_id: coursToEdit.creneau_id || "",
        annee_scolaire_id: anneeId,
        couleur: coursToEdit.couleur || "",
      });
    } else {
      setForm(f => ({
        ...f,
        classe_id: defaultClasseId || "",
        jour: defaultJour || "",
        creneau_id: defaultCreneauId || "",
        annee_scolaire_id: anneeId,
      }));
    }
    setConflitsRT([]);
  }, [open, coursToEdit, defaultJour, defaultCreneauId, defaultClasseId, anneeId]);

  const { data: creneauxData } = useListerCreneaux({ etablissement_id: etablissementId });
  const { data: sallesData } = useListerSalles({ etablissement_id: etablissementId });
  const { data: classesData } = useListerClasses();
  const { data: profsData } = useListerUtilisateurs({ role: "professeur", etablissement_id: etablissementId });

  const creneaux = (creneauxData as unknown as { creneaux?: Record<string, unknown>[] })?.creneaux ?? [];
  const salles = (sallesData as unknown as { salles?: Record<string, unknown>[] })?.salles ?? [];
  const classes = (classesData as unknown as { classes?: { id: string; nom: string }[] })?.classes ?? [];
  const profs = ((profsData ?? []) as unknown as { id: string; prenoms: string; nom: string }[]);

  const verifier = useVerifierDisponibilite();
  const creerCours = useCreerCours();
  const modifierCours = useModifierCours();

  function setField(k: keyof CoursFormData, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  useEffect(() => {
    if (!form.classe_id || !form.professeur_id || !form.jour || !form.creneau_id || !form.annee_scolaire_id) {
      setConflitsRT([]);
      return;
    }
    verifier.mutate(
      {
        data: {
          classe_id: form.classe_id,
          professeur_id: form.professeur_id,
          salle_id: form.salle_id || undefined,
          jour: form.jour,
          creneau_id: form.creneau_id,
          annee_scolaire_id: form.annee_scolaire_id,
          exclude_id: coursToEdit?.id,
        },
      },
      {
        onSuccess: (res: unknown) => {
          const r = res as { disponible: boolean; conflits: { type: string; message: string }[] };
          setConflitsRT(r.conflits || []);
        },
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.classe_id, form.professeur_id, form.salle_id, form.jour, form.creneau_id]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (conflitsRT.length > 0) {
      toast({ title: "Conflit détecté", description: conflitsRT[0]?.message, variant: "destructive" });
      return;
    }

    const payload = {
      ...form,
      jour: form.jour as CoursInputJour,
      couleur: form.couleur || couleurMatiere(form.matiere),
    };

    if (isEdit) {
      modifierCours.mutate(
        { id: coursToEdit!.id, data: payload },
        {
          onSuccess: () => { toast({ title: "Cours modifié !" }); onClose(); },
          onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
            toast({ title: "Erreur", description: msg, variant: "destructive" });
          },
        }
      );
    } else {
      creerCours.mutate(
        { data: payload },
        {
          onSuccess: () => { toast({ title: "Cours créé !" }); onClose(); },
          onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
            toast({ title: "Erreur", description: msg, variant: "destructive" });
          },
        }
      );
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--m15-border)" }}>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            {isEdit ? "Modifier le cours" : "Ajouter un cours"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-2 transition-all"
            style={{ color: "var(--m15-muted)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-white)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-muted)"; }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Classe */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--m15-muted)" }}>Classe *</label>
            <Select
              value={form.classe_id}
              onChange={v => setField("classe_id", v)}
              placeholder="Sélectionner une classe"
              options={classes.map((c: Record<string, string>) => ({ value: c.id, label: c.nom }))}
            />
          </div>

          {/* Matière + Professeur */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--m15-muted)" }}>Matière *</label>
              <input
                type="text"
                value={form.matiere}
                onChange={e => setField("matiere", e.target.value)}
                placeholder="Ex: Mathématiques"
                required
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  background: "var(--m15-card)",
                  border: "1px solid var(--m15-border)",
                  color: "var(--m15-white)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--m15-muted)" }}>Professeur *</label>
              <Select
                value={form.professeur_id}
                onChange={v => setField("professeur_id", v)}
                placeholder="Sélectionner"
                options={profs.map((p) => ({
                  value: p.id,
                  label: `${p.prenoms} ${p.nom}`,
                }))}
              />
            </div>
          </div>

          {/* Jour + Créneau */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--m15-muted)" }}>Jour *</label>
              <Select
                value={form.jour}
                onChange={v => setField("jour", v)}
                placeholder="Sélectionner"
                options={JOURS.map(j => ({ value: j, label: JOURS_LABELS[j] }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--m15-muted)" }}>Créneau *</label>
              <Select
                value={form.creneau_id}
                onChange={v => setField("creneau_id", v)}
                placeholder="Sélectionner"
                options={creneaux.map((c: Record<string, string | number>) => ({
                  value: String(c.id),
                  label: String(c.libelle),
                }))}
              />
            </div>
          </div>

          {/* Salle */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--m15-muted)" }}>Salle (optionnel)</label>
            <Select
              value={form.salle_id}
              onChange={v => setField("salle_id", v)}
              placeholder="Aucune salle"
              options={salles
                .filter((s: Record<string, boolean>) => s.actif)
                .map((s: Record<string, string>) => ({ value: s.id, label: s.nom }))}
            />
          </div>

          {/* Alertes conflits temps réel */}
          {conflitsRT.length > 0 && (
            <div className="rounded-xl p-3 space-y-1" style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }}>
              {conflitsRT.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm" style={{ color: "#FF4D6D" }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{c.message}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
              Annuler
            </button>
            <button
              type="submit"
              disabled={conflitsRT.length > 0 || creerCours.isPending || modifierCours.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: conflitsRT.length > 0 ? "rgba(255,77,109,0.2)" : "linear-gradient(135deg, #00C9A7, #0080FF)",
                color: "#fff",
                opacity: conflitsRT.length > 0 ? 0.6 : 1,
                cursor: conflitsRT.length > 0 ? "not-allowed" : "pointer",
              }}>
              {creerCours.isPending || modifierCours.isPending ? "..." : isEdit ? "Modifier" : "Ajouter le cours"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Grille hebdomadaire ─────────────────────────────────── */
function GrilleHebdomadaire({
  grille,
  creneaux,
  onCellClick,
  onCourseClick,
  canEdit,
}: {
  grille: Record<Jour, Record<string, unknown>[]>;
  creneaux: Record<string, unknown>[];
  onCellClick: (jour: Jour, creneauId: string) => void;
  onCourseClick: (cours: Record<string, string>) => void;
  canEdit: boolean;
}) {
  if (creneaux.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="w-12 h-12 mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
        <p className="font-medium" style={{ color: "var(--m15-muted)" }}>Aucun créneau horaire configuré</p>
        <p className="text-sm mt-1" style={{ color: "var(--m15-muted)", opacity: 0.6 }}>
          Allez dans l'onglet "Créneaux" pour en créer
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid rounded-xl overflow-hidden mb-2"
          style={{ gridTemplateColumns: `120px repeat(6, 1fr)`, gap: "1px", background: "var(--m15-border)" }}>
          <div className="py-3 px-3 text-xs font-semibold" style={{ background: "var(--m15-card)", color: "var(--m15-muted)" }}>
            Créneau
          </div>
          {JOURS.map(jour => (
            <div key={jour} className="py-3 text-center text-sm font-bold"
              style={{ background: "var(--m15-card)", color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              {JOURS_LABELS[jour]}
            </div>
          ))}
        </div>

        {/* Lignes créneaux */}
        <div className="space-y-1">
          {creneaux.map((creneau: Record<string, unknown>) => (
            <div key={String(creneau.id)} className="grid"
              style={{ gridTemplateColumns: `120px repeat(6, 1fr)`, gap: "4px" }}>
              {/* Label créneau */}
              <div className="flex flex-col justify-center px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: "var(--m15-card)", color: "var(--m15-muted)", minHeight: "80px" }}>
                <span className="font-bold text-sm" style={{ color: "var(--m15-white)" }}>{String(creneau.libelle)}</span>
                <span style={{ opacity: 0.7 }}>{String(creneau.heure_debut)} - {String(creneau.heure_fin)}</span>
              </div>

              {/* Cellules par jour */}
              {JOURS.map(jour => {
                const cours = grille[jour]?.find(
                  (c: Record<string, unknown>) => c.creneau_id === creneau.id
                ) as Record<string, string> | undefined;
                const couleur = cours?.couleur || (cours?.matiere ? couleurMatiere(cours.matiere) : "#00C9A7");

                return (
                  <div
                    key={jour}
                    className="rounded-xl transition-all overflow-hidden"
                    style={{
                      minHeight: "80px",
                      background: cours ? `${couleur}14` : "var(--m15-card)",
                      border: cours ? `1px solid ${couleur}40` : "1px solid var(--m15-border)",
                      cursor: canEdit ? "pointer" : cours ? "pointer" : "default",
                    }}
                    onClick={() => {
                      if (cours) {
                        onCourseClick(cours);
                      } else if (canEdit) {
                        onCellClick(jour, String(creneau.id));
                      }
                    }}
                    onMouseEnter={e => {
                      if (cours || canEdit)
                        (e.currentTarget as HTMLElement).style.opacity = "0.85";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.opacity = "1";
                    }}
                  >
                    {cours ? (
                      <div className="h-full p-2 flex flex-col gap-1">
                        <span className="text-xs font-bold truncate" style={{ color: couleur }}>
                          {cours.matiere}
                        </span>
                        <span className="text-xs truncate" style={{ color: "var(--m15-white)", opacity: 0.9 }}>
                          {cours.professeur_nom}
                        </span>
                        {cours.salle_nom && (
                          <span className="text-xs truncate" style={{ color: "var(--m15-muted)" }}>
                            {cours.salle_nom}
                          </span>
                        )}
                      </div>
                    ) : (
                      canEdit && (
                        <div className="h-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                          <Plus className="w-4 h-4" style={{ color: "#00C9A7" }} />
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Onglet Emploi du temps ─────────────────────────────── */
function TabEmploi({
  etablissementId,
  canEdit,
}: {
  etablissementId: string;
  canEdit: boolean;
}) {
  const { user } = useAuth();
  const [vue, setVue] = useState<"classe" | "professeur">("classe");
  const [classeId, setClasseId] = useState("");
  const [profId, setProfId] = useState("");
  const [anneeId, setAnneeId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [coursToEdit, setCoursToEdit] = useState<Record<string, string> | null>(null);
  const [defaultJour, setDefaultJour] = useState<string>("");
  const [defaultCreneauId, setDefaultCreneauId] = useState<string>("");

  const { data: classesData } = useListerClasses();
  const { data: profsData } = useListerUtilisateurs({ role: "professeur", etablissement_id: etablissementId });
  const { data: anneesData } = useListerAnneesScolaires();
  const { data: creneauxData } = useListerCreneaux({ etablissement_id: etablissementId });

  const classes = (classesData as unknown as { classes?: { id: string; nom: string }[] })?.classes ?? [];
  const profs = ((profsData ?? []) as unknown as { id: string; prenoms: string; nom: string }[]);
  const annees = (anneesData as unknown as { annees?: Record<string, string>[] })?.annees ?? [];
  const creneaux = (creneauxData as unknown as { creneaux?: Record<string, unknown>[] })?.creneaux ?? [];

  // Pré-sélectionner l'année active
  useEffect(() => {
    if (!anneeId && annees.length > 0) {
      const active = annees.find((a: Record<string, unknown>) => a.est_active);
      setAnneeId(String((active ?? annees[0])?.id ?? ""));
    }
  }, [annees, anneeId]);

  // Pré-sélectionner la classe ou le prof si rôle limité
  useEffect(() => {
    if (!classeId && classes.length > 0) {
      if (user?.role === "professeur") {
        setVue("professeur");
        setProfId(user.id || "");
      } else {
        setClasseId(String((classes[0] as Record<string, string>)?.id ?? ""));
      }
    }
  }, [classes, user, classeId]);

  const emploiClasse = useGetEmploiClasse(classeId, { annee_scolaire_id: anneeId }, {
    query: { queryKey: getGetEmploiClasseQueryKey(classeId, { annee_scolaire_id: anneeId }), enabled: vue === "classe" && !!classeId && !!anneeId },
  });
  const emploiProf = useGetEmploiProfesseur(profId, { annee_scolaire_id: anneeId }, {
    query: { queryKey: getGetEmploiProfesseurQueryKey(profId, { annee_scolaire_id: anneeId }), enabled: vue === "professeur" && !!profId && !!anneeId },
  });

  const supprimerCours = useSupprimerCours();
  const { toast } = useToast();

  const emploiData = vue === "classe" ? emploiClasse.data : emploiProf.data;
  const isLoading = vue === "classe" ? emploiClasse.isLoading : emploiProf.isLoading;

  type GrilleShape = { grille?: Record<Jour, Record<string, unknown>[]> };
  const grilleData = (emploiData as unknown as GrilleShape)?.grille ?? {
    lundi: [], mardi: [], mercredi: [], jeudi: [], vendredi: [], samedi: [],
  };

  const tousLesCours = (JOURS as readonly string[]).flatMap(j => grilleData[j as Jour] ?? []);
  const estPublie = tousLesCours.length > 0 && tousLesCours.every(c => (c as Record<string, unknown>).publie === true);

  const publierMutation = useMutation({
    mutationFn: async ({ publie }: { publie: boolean }) => {
      const base = (import.meta.env.BASE_URL as string).replace(/\/$/, "");
      const token = localStorage.getItem("m15_token");
      const res = await fetch(`${base}/api/emploi-du-temps/classe/${classeId}/publier`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
        body: JSON.stringify({ annee_scolaire_id: anneeId, publie }),
      });
      if (!res.ok) throw new Error("Erreur de publication");
      return res.json();
    },
    onSuccess: (_data, { publie }) => {
      toast({ title: publie ? "Emploi du temps publié !" : "Emploi du temps dépublié." });
      void emploiClasse.refetch();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible de modifier la publication.", variant: "destructive" });
    },
  });

  function handleCellClick(jour: Jour, creneauId: string) {
    setCoursToEdit(null);
    setDefaultJour(jour);
    setDefaultCreneauId(creneauId);
    setModalOpen(true);
  }

  function handleCourseClick(cours: Record<string, string>) {
    setCoursToEdit(cours);
    setDefaultJour("");
    setDefaultCreneauId("");
    setModalOpen(true);
  }

  function handleDeleteCours() {
    if (!coursToEdit?.id) return;
    supprimerCours.mutate(
      { id: coursToEdit.id },
      {
        onSuccess: () => {
          toast({ title: "Cours supprimé." });
          setModalOpen(false);
          void (vue === "classe" ? emploiClasse.refetch() : emploiProf.refetch());
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
          toast({ title: "Erreur", description: msg, variant: "destructive" });
        },
      }
    );
  }

  return (
    <div className="space-y-5">
      {/* Filtres */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Toggle vue */}
        {(user?.role === "dev" || user?.role === "directeur" || user?.role === "censeur") && (
          <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid var(--m15-border)" }}>
            {(["classe", "professeur"] as const).map(v => (
              <button key={v} onClick={() => setVue(v)}
                className="px-4 py-2 text-sm font-medium transition-all"
                style={{
                  background: vue === v ? "#00C9A7" : "var(--m15-card)",
                  color: vue === v ? "#fff" : "var(--m15-muted)",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                {v === "classe" ? "Par classe" : "Par professeur"}
              </button>
            ))}
          </div>
        )}

        {/* Sélecteur classe/prof */}
        {vue === "classe" ? (
          <div className="w-52">
            <Select
              value={classeId}
              onChange={setClasseId}
              placeholder="Choisir une classe"
              options={classes.map((c: Record<string, string>) => ({ value: c.id, label: c.nom }))}
            />
          </div>
        ) : (
          <div className="w-56">
            <Select
              value={profId}
              onChange={setProfId}
              placeholder="Choisir un professeur"
              options={(profs as unknown as { id: string; prenoms: string; nom: string }[]).map((p) => ({
                value: p.id,
                label: `${p.prenoms} ${p.nom}`,
              }))}
              disabled={user?.role === "professeur"}
            />
          </div>
        )}

        {/* Sélecteur année */}
        <div className="w-44">
          <Select
            value={anneeId}
            onChange={setAnneeId}
            placeholder="Année scolaire"
            options={annees.map((a: Record<string, string>) => ({ value: a.id, label: a.libelle }))}
          />
        </div>

        {/* Rafraîchir */}
        <button
          onClick={() => void (vue === "classe" ? emploiClasse.refetch() : emploiProf.refetch())}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>

        {/* Bouton publication (censeur / directeur / dev, vue classe uniquement) */}
        {canEdit && vue === "classe" && classeId && anneeId && (
          estPublie ? (
            <button
              onClick={() => publierMutation.mutate({ publie: false })}
              disabled={publierMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{ background: "rgba(0,201,167,0.1)", border: "1px solid rgba(0,201,167,0.3)", color: "#00C9A7" }}>
              <CheckCircle className="w-4 h-4" />
              Publié — Dépublier
            </button>
          ) : (
            <button
              onClick={() => publierMutation.mutate({ publie: true })}
              disabled={publierMutation.isPending || tousLesCours.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: tousLesCours.length === 0 ? "var(--m15-card)" : "linear-gradient(135deg, #00C9A7, #0080FF)",
                border: tousLesCours.length === 0 ? "1px solid var(--m15-border)" : "none",
                color: tousLesCours.length === 0 ? "var(--m15-muted)" : "#fff",
                opacity: publierMutation.isPending ? 0.7 : 1,
              }}>
              <Eye className="w-4 h-4" />
              {publierMutation.isPending ? "Publication..." : "Publier l'EDT"}
            </button>
          )
        )}
      </div>

      {/* Grille */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "#00C9A7" }} />
        </div>
      ) : (
        <GrilleHebdomadaire
          grille={grilleData as Record<Jour, Record<string, unknown>[]>}
          creneaux={creneaux as Record<string, unknown>[]}
          onCellClick={handleCellClick}
          onCourseClick={handleCourseClick}
          canEdit={canEdit}
        />
      )}

      {/* Modal cours */}
      {modalOpen && (
        <>
          <CoursModal
            open={modalOpen}
            onClose={() => {
              setModalOpen(false);
              void (vue === "classe" ? emploiClasse.refetch() : emploiProf.refetch());
            }}
            coursToEdit={coursToEdit}
            defaultJour={defaultJour}
            defaultCreneauId={defaultCreneauId}
            defaultClasseId={vue === "classe" ? classeId : ""}
            anneeId={anneeId}
            etablissementId={etablissementId}
          />
          {/* Bouton supprimer si édition */}
          {coursToEdit && canEdit && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60]">
              <button
                onClick={handleDeleteCours}
                disabled={supprimerCours.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "rgba(255,77,109,0.15)", border: "1px solid rgba(255,77,109,0.3)", color: "#FF4D6D" }}>
                <Trash2 className="w-4 h-4" />
                Supprimer ce cours
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Onglet Créneaux ─────────────────────────────────────── */
/* ─── Modal de confirmation générique ───────────────────── */
function ModalConfirm({
  title, description, labelConfirm = "Confirmer", danger = false,
  onConfirm, onClose, loading = false,
}: {
  title: string; description?: string; labelConfirm?: string; danger?: boolean;
  onConfirm: () => void; onClose: () => void; loading?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className="w-full max-w-sm rounded-2xl p-6 space-y-4"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: danger ? "rgba(239,68,68,0.12)" : "rgba(251,191,36,0.12)" }}>
            <AlertTriangle className="w-5 h-5" style={{ color: danger ? "#ef4444" : "#fbbf24" }} />
          </div>
          <div>
            <h3 className="font-bold text-base" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              {title}
            </h3>
            {description && (
              <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>{description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)" }}>
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: danger ? "#ef4444" : "#f59e0b", color: "#fff", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Traitement..." : labelConfirm}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabCreneaux({ etablissementId }: { etablissementId: string }) {
  const { toast } = useToast();
  const { data: raw, refetch } = useListerCreneaux({ etablissement_id: etablissementId });
  const creneaux = (raw as unknown as { creneaux?: Record<string, unknown>[] })?.creneaux ?? [];

  const creerMut = useCreerCreneau();
  const modifierMut = useModifierCreneau();
  const supprimerMut = useSupprimerCreneau();

  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ heure_debut: "", heure_fin: "", libelle: "", ordre: "" });
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function resetForm() {
    setForm({ heure_debut: "", heure_fin: "", libelle: "", ordre: "" });
    setEditItem(null);
    setShowForm(false);
  }

  function handleEdit(c: Record<string, unknown>) {
    setEditItem(c);
    setForm({
      heure_debut: String(c.heure_debut ?? ""),
      heure_fin: String(c.heure_fin ?? ""),
      libelle: String(c.libelle ?? ""),
      ordre: String(c.ordre ?? ""),
    });
    setShowForm(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      ...form,
      ordre: form.ordre ? parseInt(form.ordre) : undefined,
      etablissement_id: etablissementId,
    };

    if (editItem) {
      modifierMut.mutate(
        { id: String(editItem.id), data: payload },
        {
          onSuccess: () => { toast({ title: "Créneau modifié." }); resetForm(); void refetch(); },
          onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
            toast({ title: "Erreur", description: msg, variant: "destructive" });
          },
        }
      );
    } else {
      creerMut.mutate(
        { data: payload },
        {
          onSuccess: () => { toast({ title: "Créneau créé !" }); resetForm(); void refetch(); },
          onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
            toast({ title: "Erreur", description: msg, variant: "destructive" });
          },
        }
      );
    }
  }

  function handleDelete(id: string) {
    setConfirmId(id);
  }

  function confirmDelete() {
    if (!confirmId) return;
    supprimerMut.mutate(
      { id: confirmId },
      {
        onSuccess: () => { toast({ title: "Créneau supprimé." }); setConfirmId(null); void refetch(); },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
          toast({ title: "Erreur", description: msg, variant: "destructive" });
          setConfirmId(null);
        },
      }
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Créneaux horaires
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            Définissez les plages horaires de votre établissement
          </p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditItem(null); setForm({ heure_debut: "", heure_fin: "", libelle: "", ordre: "" }); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
          <Plus className="w-4 h-4" />
          Nouveau créneau
        </button>
      </div>

      {/* Formulaire inline */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-5 rounded-2xl space-y-4"
          style={{ background: "var(--m15-card)", border: "1px solid rgba(0,201,167,0.2)" }}>
          <h4 className="font-semibold" style={{ color: "var(--m15-white)" }}>
            {editItem ? "Modifier le créneau" : "Nouveau créneau"}
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--m15-muted)" }}>Heure début *</label>
              <input type="time" required value={form.heure_debut} onChange={e => setForm(f => ({ ...f, heure_debut: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--m15-muted)" }}>Heure fin *</label>
              <input type="time" required value={form.heure_fin} onChange={e => setForm(f => ({ ...f, heure_fin: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--m15-muted)" }}>Libellé *</label>
              <input type="text" required value={form.libelle} onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
                placeholder="Ex: 7h00 - 9h00"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--m15-muted)" }}>Ordre</label>
              <input type="number" value={form.ordre} onChange={e => setForm(f => ({ ...f, ordre: e.target.value }))}
                placeholder="Auto"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={resetForm}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
              Annuler
            </button>
            <button type="submit" className="px-5 py-2 rounded-xl text-sm font-bold"
              style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
              {creerMut.isPending || modifierMut.isPending ? "..." : editItem ? "Enregistrer" : "Créer"}
            </button>
          </div>
        </form>
      )}

      {/* Barre visuelle + liste */}
      <div className="space-y-2">
        {creneaux.length === 0 ? (
          <div className="text-center py-10" style={{ color: "var(--m15-muted)" }}>
            Aucun créneau configuré. Créez le premier !
          </div>
        ) : (
          creneaux.map((c: Record<string, unknown>) => (
            <div key={String(c.id)}
              className="flex items-center gap-4 p-4 rounded-xl transition-all"
              style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              {/* Barre colorée */}
              <div className="w-1.5 h-12 rounded-full flex-shrink-0" style={{ background: "linear-gradient(180deg, #00C9A7, #0080FF)" }} />
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-sm" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                    {String(c.libelle)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>
                    Ordre {String(c.ordre)}
                  </span>
                </div>
                <div className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
                  {String(c.heure_debut)} → {String(c.heure_fin)}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEdit(c)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                  style={{ background: "rgba(0,128,255,0.08)", color: "#0080FF", border: "1px solid rgba(0,128,255,0.2)" }}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(String(c.id))}
                  className="w-8 h-8 flex items-center justify-center rounded-xl transition-all"
                  style={{ background: "rgba(255,77,109,0.08)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.2)" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {confirmId && (
        <ModalConfirm
          title="Supprimer ce créneau ?"
          description="Cette action est irréversible. Le créneau sera définitivement supprimé."
          labelConfirm="Supprimer"
          danger
          loading={supprimerMut.isPending}
          onConfirm={confirmDelete}
          onClose={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

/* ─── Onglet Salles ───────────────────────────────────────── */
const TYPE_LABELS: Record<string, string> = {
  classe: "Classe", laboratoire: "Labo", salle_info: "Informatique",
  gymnase: "Gymnase", autre: "Autre",
};
const TYPE_COLORS: Record<string, string> = {
  classe: "#00C9A7", laboratoire: "#0080FF", salle_info: "#F5C842",
  gymnase: "#9B59B6", autre: "#8B9DC3",
};

function TabSalles({ etablissementId, canEdit }: { etablissementId: string; canEdit: boolean }) {
  const { toast } = useToast();
  const { data: raw, refetch } = useListerSalles({ etablissement_id: etablissementId });
  const salles = (raw as unknown as { salles?: Record<string, unknown>[] })?.salles ?? [];

  const creerMut = useCreerSalle();
  const modifierMut = useModifierSalle();
  const desactiverMut = useDesactiverSalle();

  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState({ nom: "", capacite: "", type: "classe" });
  const [confirmDesactiverId, setConfirmDesactiverId] = useState<string | null>(null);

  function resetForm() {
    setForm({ nom: "", capacite: "", type: "classe" });
    setEditItem(null);
    setShowModal(false);
  }

  function handleEdit(s: Record<string, unknown>) {
    setEditItem(s);
    setForm({
      nom: String(s.nom ?? ""),
      capacite: s.capacite != null ? String(s.capacite) : "",
      type: String(s.type ?? "classe"),
    });
    setShowModal(true);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      nom: form.nom,
      capacite: form.capacite ? parseInt(form.capacite) : undefined,
      type: form.type as "classe" | "laboratoire" | "salle_info" | "gymnase" | "autre",
      etablissement_id: etablissementId,
    };

    if (editItem) {
      modifierMut.mutate(
        { id: String(editItem.id), data: payload },
        {
          onSuccess: () => { toast({ title: "Salle modifiée." }); resetForm(); void refetch(); },
          onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
            toast({ title: "Erreur", description: msg, variant: "destructive" });
          },
        }
      );
    } else {
      creerMut.mutate(
        { data: payload },
        {
          onSuccess: () => { toast({ title: "Salle créée !" }); resetForm(); void refetch(); },
          onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
            toast({ title: "Erreur", description: msg, variant: "destructive" });
          },
        }
      );
    }
  }

  function handleDesactiver(id: string) {
    setConfirmDesactiverId(id);
  }

  function confirmDesactiver() {
    if (!confirmDesactiverId) return;
    desactiverMut.mutate(
      { id: confirmDesactiverId },
      {
        onSuccess: () => { toast({ title: "Salle désactivée." }); setConfirmDesactiverId(null); void refetch(); },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
          toast({ title: "Erreur", description: msg, variant: "destructive" });
          setConfirmDesactiverId(null);
        },
      }
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Salles
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            Gérez les salles et espaces de votre établissement
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setShowModal(true); setEditItem(null); setForm({ nom: "", capacite: "", type: "classe" }); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
            <Plus className="w-4 h-4" />
            Nouvelle salle
          </button>
        )}
      </div>

      {/* Grille de cartes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {salles.length === 0 ? (
          <div className="col-span-3 text-center py-10" style={{ color: "var(--m15-muted)" }}>
            Aucune salle configurée.
          </div>
        ) : (
          salles.map((s: Record<string, unknown>) => {
            const typeColor = TYPE_COLORS[String(s.type)] || "#8B9DC3";
            return (
              <div key={String(s.id)}
                className="p-4 rounded-2xl relative"
                style={{
                  background: "var(--m15-card)",
                  border: "1px solid var(--m15-border)",
                  opacity: s.actif ? 1 : 0.5,
                }}>
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${typeColor}18`, border: `1px solid ${typeColor}30` }}>
                    <Building2 className="w-5 h-5" style={{ color: typeColor }} />
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${typeColor}18`, color: typeColor }}>
                    {TYPE_LABELS[String(s.type)] || String(s.type)}
                  </span>
                </div>
                <h4 className="font-bold text-base" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                  {String(s.nom)}
                </h4>
                {s.capacite != null && (
                  <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
                    Capacité : {String(s.capacite)} places
                  </p>
                )}
                {!s.actif as boolean && (
                  <span className="mt-2 inline-block text-xs px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(255,77,109,0.1)", color: "#FF4D6D" }}>
                    Désactivée
                  </span>
                )}

                {canEdit && Boolean(s.actif) && (
                  <div className="flex gap-2 mt-4 pt-3" style={{ borderTop: "1px solid var(--m15-border)" }}>
                    <button onClick={() => handleEdit(s)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: "rgba(0,128,255,0.08)", color: "#0080FF", border: "1px solid rgba(0,128,255,0.2)" }}>
                      <Pencil className="w-3.5 h-3.5" />
                      Modifier
                    </button>
                    <button onClick={() => handleDesactiver(String(s.id))}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-medium"
                      style={{ background: "rgba(255,77,109,0.08)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.2)" }}>
                      <X className="w-3.5 h-3.5" />
                      Désactiver
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal salle */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}>
          <div className="w-full max-w-md rounded-2xl" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
              <h2 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                {editItem ? "Modifier la salle" : "Nouvelle salle"}
              </h2>
              <button onClick={resetForm} style={{ color: "var(--m15-muted)" }}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--m15-muted)" }}>Nom *</label>
                <input type="text" required value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                  placeholder="Ex: Salle 01"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--m15-muted)" }}>Type</label>
                  <Select
                    value={form.type}
                    onChange={v => setForm(f => ({ ...f, type: v }))}
                    options={[
                      { value: "classe", label: "Classe" },
                      { value: "laboratoire", label: "Laboratoire" },
                      { value: "salle_info", label: "Informatique" },
                      { value: "gymnase", label: "Gymnase" },
                      { value: "autre", label: "Autre" },
                    ]}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--m15-muted)" }}>Capacité</label>
                  <input type="number" value={form.capacite} onChange={e => setForm(f => ({ ...f, capacite: e.target.value }))}
                    placeholder="Optionnel"
                    className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                    style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={resetForm}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                  Annuler
                </button>
                <button type="submit"
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                  style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
                  {creerMut.isPending || modifierMut.isPending ? "..." : editItem ? "Enregistrer" : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDesactiverId && (
        <ModalConfirm
          title="Désactiver cette salle ?"
          description="La salle ne sera plus disponible pour les emplois du temps. Vous pourrez la réactiver ultérieurement."
          labelConfirm="Désactiver"
          loading={desactiverMut.isPending}
          onConfirm={confirmDesactiver}
          onClose={() => setConfirmDesactiverId(null)}
        />
      )}
    </div>
  );
}

/* ─── Onglet Conflits ─────────────────────────────────────── */
function TabConflits({ etablissementId }: { etablissementId: string }) {
  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as unknown as { annees?: Record<string, string>[] })?.annees ?? [];
  const [anneeId, setAnneeId] = useState("");

  useEffect(() => {
    if (!anneeId && annees.length > 0) {
      const active = annees.find((a: Record<string, unknown>) => a.est_active);
      setAnneeId(String((active ?? annees[0])?.id ?? ""));
    }
  }, [annees, anneeId]);

  const { data: raw, isLoading, refetch } = useVerifierConflits(
    { annee_scolaire_id: anneeId, etablissement_id: etablissementId },
    { query: { queryKey: getVerifierConflitsQueryKey({ annee_scolaire_id: anneeId, etablissement_id: etablissementId }), enabled: !!anneeId && !!etablissementId } }
  );

  const conflits = (raw as unknown as { conflits?: Record<string, unknown>[] })?.conflits ?? [];

  const TYPE_CONFLIT_COLOR: Record<string, string> = {
    professeur: "#F5C842",
    classe: "#0080FF",
    salle: "#FF4D6D",
  };
  const TYPE_CONFLIT_LABEL: Record<string, string> = {
    professeur: "Professeur",
    classe: "Classe",
    salle: "Salle",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Rapport des conflits
          </h3>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            Détection automatique des conflits dans les emplois du temps
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-44">
            <Select
              value={anneeId}
              onChange={setAnneeId}
              placeholder="Année scolaire"
              options={annees.map((a: Record<string, string>) => ({ value: a.id, label: a.libelle }))}
            />
          </div>
          <button onClick={() => void refetch()}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-8 h-8 animate-spin" style={{ color: "#00C9A7" }} />
        </div>
      ) : conflits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl"
          style={{ background: "var(--m15-card)", border: "1px solid rgba(0,201,167,0.15)" }}>
          <CheckCircle className="w-12 h-12 mb-3" style={{ color: "#00C9A7" }} />
          <p className="text-lg font-bold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            Aucun conflit détecté !
          </p>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Tous les emplois du temps sont cohérents.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 p-4 rounded-xl"
            style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }}>
            <AlertTriangle className="w-5 h-5 flex-shrink-0" style={{ color: "#FF4D6D" }} />
            <span className="font-semibold" style={{ color: "#FF4D6D" }}>
              {conflits.length} conflit{conflits.length > 1 ? "s" : ""} détecté{conflits.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {conflits.map((c: Record<string, unknown>, i: number) => {
              const typeColor = TYPE_CONFLIT_COLOR[String(c.type)] || "#8B9DC3";
              const coursList = Array.isArray(c.cours) ? (c.cours as Record<string, string>[]) : [];
              return (
                <div key={i} className="p-4 rounded-2xl"
                  style={{ background: "var(--m15-card)", border: `1px solid ${typeColor}30` }}>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                      style={{ background: `${typeColor}18`, color: typeColor }}>
                      {TYPE_CONFLIT_LABEL[String(c.type)] || String(c.type)}
                    </span>
                    <span className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>
                      {String(c.description)}
                    </span>
                  </div>
                  {coursList.length > 0 && (
                    <div className="space-y-2">
                      {coursList.map((cours, j) => (
                        <div key={j} className="flex flex-wrap items-center gap-2 text-xs px-3 py-2 rounded-xl"
                          style={{ background: "var(--elevate-1)" }}>
                          <span className="font-bold" style={{ color: couleurMatiere(cours.matiere || "") }}>
                            {cours.matiere}
                          </span>
                          <span style={{ color: "var(--m15-muted)" }}>·</span>
                          <span style={{ color: "var(--m15-white)" }}>{cours.jour} {cours.creneau_libelle}</span>
                          <span style={{ color: "var(--m15-muted)" }}>·</span>
                          <span style={{ color: "var(--m15-muted)" }}>{cours.professeur_nom}</span>
                          {cours.classe_nom && (
                            <>
                              <span style={{ color: "var(--m15-muted)" }}>·</span>
                              <span style={{ color: "var(--m15-muted)" }}>{cours.classe_nom}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/* ─── Page principale ─────────────────────────────────────── */
export default function EmploiDuTemps() {
  const { user } = useAuth();
  const etabId = user?.etablissement_id || "";
  const canEditEmploi = ["dev", "directeur", "censeur"].includes(user?.role || "");
  const canManageInfra = ["dev", "directeur", "censeur"].includes(user?.role || "");

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.2)" }}>
          <Calendar className="w-6 h-6" style={{ color: "#00C9A7" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Emploi du temps
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            Grille hebdomadaire, créneaux et salles
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="grille" className="space-y-5">
        <TabsList className="rounded-xl p-1 gap-1"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <TabsTrigger value="grille" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:text-[var(--m15-white)]"
            style={{ fontFamily: "'DM Sans', sans-serif" }}>
            <Calendar className="w-4 h-4" />
            Grille
          </TabsTrigger>
          {canManageInfra && (
            <TabsTrigger value="creneaux" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:text-[var(--m15-white)]">
              <Clock className="w-4 h-4" />
              Créneaux
            </TabsTrigger>
          )}
          {canManageInfra && (
            <TabsTrigger value="salles" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:text-[var(--m15-white)]">
              <Building2 className="w-4 h-4" />
              Salles
            </TabsTrigger>
          )}
          {canManageInfra && (
            <TabsTrigger value="conflits" className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all data-[state=active]:text-[var(--m15-white)]">
              <AlertTriangle className="w-4 h-4" />
              Conflits
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="grille">
          <TabEmploi etablissementId={etabId} canEdit={canEditEmploi} />
        </TabsContent>

        {canManageInfra && (
          <TabsContent value="creneaux">
            <TabCreneaux etablissementId={etabId} />
          </TabsContent>
        )}

        {canManageInfra && (
          <TabsContent value="salles">
            <TabSalles etablissementId={etabId} canEdit={canManageInfra} />
          </TabsContent>
        )}

        {canManageInfra && (
          <TabsContent value="conflits">
            <TabConflits etablissementId={etabId} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
