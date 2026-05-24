import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetCriteres,
  useConfigurerCriteres,
  useListerAnneesScolaires,
  useListerClasses,
  getGetCriteresQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Settings, Plus, Save } from "lucide-react";

interface Critere {
  id?: string;
  classe_id?: string | null;
  moyenne_admission: string;
  nb_matieres_eliminatoires_max: number;
  moyenne_eliminatoire?: string | null;
  conseil_obligatoire: boolean;
  notes_criteres?: string | null;
}

export default function ConfigurationCriteres() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [anneeId, setAnneeId] = useState("");
  const [globalForm, setGlobalForm] = useState<Critere>({
    moyenne_admission: "10.00",
    nb_matieres_eliminatoires_max: 0,
    moyenne_eliminatoire: "5.00",
    conseil_obligatoire: true,
    notes_criteres: "",
  });
  const [classeModal, setClasseModal] = useState(false);
  const [selectedClasse, setSelectedClasse] = useState<string>("");
  const [classeForm, setClasseForm] = useState<Critere>({
    moyenne_admission: "10.00",
    nb_matieres_eliminatoires_max: 0,
    moyenne_eliminatoire: "5.00",
    conseil_obligatoire: true,
    notes_criteres: "",
  });

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { data?: { annees?: Array<{ id: string; libelle: string; est_active: boolean }> } })?.data?.annees ?? [];
  const anneeActive = annees.find(a => a.est_active);
  const selectedAnnee = anneeId || anneeActive?.id || "";

  const { data: classesData } = useListerClasses();
  const classes = (classesData as { data?: { classes?: Array<{ id: string; nom: string }> } })?.data?.classes ?? [];

  const { data: criteresData, refetch } = useGetCriteres(
    { annee_scolaire_id: selectedAnnee },
    { query: { enabled: !!selectedAnnee, queryKey: getGetCriteresQueryKey({ annee_scolaire_id: selectedAnnee }) } }
  );
  const criteres = (criteresData as { data?: { global?: Critere | null; par_classe?: (Critere & { id: string })[] } })?.data;

  useEffect(() => {
    if (criteres?.global) {
      setGlobalForm({
        moyenne_admission: criteres.global.moyenne_admission ?? "10.00",
        nb_matieres_eliminatoires_max: criteres.global.nb_matieres_eliminatoires_max ?? 0,
        moyenne_eliminatoire: criteres.global.moyenne_eliminatoire ?? "5.00",
        conseil_obligatoire: criteres.global.conseil_obligatoire ?? true,
        notes_criteres: criteres.global.notes_criteres ?? "",
      });
    }
  }, [criteres]);

  const { mutate: configurerCriteres, isPending } = useConfigurerCriteres({
    mutation: {
      onSuccess: () => {
        toast({ title: "Critères enregistrés", description: "Les critères ont été mis à jour." });
        qc.invalidateQueries({ queryKey: getGetCriteresQueryKey({ annee_scolaire_id: selectedAnnee }) });
        setClasseModal(false);
      },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    },
  });

  const saveGlobal = () => {
    if (!selectedAnnee) return;
    configurerCriteres({
      data: {
        annee_scolaire_id: selectedAnnee,
        classe_id: null,
        moyenne_admission: parseFloat(globalForm.moyenne_admission),
        nb_matieres_eliminatoires_max: globalForm.nb_matieres_eliminatoires_max,
        moyenne_eliminatoire: globalForm.moyenne_eliminatoire ? parseFloat(globalForm.moyenne_eliminatoire) : null,
        conseil_obligatoire: globalForm.conseil_obligatoire,
        notes_criteres: globalForm.notes_criteres || null,
      },
    });
  };

  const saveClasse = () => {
    if (!selectedAnnee || !selectedClasse) return;
    configurerCriteres({
      data: {
        annee_scolaire_id: selectedAnnee,
        classe_id: selectedClasse,
        moyenne_admission: parseFloat(classeForm.moyenne_admission),
        nb_matieres_eliminatoires_max: classeForm.nb_matieres_eliminatoires_max,
        moyenne_eliminatoire: classeForm.moyenne_eliminatoire ? parseFloat(classeForm.moyenne_eliminatoire) : null,
        conseil_obligatoire: classeForm.conseil_obligatoire,
        notes_criteres: classeForm.notes_criteres || null,
      },
    });
  };

  const openClasseModal = (classeId: string) => {
    setSelectedClasse(classeId);
    const existing = criteres?.par_classe?.find(c => c.classe_id === classeId);
    if (existing) {
      setClasseForm({
        moyenne_admission: existing.moyenne_admission ?? "10.00",
        nb_matieres_eliminatoires_max: existing.nb_matieres_eliminatoires_max ?? 0,
        moyenne_eliminatoire: existing.moyenne_eliminatoire ?? "5.00",
        conseil_obligatoire: existing.conseil_obligatoire ?? true,
        notes_criteres: existing.notes_criteres ?? "",
      });
    } else {
      setClasseForm({ ...globalForm });
    }
    setClasseModal(true);
  };

  const CritereForm = ({ form, setForm }: { form: Critere; setForm: (f: Critere) => void }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1">
        <Label className="text-[#5A6B8C] dark:text-[#8B9DC3] text-xs">Moyenne d'admission (/20)</Label>
        <Input
          type="number" step="0.5" min="0" max="20"
          value={form.moyenne_admission}
          onChange={e => setForm({ ...form, moyenne_admission: e.target.value })}
          className="bg-[#F0F4FF] dark:bg-[#0A1628] border-[rgba(0,0,0,0.12)] dark:border-[rgba(0,201,167,0.2)] text-[#0A1628] dark:text-white"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[#5A6B8C] dark:text-[#8B9DC3] text-xs">Moyenne éliminatoire (/20)</Label>
        <Input
          type="number" step="0.5" min="0" max="20"
          value={form.moyenne_eliminatoire ?? ""}
          onChange={e => setForm({ ...form, moyenne_eliminatoire: e.target.value })}
          className="bg-[#F0F4FF] dark:bg-[#0A1628] border-[rgba(0,0,0,0.12)] dark:border-[rgba(0,201,167,0.2)] text-[#0A1628] dark:text-white"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[#5A6B8C] dark:text-[#8B9DC3] text-xs">Nb max matières éliminatoires</Label>
        <Input
          type="number" min="0" max="10"
          value={form.nb_matieres_eliminatoires_max}
          onChange={e => setForm({ ...form, nb_matieres_eliminatoires_max: parseInt(e.target.value) || 0 })}
          className="bg-[#F0F4FF] dark:bg-[#0A1628] border-[rgba(0,0,0,0.12)] dark:border-[rgba(0,201,167,0.2)] text-[#0A1628] dark:text-white"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-[#5A6B8C] dark:text-[#8B9DC3] text-xs">Conseil de classe obligatoire</Label>
        <Select
          value={form.conseil_obligatoire ? "oui" : "non"}
          onValueChange={v => setForm({ ...form, conseil_obligatoire: v === "oui" })}
        >
          <SelectTrigger className="bg-[#F0F4FF] dark:bg-[#0A1628] border-[rgba(0,0,0,0.12)] dark:border-[rgba(0,201,167,0.2)] text-[#0A1628] dark:text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-white dark:bg-[#111E35] border-[rgba(0,0,0,0.08)] dark:border-[rgba(0,201,167,0.15)]">
            <SelectItem value="oui" className="text-[#0A1628] dark:text-white">Oui</SelectItem>
            <SelectItem value="non" className="text-[#0A1628] dark:text-white">Non</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="md:col-span-2 space-y-1">
        <Label className="text-[#5A6B8C] dark:text-[#8B9DC3] text-xs">Notes / remarques</Label>
        <Textarea
          value={form.notes_criteres ?? ""}
          onChange={e => setForm({ ...form, notes_criteres: e.target.value })}
          className="bg-[#F0F4FF] dark:bg-[#0A1628] border-[rgba(0,0,0,0.12)] dark:border-[rgba(0,201,167,0.2)] text-[#0A1628] dark:text-white resize-none"
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F0F4FF] dark:bg-[#0A1628] text-[#0A1628] dark:text-white p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/cloture")} className="text-[#5A6B8C] dark:text-[#8B9DC3] hover:text-[#0A1628] dark:hover:text-[#0A1628] dark:text-white">
          <ArrowLeft className="w-4 h-4 mr-1" /> Retour
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-[#0A1628] dark:text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
            Critères d'admission
          </h1>
          <p className="text-[#5A6B8C] dark:text-[#8B9DC3] text-sm">Définissez les seuils de passage</p>
        </div>
        <div className="ml-auto">
          <Select value={selectedAnnee} onValueChange={setAnneeId}>
            <SelectTrigger className="w-48 bg-white dark:bg-[#111E35] border-[rgba(0,0,0,0.08)] dark:border-[rgba(0,201,167,0.15)] text-[#0A1628] dark:text-white">
              <SelectValue placeholder="Année scolaire" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-[#111E35] border-[rgba(0,0,0,0.08)] dark:border-[rgba(0,201,167,0.15)]">
              {annees.map(a => (
                <SelectItem key={a.id} value={a.id} className="text-[#0A1628] dark:text-white">{a.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Critères globaux */}
      <Card className="bg-white dark:bg-[#111E35] border-[rgba(0,0,0,0.08)] dark:border-[rgba(0,201,167,0.15)] mb-6">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings className="w-5 h-5 text-[#00C9A7]" />
            <h2 className="font-bold text-[#0A1628] dark:text-white text-lg">Critères globaux</h2>
            <Badge className="bg-[#0080FF]/20 text-[#0080FF] border border-[#0080FF]/30 text-xs ml-1">
              Appliqués à toutes les classes par défaut
            </Badge>
          </div>
          <CritereForm form={globalForm} setForm={setGlobalForm} />
          <Button
            onClick={saveGlobal}
            disabled={!selectedAnnee || isPending}
            className="mt-4 bg-[#00C9A7] hover:bg-[#00C9A7]/80 text-[#0A1628] font-semibold"
          >
            <Save className="w-4 h-4 mr-2" />
            Enregistrer les critères globaux
          </Button>
        </CardContent>
      </Card>

      {/* Critères par classe */}
      <Card className="bg-white dark:bg-[#111E35] border-[rgba(0,0,0,0.08)] dark:border-[rgba(0,201,167,0.15)]">
        <CardContent className="p-6">
          <h2 className="font-bold text-[#0A1628] dark:text-white text-lg mb-4">Critères par classe</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#5A6B8C] dark:text-[#8B9DC3] text-xs border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(0,201,167,0.10)]">
                  <th className="text-left p-3">Classe</th>
                  <th className="text-center p-3">Moy. admission</th>
                  <th className="text-center p-3">Moy. élim.</th>
                  <th className="text-center p-3">Critère spécifique</th>
                  <th className="text-center p-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const specifique = criteres?.par_classe?.find(p => p.classe_id === c.id);
                  return (
                    <tr key={c.id} className="border-b border-[rgba(0,0,0,0.04)] dark:border-[rgba(0,201,167,0.07)] hover:bg-[#E0E8F8] dark:hover:bg-[#F0F4FF] dark:bg-[#0A1628]/40">
                      <td className="p-3 font-medium text-[#0A1628] dark:text-white">{c.nom}</td>
                      <td className="text-center p-3 text-[#00C9A7]">
                        {specifique?.moyenne_admission ?? globalForm.moyenne_admission}
                      </td>
                      <td className="text-center p-3 text-[#5A6B8C] dark:text-[#8B9DC3]">
                        {specifique?.moyenne_eliminatoire ?? globalForm.moyenne_eliminatoire ?? "5.00"}
                      </td>
                      <td className="text-center p-3">
                        {specifique ? (
                          <Badge className="bg-[#F5C842]/20 text-[#F5C842] border border-[#F5C842]/30 text-xs">Personnalisé</Badge>
                        ) : (
                          <span className="text-[#5A6B8C] dark:text-[#8B9DC3] text-xs">Global</span>
                        )}
                      </td>
                      <td className="text-center p-3">
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => openClasseModal(c.id)}
                          className="text-[#00C9A7] hover:bg-[#00C9A7]/10 text-xs"
                        >
                          <Plus className="w-3 h-3 mr-1" /> Personnaliser
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal personnalisation classe */}
      <Dialog open={classeModal} onOpenChange={setClasseModal}>
        <DialogContent className="bg-white dark:bg-[#111E35] border-[rgba(0,0,0,0.08)] dark:border-[rgba(0,201,167,0.15)] text-[#0A1628] dark:text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[#0A1628] dark:text-white">
              Critères — {classes.find(c => c.id === selectedClasse)?.nom}
            </DialogTitle>
          </DialogHeader>
          <p className="text-[#5A6B8C] dark:text-[#8B9DC3] text-sm mb-4">Ces critères remplacent les critères globaux pour cette classe.</p>
          <CritereForm form={classeForm} setForm={setClasseForm} />
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setClasseModal(false)} className="text-[#5A6B8C] dark:text-[#8B9DC3]">Annuler</Button>
            <Button onClick={saveClasse} disabled={isPending} className="bg-[#00C9A7] text-[#0A1628] font-semibold">
              <Save className="w-4 h-4 mr-2" /> Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
