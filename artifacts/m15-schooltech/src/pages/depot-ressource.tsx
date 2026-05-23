import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, BarChart2, Eye, BookOpen, FileText,
  Video, BookMarked, Layers, Upload, X, Tag,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import {
  useGetBibliothequeRessources,
  getGetBibliothequeRessourcesQueryKey,
  usePostBibliothequeRessources,
  usePutBibliothequeRessourcesId,
  useDeleteBibliothequeRessourcesId,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  manuel: "Manuel scolaire",
  fiche_cours: "Fiche de cours",
  exercice: "Exercices",
  video: "Vidéo pédagogique",
  document_officiel: "Document officiel",
  autre: "Autre",
};
const TYPE_ICONS: Record<string, React.ReactElement> = {
  manuel: <BookOpen className="h-4 w-4" />,
  fiche_cours: <FileText className="h-4 w-4" />,
  exercice: <Layers className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  document_officiel: <BookMarked className="h-4 w-4" />,
  autre: <FileText className="h-4 w-4" />,
};
const STATUT_COLORS: Record<string, string> = {
  en_attente: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  valide: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  publie: "bg-green-500/20 text-green-300 border-green-500/30",
};
const NIVEAUX = ["6eme", "5eme", "4eme", "3eme", "2nde", "1ere", "Tle"];
const LANGUES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "Anglais" },
  { value: "ar", label: "Arabe" },
];

interface FormData {
  titre: string;
  type: string;
  auteur: string;
  description: string;
  niveau: string[];
  mots_cles: string[];
  langue: string;
  fichier_url: string;
  fichier_nom: string;
  couverture_url: string;
  matiere_id: string;
}

const DEFAULT_FORM: FormData = {
  titre: "", type: "", auteur: "", description: "",
  niveau: [], mots_cles: [], langue: "fr",
  fichier_url: "", fichier_nom: "", couverture_url: "", matiere_id: "",
};

