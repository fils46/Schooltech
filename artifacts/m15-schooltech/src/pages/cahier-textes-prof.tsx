import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useCreerSeance, useListerSeances, useModifierSeance, useSupprimerSeance,
  useGetDevoirsAVenir,
  useListerClasses, useListerAnneesScolaires, useListerCreneaux,
} from "@workspace/api-client-react";
import {
  Book, Plus, Pencil, Trash2, X, ChevronDown, Calendar,
  Clock, BookOpen, FileCheck, AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ─────────────────────────────────────────────────── */
type Seance = {
  id: string; matiere: string; date_seance: string; titre_lecon: string;
  contenu_lecon?: string; travaux_donnes?: string; devoir_a_rendre?: boolean;
  date_remise_devoir?: string; classe_id?: string; classe_nom?: string;
  professeur_nom?: string; created_at?: string;
};
type Classe = { id: string; nom: string };
type Creneau = { id: string; libelle: string; heure_debut: string; heure_fin: string };

function formatDate(d: string) {
  if (!d) return "";
  const [y, m, j] = d.split("-");
  return `${j}/${m}/${y}`;
}

function daysBetween(d1: string, d2: string) {
  return Math.abs(new Date(d1).getTime() - new Date(d2).getTime()) / 86400000;
}

const MATIERES_COLORS: Record<string, string> = {
  Mathématiques: "#0080FF", Français: "#00C9A7", Anglais: "#9B59B6",
  Histoire: "#F5C842", Géographie: "#F5C842", Sciences: "#FF4D6D",
  Physique: "#0080FF", Chimie: "#FF4D6D", Philosophie: "#9B59B6",
};

function getMatiereColor(matiere: string) {
  for (const [k, v] of Object.entries(MATIERES_COLORS)) {
    if (matiere.toLowerCase().includes(k.toLowerCase())) return v;
  }
  return "#8B9DC3";
}

/* ─── Modal Séance ───────────────────────────────────────────── */
function SeanceModal({
  seanceToEdit,
  defaultClasseId,
  defaultMatiere,
  anneeId,
  classes,
  creneaux,
  onClose,
  onSaved,
}: {
  seanceToEdit?: Seance;
  defaultClasseId?: string;
  defaultMatiere?: string;
  anneeId: string;
  classes: Classe[];
  creneaux: Creneau[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const creerMut = useCreerSeance();
  const modifierMut = useModifierSeance();
  const isEdit = !!seanceToEdit;

  const [form, setForm] = useState({
    classe_id: seanceToEdit?.classe_id ?? defaultClasseId ?? "",
    matiere: seanceToEdit?.matiere ?? defaultMatiere ?? "",
    date_seance: seanceToEdit?.date_seance ?? new Date().toISOString().slice(0, 10),
    creneau_id: "",
    titre_lecon: seanceToEdit?.titre_lecon ?? "",
    contenu_lecon: seanceToEdit?.contenu_lecon ?? "",
    travaux_donnes: seanceToEdit?.travaux_donnes ?? "",
    devoir_a_rendre: seanceToEdit?.devoir_a_rendre ?? false,
    date_remise_devoir: seanceToEdit?.date_remise_devoir ?? "",
    annee_scolaire_id: anneeId,
  });

  const setField = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.classe_id || !form.matiere || !form.date_seance || !form.titre_lecon) {
      toast({ title: "Champs obligatoires manquants.", variant: "destructive" });
      return;
    }
    if (form.devoir_a_rendre && !form.date_remise_devoir) {
      toast({ title: "Date de remise obligatoire si devoir.", variant: "destructive" });
      return;
    }

    const payload = {
      ...form,
      annee_scolaire_id: anneeId,
      creneau_id: form.creneau_id || undefined,
      date_remise_devoir: form.date_remise_devoir || undefined,
    };

    if (isEdit) {
      modifierMut.mutate(
        { id: seanceToEdit!.id, data: payload },
        {
          onSuccess: () => { toast({ title: "Séance modifiée." }); onSaved(); onClose(); },
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
          onSuccess: () => { toast({ title: "Séance créée." }); onSaved(); onClose(); },
          onError: (e: unknown) => {
            const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
            toast({ title: "Erreur", description: msg, variant: "destructive" });
          },
        }
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="sticky top-0 flex items-center justify-between p-5 pb-4"
          style={{ background: "var(--m15-card)", borderBottom: "1px solid var(--m15-border)" }}>
          <h2 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            {isEdit ? "Modifier la séance" : "Nouvelle séance"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Classe + Matière */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                Classe *
              </label>
              <select value={form.classe_id} onChange={e => setField("classe_id", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                <option value="">Sélectionner</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                Matière *
              </label>
              <input type="text" value={form.matiere} onChange={e => setField("matiere", e.target.value)}
                placeholder="Ex: Mathématiques"
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
          </div>

          {/* Date + Créneau */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                Date séance *
              </label>
              <input type="date" value={form.date_seance} onChange={e => setField("date_seance", e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                Créneau
              </label>
              <select value={form.creneau_id} onChange={e => setField("creneau_id", e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                <option value="">Aucun</option>
                {creneaux.map(c => <option key={c.id} value={c.id}>{c.libelle} ({c.heure_debut}–{c.heure_fin})</option>)}
              </select>
            </div>
          </div>

          {/* Titre leçon */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
              Titre de la leçon *
            </label>
            <input type="text" value={form.titre_lecon} onChange={e => setField("titre_lecon", e.target.value)}
              placeholder="Ex: Les fractions — introduction"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>

          {/* Contenu */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
              Contenu de la leçon
            </label>
            <textarea value={form.contenu_lecon} onChange={e => setField("contenu_lecon", e.target.value)}
              rows={4} placeholder="Résumé du cours..."
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>

          {/* Travaux donnés */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
              Travaux donnés
            </label>
            <textarea value={form.travaux_donnes} onChange={e => setField("travaux_donnes", e.target.value)}
              rows={2} placeholder="Exercices, lectures..."
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>

          {/* Devoir à rendre */}
          <div className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
            <input type="checkbox" id="devoir" checked={form.devoir_a_rendre}
              onChange={e => setField("devoir_a_rendre", e.target.checked)}
              className="w-4 h-4 accent-yellow-400" />
            <label htmlFor="devoir" className="text-sm font-medium cursor-pointer" style={{ color: "var(--m15-white)" }}>
              Devoir à rendre
            </label>
            {form.devoir_a_rendre && (
              <input type="date" value={form.date_remise_devoir}
                onChange={e => setField("date_remise_devoir", e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="ml-auto px-3 py-1.5 rounded-lg text-sm outline-none"
                style={{ background: "var(--m15-card)", border: "1px solid rgba(245,200,66,0.3)", color: "#F5C842" }} />
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "var(--elevate-1)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
              Annuler
            </button>
            <button onClick={handleSave} disabled={creerMut.isPending || modifierMut.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
              {creerMut.isPending || modifierMut.isPending ? "..." : isEdit ? "Modifier" : "Créer"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Carte Séance ────────────────────────────────────────── */
function SeanceCard({
  s, canEdit, onEdit, onDelete,
}: {
  s: Seance; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const color = getMatiereColor(s.matiere);
  const isEditable = canEdit && daysBetween(s.created_at ?? s.date_seance, new Date().toISOString().slice(0, 10)) <= 2;

  return (
    <div className="relative pl-10">
      {/* Trait timeline */}
      <div className="absolute left-3.5 top-0 bottom-0 w-0.5" style={{ background: "var(--m15-border)" }} />
      <div className="absolute left-1.5 top-4 w-4 h-4 rounded-full border-2 flex items-center justify-center"
        style={{ background: "var(--m15-navy)", borderColor: color }}>
        <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      </div>

      <div className="rounded-2xl p-4 mb-4"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: `${color}20`, color }}>
                {s.matiere}
              </span>
              {s.classe_nom && (
                <span className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}>
                  {s.classe_nom}
                </span>
              )}
              {s.devoir_a_rendre && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842" }}>
                  📋 Devoir · {s.date_remise_devoir ? formatDate(s.date_remise_devoir) : "—"}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
              {s.titre_lecon}
            </p>
            <p className="text-xs mt-0.5 flex items-center gap-1" style={{ color: "var(--m15-muted)" }}>
              <Calendar className="w-3 h-3" /> {formatDate(s.date_seance)}
            </p>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {canEdit && (
              <>
                {isEditable && (
                  <button onClick={onEdit}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                    style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={onDelete}
                  className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
                  style={{ background: "rgba(255,77,109,0.1)", color: "#FF4D6D" }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button onClick={() => setExpanded(e => !e)}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all"
              style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>

        {expanded && (s.contenu_lecon || s.travaux_donnes) && (
          <div className="mt-3 space-y-2 pt-3" style={{ borderTop: "1px solid var(--m15-border)" }}>
            {s.contenu_lecon && (
              <div>
                <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: "var(--m15-muted)" }}>
                  <BookOpen className="w-3 h-3" /> Contenu
                </p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--m15-white)" }}>
                  {s.contenu_lecon}
                </p>
              </div>
            )}
            {s.travaux_donnes && (
              <div>
                <p className="text-xs font-semibold mb-1 flex items-center gap-1" style={{ color: "var(--m15-muted)" }}>
                  <FileCheck className="w-3 h-3" /> Travaux donnés
                </p>
                <p className="text-sm whitespace-pre-wrap" style={{ color: "var(--m15-white)" }}>
                  {s.travaux_donnes}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Page principale ──────────────────────────────────────── */
export default function CahierTextesProfPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const canEdit = ["professeur", "directeur", "censeur", "dev"].includes(user?.role ?? "");

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as unknown as { annees?: { id: string; libelle: string; est_active?: boolean }[] })?.annees ?? [];
  const anneeActive = annees.find(a => a.est_active) ?? annees[0];
  const anneeId = anneeActive?.id ?? "";

  const { data: classesData } = useListerClasses();
  const classes = ((classesData as unknown as { classes?: Classe[] })?.classes ?? []) as Classe[];

  const { data: creneauxData } = useListerCreneaux({ etablissement_id: user?.etablissement_id ?? undefined });
  const creneaux = (creneauxData as unknown as { creneaux?: Creneau[] })?.creneaux ?? [];

  const [filtreClasse, setFiltreClasse] = useState("");
  const [filtreMatiere, setFiltreMatiere] = useState("");
  const [onglet, setOnglet] = useState<"seances" | "devoirs">("seances");
  const [modalOpen, setModalOpen] = useState(false);
  const [editSeance, setEditSeance] = useState<Seance | undefined>();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const supprimerMut = useSupprimerSeance();

  const { data: seancesData, refetch } = useListerSeances({
    classe_id: filtreClasse || undefined,
    matiere: filtreMatiere || undefined,
    annee_scolaire_id: anneeId || undefined,
  });
  const seances = (seancesData as unknown as { seances?: Seance[] })?.seances ?? [];

  const { data: devoirsData } = useGetDevoirsAVenir({
    classe_id: filtreClasse || undefined,
  });
  const devoirs = (devoirsData as unknown as { devoirs?: Seance[] })?.devoirs ?? [];

  const handleDelete = (id: string) => {
    supprimerMut.mutate(
      { id },
      {
        onSuccess: () => { toast({ title: "Séance supprimée." }); refetch(); setConfirmDelete(null); },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
          toast({ title: "Erreur", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Cahier de textes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            {seances.length} séance{seances.length > 1 ? "s" : ""}
          </p>
        </div>
        {canEdit && (
          <button
            onClick={() => { setEditSeance(undefined); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}
          >
            <Plus className="w-4 h-4" /> Nouvelle séance
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <select value={filtreClasse} onChange={e => setFiltreClasse(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
          <option value="">Toutes les classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>
        <input type="text" value={filtreMatiere} onChange={e => setFiltreMatiere(e.target.value)}
          placeholder="Filtrer par matière..."
          className="px-3 py-2 rounded-xl text-sm outline-none"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", minWidth: "160px" }} />
      </div>

      {/* Onglets */}
      <div className="flex gap-1 rounded-xl p-1" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", width: "fit-content" }}>
        {[
          { key: "seances", label: "Séances", icon: Book },
          { key: "devoirs", label: "Devoirs à venir", icon: Clock, count: devoirs.length },
        ].map(({ key, label, icon: Icon, count }) => (
          <button key={key}
            onClick={() => setOnglet(key as "seances" | "devoirs")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: onglet === key ? "rgba(0,201,167,0.1)" : "transparent",
              color: onglet === key ? "#00C9A7" : "var(--m15-muted)",
            }}>
            <Icon className="w-4 h-4" />
            {label}
            {count !== undefined && count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(245,200,66,0.2)", color: "#F5C842" }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {onglet === "seances" && (
        <div className="relative pl-2 space-y-0">
          {seances.length === 0 ? (
            <div className="text-center py-16">
              <Book className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--m15-muted)" }} />
              <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Aucune séance</p>
              <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
                {canEdit ? "Créez votre première séance." : "Aucune séance pour ce filtre."}
              </p>
            </div>
          ) : (
            seances.map(s => (
              <SeanceCard
                key={s.id}
                s={s}
                canEdit={canEdit}
                onEdit={() => { setEditSeance(s); setModalOpen(true); }}
                onDelete={() => setConfirmDelete(s.id)}
              />
            ))
          )}
        </div>
      )}

      {onglet === "devoirs" && (
        <div className="space-y-3">
          {devoirs.length === 0 ? (
            <div className="text-center py-16">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "#F5C842" }} />
              <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Aucun devoir à venir</p>
            </div>
          ) : (
            devoirs.map(d => (
              <div key={d.id} className="flex gap-4 p-4 rounded-2xl"
                style={{ background: "rgba(245,200,66,0.05)", border: "1px solid rgba(245,200,66,0.2)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(245,200,66,0.15)" }}>
                  <Clock className="w-5 h-5" style={{ color: "#F5C842" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: `${getMatiereColor(d.matiere)}20`, color: getMatiereColor(d.matiere) }}>
                      {d.matiere}
                    </span>
                    {d.classe_nom && (
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}>
                        {d.classe_nom}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold mt-1" style={{ color: "var(--m15-white)" }}>
                    {d.titre_lecon}
                  </p>
                  <p className="text-xs mt-0.5 font-semibold" style={{ color: "#F5C842" }}>
                    À rendre le {d.date_remise_devoir ? formatDate(d.date_remise_devoir) : "—"}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <SeanceModal
          seanceToEdit={editSeance}
          anneeId={anneeId}
          classes={classes}
          creneaux={creneaux}
          onClose={() => { setModalOpen(false); setEditSeance(undefined); }}
          onSaved={refetch}
        />
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.75)" }}>
          <div className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: "#FF4D6D" }} />
            <h3 className="text-lg font-bold text-center mb-4" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Supprimer cette séance ?
            </h3>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--elevate-1)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
                Annuler
              </button>
              <button onClick={() => handleDelete(confirmDelete)} disabled={supprimerMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.3)" }}>
                {supprimerMut.isPending ? "..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
