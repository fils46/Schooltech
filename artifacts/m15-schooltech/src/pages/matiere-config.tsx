import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetMatiereClasse,
  useConfigurerMatieres,
  useModifierMatiereConfig,
  useSupprimerMatiereConfig,
  useListerClasses,
  useListerAnneesScolaires,
  getGetMatiereClasseQueryKey,
  type GetMatiereClasseParams,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen, Plus, Save, Edit2, Trash2, Loader2, GripVertical, AlertCircle,
} from "lucide-react";

type MatiereRow = {
  id?: string;
  nom_matiere: string;
  coefficient: number;
  ordre_affichage: number;
  professeur_id?: string | null;
  isNew?: boolean;
};

type Classe = { id: string; nom: string };
type AnneeScolaire = { id: string; libelle: string };

const MENTIONS: Record<string, { label: string; color: string }> = {
  tres_bien:  { label: "Très Bien",   color: "#00C9A7" },
  bien:       { label: "Bien",        color: "#0080FF" },
  assez_bien: { label: "Assez Bien",  color: "#F5C842" },
  passable:   { label: "Passable",    color: "#F97316" },
  insuffisant:{ label: "Insuffisant", color: "#FF4D6D" },
};

function CardStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
      <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>{label}</p>
      <p className="text-2xl font-bold" style={{ color: color ?? "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>{value}</p>
    </div>
  );
}

