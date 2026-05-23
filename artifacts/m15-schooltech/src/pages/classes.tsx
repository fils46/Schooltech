import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListerClasses,
  useCreerClasse,
  useModifierClasse,
  useSupprimerClasse,
  getListerClassesQueryKey,
  type Classe,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2, BookOpen, Users, Edit2, Trash2, GraduationCap, ChevronDown, ChevronUp } from "lucide-react";

/* ─── Constantes ─────────────────────────────────────────── */

const NIVEAUX_COLLEGE = ["6ème", "5ème", "4ème", "3ème"];
const NIVEAUX_LYCEE   = ["2nde", "1ère", "Terminale"];
const NIVEAUX_ALL     = [...NIVEAUX_COLLEGE, ...NIVEAUX_LYCEE];
const SECTIONS        = ["A", "B", "C", "D", "E", "F"];

const NIVEAU_COLORS: Record<string, string> = {
  "6ème":      "#00C9A7",
  "5ème":      "#0080FF",
  "4ème":      "#9F7AEA",
  "3ème":      "#F5C842",
  "2nde":      "#FF6B35",
  "1ère":      "#FF4D6D",
  "Terminale": "#00C9A7",
};

const ANNEE_COURANTE = new Date().getFullYear();

/* ─── Schéma form ────────────────────────────────────────── */

const classeSchema = z.object({
  nom:           z.string().min(1, "Requis"),
  niveau:        z.string().min(1, "Requis"),
  section:       z.string().min(1, "Requis"),
  annee_scolaire: z.number().int().min(2000).max(2100),
  capacite_max:  z.number().int().min(1).nullable().optional(),
});
type ClasseForm = z.infer<typeof classeSchema>;

/* ─── Sous-composant carte classe ────────────────────────── */