export default function DepotRessource() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [motCleInput, setMotCleInput] = useState("");

  const params = {};
  const qk = getGetBibliothequeRessourcesQueryKey(params);
  const { data, isLoading } = useGetBibliothequeRessources(params, {
    query: { queryKey: qk },
  });

  const mesRessources = (data?.ressources ?? []).filter(
    (r) => r.ajoute_par === user?.id,
  );

  const creer = usePostBibliothequeRessources({
    mutation: {
      onSuccess: () => {
        toast.success("Ressource déposée pour validation");
        qc.invalidateQueries({ queryKey: qk });
        setShowModal(false);
        setForm(DEFAULT_FORM);
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast.error(msg ?? "Erreur lors du dépôt");
      },
    },
  });

  const modifier = usePutBibliothequeRessourcesId({
    mutation: {
      onSuccess: () => {
        toast.success("Ressource mise à jour");
        qc.invalidateQueries({ queryKey: qk });
        setShowModal(false);
        setEditingId(null);
        setForm(DEFAULT_FORM);
      },
    },
  });

  const supprimer = useDeleteBibliothequeRessourcesId({
    mutation: {
      onSuccess: () => {
        toast.success("Ressource supprimée");
        qc.invalidateQueries({ queryKey: qk });
        setDeleteId(null);
      },
    },
  });

  function openEdit(r: (typeof mesRessources)[0]) {
    setEditingId(r.id ?? null);
    setForm({
      titre: r.titre ?? "",
      type: r.type ?? "",
      auteur: r.auteur ?? "",
      description: r.description ?? "",
      niveau: [...(r.niveau ?? [])],
      mots_cles: [...(r.mots_cles ?? [])],
      langue: r.langue ?? "fr",
      fichier_url: r.fichier_url ?? "",
      fichier_nom: r.fichier_nom ?? "",
      couverture_url: r.couverture_url ?? "",
      matiere_id: r.matiere_id ?? "",
    });
    setShowModal(true);
  }

  function addMotCle() {
    const kw = motCleInput.trim();
    if (kw && !form.mots_cles.includes(kw)) {
      setForm((f) => ({ ...f, mots_cles: [...f.mots_cles, kw] }));
    }
    setMotCleInput("");
  }

  function handleSubmit() {
    if (!form.titre.trim() || !form.type || !form.niveau.length || !form.fichier_url || !form.fichier_nom) {
      toast.error("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    const payload = {
      titre: form.titre,
      type: form.type as "manuel" | "fiche_cours" | "exercice" | "video" | "document_officiel" | "autre",
      auteur: form.auteur || undefined,
      description: form.description || undefined,
      niveau: form.niveau,
      mots_cles: form.mots_cles.length ? form.mots_cles : undefined,
      langue: form.langue,
      fichier_url: form.fichier_url,
      fichier_nom: form.fichier_nom,
      couverture_url: form.couverture_url || undefined,
      matiere_id: form.matiere_id || undefined,
    };
    if (editingId) {
      modifier.mutate({ id: editingId, data: payload });
    } else {
      creer.mutate({ data: payload });
    }
  }

  function getStatut(r: (typeof mesRessources)[0]) {
    if (r.publie) return "publie";
    if (r.valide) return "valide";
    return "en_attente";
  }
  function getStatutLabel(r: (typeof mesRessources)[0]) {
    const s = getStatut(r);
    return s === "publie" ? "Publié" : s === "valide" ? "Validé" : "En attente";
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-syne text-2xl font-bold text-[var(--m15-white)]">Mes dépôts</h1>
          <p className="text-[var(--m15-muted)] text-sm mt-1">Gérez vos ressources déposées dans la bibliothèque</p>
        </div>
        <Button
          onClick={() => { setEditingId(null); setForm(DEFAULT_FORM); setShowModal(true); }}
          className="bg-[#00C9A7] hover:bg-[#00b096] text-[#0A1628] font-semibold"
        >
          <Plus className="h-4 w-4 mr-2" /> Déposer une ressource
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-[var(--m15-card)] rounded-xl animate-pulse" />)}
        </div>
      ) : mesRessources.length === 0 ? (
        <div className="text-center py-20 text-[var(--m15-muted)] bg-[var(--m15-card)] rounded-xl border border-[rgba(0,201,167,0.15)]">
          <Upload className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-lg font-medium mb-1">Aucune ressource déposée</p>
          <p className="text-sm mb-4">Partagez vos cours, fiches et exercices avec vos élèves</p>
          <Button
            onClick={() => { setEditingId(null); setForm(DEFAULT_FORM); setShowModal(true); }}
            className="bg-[#00C9A7] hover:bg-[#00b096] text-[#0A1628]"
          >
            Déposer ma première ressource
          </Button>
        </div>
      ) : (
        <div className="bg-[var(--m15-card)] border border-[rgba(0,201,167,0.15)] rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[rgba(0,201,167,0.1)]">
                <th className="text-left px-4 py-3 text-xs text-[var(--m15-muted)] uppercase tracking-wide">Titre</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--m15-muted)] uppercase tracking-wide">Type</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--m15-muted)] uppercase tracking-wide">Niveaux</th>
                <th className="text-left px-4 py-3 text-xs text-[var(--m15-muted)] uppercase tracking-wide">Statut</th>
                <th className="text-right px-4 py-3 text-xs text-[var(--m15-muted)] uppercase tracking-wide">Consult.</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {mesRessources.map((r) => {
                const type = r.type ?? "autre";
                return (
                  <tr key={r.id} className="border-b border-[rgba(0,201,167,0.05)] last:border-0 hover:bg-[rgba(0,201,167,0.03)]">
                    <td className="px-4 py-3">
                      <p className="text-[var(--m15-white)] text-sm font-medium truncate max-w-[220px]">{r.titre}</p>
                      {r.auteur && <p className="text-xs text-[var(--m15-muted)]">{r.auteur}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-[var(--m15-muted)] text-sm">
                        {TYPE_ICONS[type]} {TYPE_LABELS[type]}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(r.niveau ?? []).slice(0, 3).map((n) => (
                          <span key={n} className="text-xs bg-[var(--m15-card2)] text-[var(--m15-muted)] px-1.5 py-0.5 rounded">{n}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={`text-xs border ${STATUT_COLORS[getStatut(r)]}`}>
                        {getStatutLabel(r)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[var(--m15-muted)]">{r.nb_consultations ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => navigate(`/bibliotheque/ressource/${r.id}`)}
                          className="p-1.5 text-[var(--m15-muted)] hover:text-[#00C9A7] transition-colors"
                          title="Voir"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/bibliotheque/ressource/${r.id}/stats`)}
                          className="p-1.5 text-[var(--m15-muted)] hover:text-[#F5C842] transition-colors"
                          title="Statistiques"
                        >
                          <BarChart2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(r)}
                          className="p-1.5 text-[var(--m15-muted)] hover:text-[var(--m15-white)] transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => r.id && setDeleteId(r.id)}
                          className="p-1.5 text-[var(--m15-muted)] hover:text-red-400 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal dépôt / modification */}
      <Dialog open={showModal} onOpenChange={(o) => { if (!o) { setShowModal(false); setEditingId(null); } }}>
        <DialogContent className="bg-[var(--m15-card)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-syne text-lg">
              {editingId ? "Modifier la ressource" : "Déposer une ressource"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label className="text-[var(--m15-muted)] text-xs mb-1.5">Titre <span className="text-red-400">*</span></Label>
              <Input
                value={form.titre}
                onChange={(e) => setForm((f) => ({ ...f, titre: e.target.value }))}
                placeholder="Titre de la ressource"
                className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[var(--m15-muted)] text-xs mb-1.5">Type <span className="text-red-400">*</span></Label>
                <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                  <SelectTrigger className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)]">
                    <SelectValue placeholder="Choisir un type" />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)]">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v} className="text-[var(--m15-white)] focus:bg-[var(--m15-card)]">
                        <span className="flex items-center gap-2">{TYPE_ICONS[v]} {l}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-[var(--m15-muted)] text-xs mb-1.5">Langue</Label>
                <Select value={form.langue} onValueChange={(v) => setForm((f) => ({ ...f, langue: v }))}>
                  <SelectTrigger className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)]">
                    {LANGUES.map((l) => (
                      <SelectItem key={l.value} value={l.value} className="text-[var(--m15-white)] focus:bg-[var(--m15-card)]">{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-[var(--m15-muted)] text-xs mb-1.5">Niveaux <span className="text-red-400">*</span></Label>
              <div className="flex flex-wrap gap-2">
                {NIVEAUX.map((n) => (
                  <label key={n} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={form.niveau.includes(n)}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({
                          ...f,
                          niveau: checked ? [...f.niveau, n] : f.niveau.filter((x) => x !== n),
                        }))
                      }
                      className="border-[rgba(0,201,167,0.3)] data-[state=checked]:bg-[#00C9A7] data-[state=checked]:border-[#00C9A7]"
                    />
                    <span className="text-sm text-[var(--m15-muted)]">{n}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-[var(--m15-muted)] text-xs mb-1.5">Auteur du document</Label>
              <Input
                value={form.auteur}
                onChange={(e) => setForm((f) => ({ ...f, auteur: e.target.value }))}
                placeholder="Auteur du document (optionnel)"
                className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
              />
            </div>

            <div>
              <Label className="text-[var(--m15-muted)] text-xs mb-1.5">Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description du contenu (optionnel)"
                className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] resize-none h-20"
              />
            </div>

            <div>
              <Label className="text-[var(--m15-muted)] text-xs mb-1.5">URL du fichier <span className="text-red-400">*</span></Label>
              <Input
                value={form.fichier_url}
                onChange={(e) => setForm((f) => ({ ...f, fichier_url: e.target.value }))}
                placeholder="https://drive.google.com/... ou URL directe"
                className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
              />
            </div>

            <div>
              <Label className="text-[var(--m15-muted)] text-xs mb-1.5">Nom du fichier <span className="text-red-400">*</span></Label>
              <Input
                value={form.fichier_nom}
                onChange={(e) => setForm((f) => ({ ...f, fichier_nom: e.target.value }))}
                placeholder="ex: manuel_maths_3eme.pdf"
                className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
              />
            </div>

            <div>
              <Label className="text-[var(--m15-muted)] text-xs mb-1.5">Image de couverture (optionnel)</Label>
              <Input
                value={form.couverture_url}
                onChange={(e) => setForm((f) => ({ ...f, couverture_url: e.target.value }))}
                placeholder="URL de l'image de couverture"
                className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
              />
            </div>

            <div>
              <Label className="text-[var(--m15-muted)] text-xs mb-1.5">Mots-clés</Label>
              <div className="flex gap-2 mb-2">
                <Input
                  value={motCleInput}
                  onChange={(e) => setMotCleInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMotCle(); } }}
                  placeholder="Ajouter un mot-clé (Entrée)"
                  className="bg-[var(--m15-card2)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
                <Button type="button" variant="outline" onClick={addMotCle}
                  className="border-[rgba(0,201,167,0.3)] text-[var(--m15-muted)] hover:text-[var(--m15-white)] shrink-0">
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              {form.mots_cles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.mots_cles.map((kw) => (
                    <span key={kw} className="flex items-center gap-1 text-xs bg-[var(--m15-card2)] text-[var(--m15-muted)] px-2 py-1 rounded-full border border-[rgba(0,201,167,0.2)]">
                      #{kw}
                      <button onClick={() => setForm((f) => ({ ...f, mots_cles: f.mots_cles.filter((k) => k !== kw) }))}>
                        <X className="h-3 w-3 hover:text-red-400" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowModal(false); setEditingId(null); }}
              className="border-[rgba(0,201,167,0.2)] text-[var(--m15-muted)] hover:text-[var(--m15-white)]">
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={creer.isPending || modifier.isPending}
              className="bg-[#00C9A7] hover:bg-[#00b096] text-[#0A1628] font-semibold"
            >
              {creer.isPending || modifier.isPending
                ? "Enregistrement…"
                : editingId ? "Enregistrer" : "Déposer pour validation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-[var(--m15-card)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette ressource ?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--m15-muted)]">
              Cette action est irréversible. La ressource sera retirée de la bibliothèque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[rgba(0,201,167,0.2)] text-[var(--m15-muted)] hover:text-[var(--m15-white)] bg-transparent">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && supprimer.mutate({ id: deleteId })}
              className="bg-red-500 hover:bg-red-600 text-[var(--m15-white)]"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