export default function MatiereConfig() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [classeId, setClasseId] = useState("");
  const [anneeId, setAnneeId] = useState("");
  const [editModal, setEditModal] = useState<MatiereRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [nouvelleMatiere, setNouvelleMatiere] = useState<MatiereRow>({
    nom_matiere: "", coefficient: 1, ordre_affichage: 0,
  });
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: classesData, isLoading: loadingClasses } = useListerClasses();
  const { data: anneesData } = useListerAnneesScolaires();

  const classes: Classe[] = (classesData as { classes?: Classe[] })?.classes ?? [];
  const annees: AnneeScolaire[] = (anneesData as { annees?: AnneeScolaire[] })?.annees ?? [];

  const matParams: GetMatiereClasseParams = anneeId ? { annee_scolaire_id: anneeId } : {};
  const { data: matData, isLoading: loadingMat } = useGetMatiereClasse(
    classeId || "skip",
    matParams,
    { query: { queryKey: getGetMatiereClasseQueryKey(classeId, matParams), enabled: !!classeId && !!anneeId } }
  );
  const matieres: MatiereRow[] = ((matData as { matieres?: MatiereRow[] })?.matieres ?? []).map(m => ({
    ...m,
    coefficient: Number(m.coefficient),
  }));

  const configurer = useConfigurerMatieres();
  const modifier = useModifierMatiereConfig();
  const supprimer = useSupprimerMatiereConfig();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetMatiereClasseQueryKey(classeId, { annee_scolaire_id: anneeId }) });

  function handleAjouter() {
    if (!nouvelleMatiere.nom_matiere.trim()) {
      toast({ title: "Nom de matière requis.", variant: "destructive" });
      return;
    }
    const payload = {
      classe_id: classeId,
      annee_scolaire_id: anneeId,
      matieres: [
        ...matieres.map(m => ({ nom_matiere: m.nom_matiere, coefficient: m.coefficient, ordre_affichage: m.ordre_affichage })),
        { nom_matiere: nouvelleMatiere.nom_matiere, coefficient: nouvelleMatiere.coefficient, ordre_affichage: matieres.length },
      ],
    };
    configurer.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Matière ajoutée." });
        setNouvelleMatiere({ nom_matiere: "", coefficient: 1, ordre_affichage: 0 });
        setShowAddForm(false);
        invalidate();
      },
      onError: () => toast({ title: "Erreur lors de l'ajout.", variant: "destructive" }),
    });
  }

  function handleModifier() {
    if (!editModal?.id) return;
    modifier.mutate(
      { id: editModal.id, data: { nom_matiere: editModal.nom_matiere, coefficient: editModal.coefficient, ordre_affichage: editModal.ordre_affichage } },
      {
        onSuccess: () => {
          toast({ title: "Matière modifiée." });
          setEditModal(null);
          invalidate();
        },
        onError: () => toast({ title: "Erreur lors de la modification.", variant: "destructive" }),
      }
    );
  }

  function handleSupprimer(id: string) {
    supprimer.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "Matière supprimée." });
        setDeleteId(null);
        invalidate();
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur lors de la suppression.";
        toast({ title: msg, variant: "destructive" });
        setDeleteId(null);
      },
    });
  }

  const canEdit = ["dev", "directeur", "censeur"].includes(user?.role ?? "");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.25)" }}>
          <BookOpen className="w-5 h-5" style={{ color: "#00C9A7" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Configuration des Matières</h2>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Définissez les matières et coefficients par classe</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Classe</Label>
          {loadingClasses ? <Skeleton className="h-10 w-full" /> : (
            <Select value={classeId} onValueChange={setClasseId}>
              <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                <SelectValue placeholder="Sélectionner une classe" />
              </SelectTrigger>
              <SelectContent>
                {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Année scolaire</Label>
          <Select value={anneeId} onValueChange={setAnneeId}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Sélectionner une année" />
            </SelectTrigger>
            <SelectContent>
              {annees.map(a => <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      {matieres.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <CardStat label="Matières" value={matieres.length} color="#00C9A7" />
          <CardStat label="Total coefficients" value={matieres.reduce((s, m) => s + m.coefficient, 0)} color="#0080FF" />
          <CardStat label="Coeff. moyen" value={(matieres.reduce((s, m) => s + m.coefficient, 0) / matieres.length).toFixed(1)} color="#F5C842" />
        </div>
      )}

      {/* Table matières */}
      {classeId && anneeId && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
            <h3 className="font-semibold" style={{ color: "var(--m15-white)" }}>
              {matieres.length} matière{matieres.length !== 1 ? "s" : ""} configurée{matieres.length !== 1 ? "s" : ""}
            </h3>
            {canEdit && (
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.25)", color: "#00C9A7" }}
              >
                <Plus className="w-4 h-4" /> Ajouter
              </button>
            )}
          </div>

          {/* Formulaire ajout */}
          {showAddForm && canEdit && (
            <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-3" style={{ borderBottom: "1px solid var(--m15-border)", background: "rgba(0,201,167,0.04)" }}>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Nom de la matière</Label>
                <Input
                  value={nouvelleMatiere.nom_matiere}
                  onChange={e => setNouvelleMatiere(p => ({ ...p, nom_matiere: e.target.value }))}
                  placeholder="Ex: Mathématiques"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Coefficient</Label>
                <Input
                  type="number" min="0.5" max="9" step="0.5"
                  value={nouvelleMatiere.coefficient}
                  onChange={e => setNouvelleMatiere(p => ({ ...p, coefficient: Number(e.target.value) }))}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleAjouter}
                  disabled={configurer.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "#00C9A7", color: "#0A1628" }}
                >
                  {configurer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
                <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-xl text-sm" style={{ color: "var(--m15-muted)" }}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* Liste */}
          {loadingMat ? (
            <div className="p-5 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : matieres.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--m15-muted)" }} />
              <p style={{ color: "var(--m15-muted)" }}>Aucune matière configurée pour cette classe</p>
              {canEdit && (
                <p className="text-sm mt-1" style={{ color: "var(--m15-muted)", opacity: 0.7 }}>
                  Cliquez sur « Ajouter » pour configurer les matières
                </p>
              )}
            </div>
          ) : (
            <div>
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 px-5 py-2 text-xs font-semibold uppercase" style={{ color: "var(--m15-muted)", background: "var(--elevate-1)" }}>
                <div className="col-span-1"></div>
                <div className="col-span-5">Matière</div>
                <div className="col-span-2 text-center">Coeff.</div>
                <div className="col-span-2 text-center">Ordre</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>
              {matieres.map((m, idx) => (
                <div key={m.id ?? idx} className="grid grid-cols-12 gap-2 items-center px-5 py-3" style={{ borderTop: "1px solid var(--m15-border)" }}>
                  <div className="col-span-1"><GripVertical className="w-4 h-4" style={{ color: "var(--m15-muted)", opacity: 0.4 }} /></div>
                  <div className="col-span-5">
                    <span className="font-medium" style={{ color: "var(--m15-white)" }}>{m.nom_matiere}</span>
                  </div>
                  <div className="col-span-2 text-center">
                    <span className="px-2 py-0.5 rounded-lg text-sm font-bold" style={{ background: "rgba(0,128,255,0.12)", color: "#0080FF" }}>{m.coefficient}</span>
                  </div>
                  <div className="col-span-2 text-center text-sm" style={{ color: "var(--m15-muted)" }}>{idx + 1}</div>
                  {canEdit && (
                    <div className="col-span-2 flex justify-end gap-2">
                      <button onClick={() => setEditModal({ ...m })} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => m.id && setDeleteId(m.id)} className="w-8 h-8 flex items-center justify-center rounded-lg transition-all" style={{ background: "rgba(255,77,109,0.08)", color: "#FF4D6D" }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!classeId || !anneeId ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--m15-card)", border: "1px dashed var(--m15-border)" }}>
          <BookOpen className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
          <p style={{ color: "var(--m15-muted)" }}>Sélectionnez une classe et une année scolaire pour voir les matières</p>
        </div>
      ) : null}

      {/* Modal édition */}
      <Dialog open={!!editModal} onOpenChange={() => setEditModal(null)}>
        <DialogContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)" }}>Modifier la matière</DialogTitle>
          </DialogHeader>
          {editModal && (
            <div className="space-y-4 mt-2">
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Nom</Label>
                <Input
                  value={editModal.nom_matiere}
                  onChange={e => setEditModal(p => p ? { ...p, nom_matiere: e.target.value } : p)}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Coefficient</Label>
                <Input
                  type="number" min="0.5" max="9" step="0.5"
                  value={editModal.coefficient}
                  onChange={e => setEditModal(p => p ? { ...p, coefficient: Number(e.target.value) } : p)}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleModifier}
                  disabled={modifier.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold"
                  style={{ background: "#00C9A7", color: "#0A1628" }}
                >
                  {modifier.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Enregistrer
                </button>
                <button onClick={() => setEditModal(null)} className="flex-1 py-2.5 rounded-xl font-semibold" style={{ background: "var(--elevate-2)", color: "var(--m15-white)" }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal suppression */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)" }}>Supprimer la matière ?</DialogTitle>
          </DialogHeader>
          <div className="flex items-start gap-3 p-3 rounded-xl mt-2" style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }}>
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: "#FF4D6D" }} />
            <p className="text-sm" style={{ color: "var(--m15-white)" }}>
              Cette action est irréversible. Impossible si des notes existent pour cette matière.
            </p>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => deleteId && handleSupprimer(deleteId)}
              disabled={supprimer.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold"
              style={{ background: "#FF4D6D", color: "#fff" }}
            >
              {supprimer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Supprimer
            </button>
            <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl font-semibold" style={{ background: "var(--elevate-2)", color: "var(--m15-white)" }}>
              Annuler
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