function ClasseCard({
  classe,
  onEdit,
  onDelete,
  canDelete,
}: {
  classe: Classe;
  onEdit: (c: Classe) => void;
  onDelete: (c: Classe) => void;
  canDelete: boolean;
}) {
  const color = NIVEAU_COLORS[classe.niveau] ?? "#00C9A7";
  return (
    <div className="relative rounded-2xl p-5 flex flex-col gap-3 transition-all group"
      style={{
        background: "var(--m15-card)",
        border: "1px solid var(--m15-border)",
        borderTop: `3px solid ${color}`,
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.borderColor = color;
        (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--m15-border)";
        (e.currentTarget as HTMLElement).style.borderTopColor = color;
        (e.currentTarget as HTMLElement).style.transform = "none";
      }}
    >
      {/* Nom & niveau */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            {classe.nom}
          </p>
          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ background: `${color}18`, color }}>
            {classe.niveau}
          </span>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(classe)}
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ background: "rgba(0,128,255,0.10)", color: "#0080FF" }}
            title="Modifier">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          {canDelete && (
            <button onClick={() => onDelete(classe)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
              style={{ background: "rgba(255,77,109,0.10)", color: "#FF4D6D" }}
              title="Supprimer">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 pt-1" style={{ borderTop: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" style={{ color: "var(--m15-muted)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
            {classe.nb_eleves ?? 0}
          </span>
          {classe.capacite_max && (
            <span className="text-xs" style={{ color: "var(--m15-muted)" }}>/ {classe.capacite_max}</span>
          )}
          <span className="text-xs" style={{ color: "var(--m15-muted)" }}>élèves</span>
        </div>
        <div className="ml-auto text-xs" style={{ color: "var(--m15-muted)" }}>
          {classe.annee_scolaire}-{classe.annee_scolaire + 1}
        </div>
      </div>

      {/* Barre capacité */}
      {classe.capacite_max && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--elevate-2)" }}>
          <div className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, Math.round(((classe.nb_eleves ?? 0) / classe.capacite_max) * 100))}%`,
              background: color,
            }} />
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────── */

export default function Classes() {
  const [openForm, setOpenForm]     = useState(false);
  const [editTarget, setEditTarget] = useState<Classe | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Classe | null>(null);
  const [annee, setAnnee]           = useState(ANNEE_COURANTE);
  const [filterNiveau, setFilterNiveau] = useState<string>("tous");
  const [collapsedNiveaux, setCollapsedNiveaux] = useState<Set<string>>(new Set());

  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const qKey = getListerClassesQueryKey({ annee_scolaire: annee });
  const { data, isLoading } = useListerClasses(
    { annee_scolaire: annee },
    { query: { queryKey: qKey } }
  );

  const createMutation  = useCreerClasse();
  const updateMutation  = useModifierClasse();
  const deleteMutation  = useSupprimerClasse();

  const form = useForm<ClasseForm>({
    resolver: zodResolver(classeSchema),
    defaultValues: { nom: "", niveau: "", section: "A", annee_scolaire: annee, capacite_max: null },
  });

  const openCreate = () => {
    setEditTarget(null);
    form.reset({ nom: "", niveau: "", section: "A", annee_scolaire: annee, capacite_max: null });
    setOpenForm(true);
  };

  const openEdit = (c: Classe) => {
    setEditTarget(c);
    form.reset({
      nom: c.nom,
      niveau: c.niveau,
      section: c.section,
      annee_scolaire: c.annee_scolaire,
      capacite_max: c.capacite_max ?? null,
    });
    setOpenForm(true);
  };

  const onSubmit = (data: ClasseForm) => {
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, data }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: qKey });
          toast({ title: "Classe modifiée avec succès." });
          setOpenForm(false);
        },
        onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
      });
    } else {
      createMutation.mutate({ data: { ...data, etablissement_id: user?.etablissement_id ?? undefined } }, {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: qKey });
          toast({ title: "Classe créée avec succès." });
          setOpenForm(false);
        },
        onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
      });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ id: deleteTarget.id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qKey });
        toast({ title: "Classe supprimée." });
        setDeleteTarget(null);
      },
      onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
    });
  };

  const classes = data?.classes ?? [];
  const filtered = filterNiveau === "tous" ? classes : classes.filter(c => c.niveau === filterNiveau);

  // Grouper par niveau
  const grouped = NIVEAUX_ALL.reduce<Record<string, Classe[]>>((acc, n) => {
    const list = filtered.filter(c => c.niveau === n);
    if (list.length > 0) acc[n] = list;
    return acc;
  }, {});

  const toggleCollapse = (niveau: string) => {
    setCollapsedNiveaux(prev => {
      const next = new Set(prev);
      if (next.has(niveau)) next.delete(niveau);
      else next.add(niveau);
      return next;
    });
  };

  const canDelete = user?.role === "dev" || user?.role === "directeur";
  const totalEleves = classes.reduce((s, c) => s + (c.nb_eleves ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Classes
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            {classes.length} classe{classes.length !== 1 ? "s" : ""} · {totalEleves} élève{totalEleves !== 1 ? "s" : ""} inscrits
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Sélecteur année */}
          <select
            value={annee}
            onChange={e => setAnnee(parseInt(e.target.value))}
            className="px-3 py-2 rounded-xl text-sm font-medium outline-none"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            {[ANNEE_COURANTE - 1, ANNEE_COURANTE, ANNEE_COURANTE + 1].map(y => (
              <option key={y} value={y}>{y}-{y + 1}</option>
            ))}
          </select>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "#00C9A7", color: "#0A1628", fontFamily: "'Syne', sans-serif" }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#00b396"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#00C9A7"}
          >
            <Plus className="w-4 h-4" /> Nouvelle classe
          </button>
        </div>
      </div>

      {/* Stats globales */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Classes", value: classes.length, color: "#00C9A7", icon: BookOpen },
          { label: "Élèves inscrits", value: totalEleves, color: "#0080FF", icon: Users },
          { label: "Collège", value: classes.filter(c => NIVEAUX_COLLEGE.includes(c.niveau)).length, color: "#9F7AEA", icon: GraduationCap },
          { label: "Lycée", value: classes.filter(c => NIVEAUX_LYCEE.includes(c.niveau)).length, color: "#F5C842", icon: GraduationCap },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                {isLoading ? "–" : value}
              </p>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtre niveau */}
      <div className="flex flex-wrap gap-2">
        {["tous", ...NIVEAUX_ALL].map(n => (
          <button key={n}
            onClick={() => setFilterNiveau(n)}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: filterNiveau === n ? (NIVEAU_COLORS[n] ?? "#00C9A7") : "var(--m15-card)",
              color: filterNiveau === n ? "#0A1628" : "var(--m15-muted)",
              border: `1px solid ${filterNiveau === n ? (NIVEAU_COLORS[n] ?? "#00C9A7") : "var(--m15-border)"}`,
            }}>
            {n === "tous" ? "Tous les niveaux" : n}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <BookOpen className="w-14 h-14 mb-4" style={{ color: "var(--m15-muted)", opacity: 0.35 }} />
          <p className="font-semibold text-lg" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Aucune classe pour cette année
          </p>
          <p className="text-sm mt-1 mb-6" style={{ color: "var(--m15-muted)" }}>
            Créez les classes de l'année scolaire {annee}-{annee + 1}
          </p>
          <button onClick={openCreate}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "#00C9A7", color: "#0A1628" }}>
            <Plus className="w-4 h-4" /> Créer la première classe
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([niveau, list]) => {
            const collapsed = collapsedNiveaux.has(niveau);
            const color = NIVEAU_COLORS[niveau] ?? "#00C9A7";
            return (
              <div key={niveau}>
                <button
                  onClick={() => toggleCollapse(niveau)}
                  className="flex items-center gap-3 mb-3 w-full text-left group"
                >
                  <div className="w-1 h-5 rounded-full" style={{ background: color }} />
                  <span className="font-bold text-base" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                    {niveau}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: `${color}18`, color }}>
                    {list.length} classe{list.length !== 1 ? "s" : ""}
                  </span>
                  <div className="ml-auto" style={{ color: "var(--m15-muted)" }}>
                    {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </div>
                </button>
                {!collapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {list.map(c => (
                      <ClasseCard
                        key={c.id}
                        classe={c}
                        onEdit={openEdit}
                        onDelete={setDeleteTarget}
                        canDelete={canDelete}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Créer / Modifier */}
      <Dialog open={openForm} onOpenChange={(v) => { setOpenForm(v); if (!v) setEditTarget(null); }}>
        <DialogContent className="sm:max-w-[460px]"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              {editTarget ? "Modifier la classe" : "Nouvelle classe"}
            </DialogTitle>
            <DialogDescription style={{ color: "var(--m15-muted)" }}>
              {editTarget ? `Modification de ${editTarget.nom}` : "Créer une classe pour l'établissement"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            {/* Niveau + Section */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)", fontSize: "12px" }}>NIVEAU *</Label>
                <Select
                  value={form.watch("niveau")}
                  onValueChange={(v) => {
                    form.setValue("niveau", v);
                    const s = form.watch("section") || "A";
                    form.setValue("nom", `${v} ${s}`);
                  }}>
                  <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                    <SelectValue placeholder="Niveau..." />
                  </SelectTrigger>
                  <SelectContent>
                    <p className="px-2 py-1 text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>COLLÈGE</p>
                    {NIVEAUX_COLLEGE.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    <p className="px-2 py-1 text-xs font-semibold mt-1" style={{ color: "var(--m15-muted)" }}>LYCÉE</p>
                    {NIVEAUX_LYCEE.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.formState.errors.niveau && (
                  <p className="text-xs" style={{ color: "#FF4D6D" }}>{form.formState.errors.niveau.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)", fontSize: "12px" }}>SECTION *</Label>
                <Select
                  value={form.watch("section")}
                  onValueChange={(v) => {
                    form.setValue("section", v);
                    const n = form.watch("niveau");
                    if (n) form.setValue("nom", `${n} ${v}`);
                  }}>
                  <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                    <SelectValue placeholder="Section..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTIONS.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Nom (généré auto, éditable) */}
            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-muted)", fontSize: "12px" }}>NOM DE LA CLASSE *</Label>
              <Input {...form.register("nom")}
                placeholder="ex: 6ème A"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              {form.formState.errors.nom && (
                <p className="text-xs" style={{ color: "#FF4D6D" }}>{form.formState.errors.nom.message}</p>
              )}
            </div>

            {/* Année + Capacité */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)", fontSize: "12px" }}>ANNÉE SCOLAIRE *</Label>
                <Input
                  type="number"
                  value={form.watch("annee_scolaire")}
                  onChange={e => form.setValue("annee_scolaire", parseInt(e.target.value))}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)", fontSize: "12px" }}>CAPACITÉ MAX</Label>
                <Input
                  type="number"
                  placeholder="Ex: 45"
                  value={form.watch("capacite_max") ?? ""}
                  onChange={e => form.setValue("capacite_max", e.target.value ? parseInt(e.target.value) : null)}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setOpenForm(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                Annuler
              </button>
              <button type="submit" disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "#00C9A7", color: "#0A1628" }}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                {editTarget ? "Enregistrer" : "Créer"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-[400px]"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Supprimer la classe
            </DialogTitle>
            <DialogDescription style={{ color: "var(--m15-muted)" }}>
              Voulez-vous vraiment supprimer <strong style={{ color: "var(--m15-white)" }}>{deleteTarget?.nom}</strong> ?
              Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setDeleteTarget(null)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
              Annuler
            </button>
            <button onClick={confirmDelete} disabled={deleteMutation.isPending}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#FF4D6D", color: "#fff" }}>
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Supprimer
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
