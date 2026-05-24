import { useState } from "react";
import {
  useListerFeuillesHeures,
  useListerContrats,
  useValiderFeuilleHeures,
  useRejeterFeuilleHeures,
  usePayerFeuilleHeures,
  useCreerContrat,
  getListerFeuillesHeuresQueryKey,
  getListerContratsQueryKey,
  useListerTypesProfesseurs,
  useConfigurerTypeProfesseur,
  useListerUtilisateurs,
  getListerTypesProfesseursQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, X, CreditCard, Plus, Clock } from "lucide-react";

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "bg-gray-500" },
  soumise: { label: "Soumise", color: "bg-yellow-500" },
  validee: { label: "Validée", color: "bg-cyan-500" },
  payee: { label: "Payée", color: "bg-green-600" },
  rejetee: { label: "Rejetée", color: "bg-red-600" },
};
const MOIS_LABELS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function formatFCFA(n: number | string | null | undefined): string {
  const v = parseFloat(String(n ?? "0")) || 0;
  return v.toLocaleString("fr-CI") + " FCFA";
}

type Feuille = {
  id: string;
  professeur_id: string;
  mois: number;
  annee: number;
  nb_heures_effectuees: string;
  nb_heures_validees: string | null;
  montant_brut: string | null;
  montant_net: string | null;
  statut: string;
  notes_professeur: string | null;
  notes_admin: string | null;
  prof_nom: string;
  prof_prenoms: string | null;
};

type Contrat = {
  id: string;
  professeur_id: string;
  prof_nom: string;
  prof_prenoms: string | null;
  type_libelle: string;
  taux: string;
  taux_horaire_personnalise: string | null;
  nb_heures_contractuelles: string | null;
  date_debut: string;
  date_fin: string | null;
  actif: boolean;
};

type TypeProf = {
  id: string;
  libelle: string;
  taux_horaire: string;
  description: string | null;
  actif: boolean;
};

export default function GestionHonoraires() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDirecteur = user?.role === "directeur" || user?.role === "dev";

  const [filtreStatut, setFiltreStatut] = useState("all");
  const [filtreMois, setFiltreMois] = useState("all");

  const { data: rawFeuilles } = useListerFeuillesHeures({});
  const feuilles: Feuille[] = (rawFeuilles as { data?: Feuille[] })?.data ?? [];

  const feuillesFiltrees = feuilles.filter(f => {
    if (filtreStatut !== "all" && f.statut !== filtreStatut) return false;
    if (filtreMois !== "all" && String(f.mois) !== filtreMois) return false;
    return true;
  });

  const { mutate: valider, isPending: validPending } = useValiderFeuilleHeures();
  const { mutate: rejeter, isPending: rejetPending } = useRejeterFeuilleHeures();
  const { mutate: payer, isPending: payerPending } = usePayerFeuilleHeures();

  const [validerTarget, setValiderTarget] = useState<Feuille | null>(null);
  const [rejeterTarget, setRejeterTarget] = useState<Feuille | null>(null);
  const [payerTarget, setPayerTarget] = useState<Feuille | null>(null);
  const [validerForm, setValiderForm] = useState({ nb_heures_validees: "", montant_net: "", notes_admin: "" });
  const [rejeterNotes, setRejeterNotes] = useState("");
  const [payerForm, setPayerForm] = useState({ date_paiement: "", mode_paiement: "", reference_paiement: "" });

  const invalidateFeuilles = () =>
    queryClient.invalidateQueries({ queryKey: getListerFeuillesHeuresQueryKey() });

  const handleValider = () => {
    if (!validerTarget) return;
    valider(
      { id: validerTarget.id, data: { nb_heures_validees: parseFloat(validerForm.nb_heures_validees), notes_admin: validerForm.notes_admin || undefined, montant_net: validerForm.montant_net ? parseFloat(validerForm.montant_net) : undefined } },
      {
        onSuccess: () => { toast({ title: "Feuille validée." }); setValiderTarget(null); invalidateFeuilles(); },
        onError: () => toast({ title: "Erreur lors de la validation.", variant: "destructive" }),
      },
    );
  };

  const handleRejeter = () => {
    if (!rejeterTarget) return;
    rejeter(
      { id: rejeterTarget.id, data: { notes_admin: rejeterNotes } },
      {
        onSuccess: () => { toast({ title: "Feuille rejetée." }); setRejeterTarget(null); setRejeterNotes(""); invalidateFeuilles(); },
        onError: () => toast({ title: "Erreur lors du rejet.", variant: "destructive" }),
      },
    );
  };

  const handlePayer = () => {
    if (!payerTarget) return;
    payer(
      { id: payerTarget.id, data: { date_paiement: payerForm.date_paiement, mode_paiement: payerForm.mode_paiement as "virement" | "mobile_money" | "especes" | "cheque", reference_paiement: payerForm.reference_paiement || undefined } },
      {
        onSuccess: () => { toast({ title: "Paiement enregistré." }); setPayerTarget(null); setPayerForm({ date_paiement: "", mode_paiement: "", reference_paiement: "" }); invalidateFeuilles(); },
        onError: () => toast({ title: "Erreur lors du paiement.", variant: "destructive" }),
      },
    );
  };

  const { data: rawContrats } = useListerContrats({});
  const contrats: Contrat[] = (rawContrats as { data?: Contrat[] })?.data ?? [];

  const { data: rawTypes } = useListerTypesProfesseurs({});
  const types: TypeProf[] = (rawTypes as { data?: TypeProf[] })?.data ?? [];

  const { data: rawProfs } = useListerUtilisateurs({ role: "professeur" });
  const profs = (rawProfs ?? []) as Array<{ id: string; nom: string; prenoms: string | null }>;

  const { mutate: creerContrat, isPending: contratPending } = useCreerContrat();
  const [showContratModal, setShowContratModal] = useState(false);
  const [contratForm, setContratForm] = useState({
    professeur_id: "", type_professeur_id: "", annee_scolaire_id: "",
    date_debut: "", date_fin: "", nb_heures_contractuelles: "", taux_horaire_personnalise: "", notes: "",
  });

  const handleCreerContrat = () => {
    creerContrat(
      {
        data: {
          professeur_id: contratForm.professeur_id,
          type_professeur_id: contratForm.type_professeur_id,
          annee_scolaire_id: contratForm.annee_scolaire_id || "placeholder",
          date_debut: contratForm.date_debut,
          date_fin: contratForm.date_fin || undefined,
          nb_heures_contractuelles: contratForm.nb_heures_contractuelles ? parseFloat(contratForm.nb_heures_contractuelles) : undefined,
          taux_horaire_personnalise: contratForm.taux_horaire_personnalise ? parseFloat(contratForm.taux_horaire_personnalise) : undefined,
          notes: contratForm.notes || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Contrat créé." });
          setShowContratModal(false);
          queryClient.invalidateQueries({ queryKey: getListerContratsQueryKey() });
        },
        onError: () => toast({ title: "Erreur lors de la création du contrat.", variant: "destructive" }),
      },
    );
  };

  const { mutate: creerType, isPending: typePending } = useConfigurerTypeProfesseur();
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeForm, setTypeForm] = useState({ libelle: "", taux_horaire: "", description: "" });

  const handleCreerType = () => {
    creerType(
      { data: { libelle: typeForm.libelle, taux_horaire: parseFloat(typeForm.taux_horaire), description: typeForm.description || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Type créé." });
          setShowTypeModal(false);
          setTypeForm({ libelle: "", taux_horaire: "", description: "" });
          queryClient.invalidateQueries({ queryKey: getListerTypesProfesseursQueryKey() });
        },
        onError: () => toast({ title: "Erreur lors de la création du type.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
          <Clock className="h-7 w-7 text-[var(--m15-cyan)]" />
          Gestion des honoraires
        </h1>
        <p className="text-[var(--m15-muted)] text-sm mt-1">Feuilles d'heures, contrats et configuration</p>
      </div>

      <Tabs defaultValue="feuilles">
        <TabsList className="bg-[var(--m15-card)] border border-[var(--m15-border)]">
          <TabsTrigger value="feuilles" className="data-[state=active]:bg-[var(--m15-cyan)] data-[state=active]:text-[var(--m15-navy)]">Feuilles d'heures</TabsTrigger>
          <TabsTrigger value="contrats" className="data-[state=active]:bg-[var(--m15-cyan)] data-[state=active]:text-[var(--m15-navy)]">Contrats</TabsTrigger>
          {isDirecteur && (
            <TabsTrigger value="types" className="data-[state=active]:bg-[var(--m15-cyan)] data-[state=active]:text-[var(--m15-navy)]">Config types</TabsTrigger>
          )}
        </TabsList>

        {/* ── Feuilles ── */}
        <TabsContent value="feuilles" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Select value={filtreStatut} onValueChange={setFiltreStatut}>
              <SelectTrigger className="w-40 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                <SelectItem value="all" className="text-[var(--m15-white)]">Tous statuts</SelectItem>
                {Object.entries(STATUT_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-[var(--m15-white)]">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtreMois} onValueChange={setFiltreMois}>
              <SelectTrigger className="w-36 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)]">
                <SelectValue placeholder="Mois" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                <SelectItem value="all" className="text-[var(--m15-white)]">Tous mois</SelectItem>
                {MOIS_LABELS.slice(1).map((l, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)} className="text-[var(--m15-white)]">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-[var(--m15-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--m15-border)] bg-[var(--m15-card)]">
                  <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Professeur</th>
                  <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Mois</th>
                  <th className="text-right py-3 px-4 text-[var(--m15-muted)] font-medium">H. soumises</th>
                  <th className="text-right py-3 px-4 text-[var(--m15-muted)] font-medium">H. validées</th>
                  <th className="text-right py-3 px-4 text-[var(--m15-muted)] font-medium">Montant brut</th>
                  <th className="text-right py-3 px-4 text-[var(--m15-muted)] font-medium">Montant net</th>
                  <th className="text-center py-3 px-4 text-[var(--m15-muted)] font-medium">Statut</th>
                  {isDirecteur && <th className="text-center py-3 px-4 text-[var(--m15-muted)] font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {feuillesFiltrees.length === 0 ? (
                  <tr><td colSpan={8} className="text-center text-[var(--m15-muted)] py-10">Aucune feuille</td></tr>
                ) : feuillesFiltrees.map(f => (
                  <tr key={f.id} className="border-b border-[var(--m15-border)] hover:bg-[var(--elevate-1)]">
                    <td className="py-3 px-4 text-[var(--m15-white)]">{f.prof_prenoms} {f.prof_nom}</td>
                    <td className="py-3 px-4 text-[var(--m15-muted)]">{MOIS_LABELS[f.mois]} {f.annee}</td>
                    <td className="py-3 px-4 text-right text-[var(--m15-white)]">{f.nb_heures_effectuees} h</td>
                    <td className="py-3 px-4 text-right text-[var(--m15-white)]">{f.nb_heures_validees ?? "—"} h</td>
                    <td className="py-3 px-4 text-right text-[var(--m15-muted)]">{f.montant_brut ? formatFCFA(f.montant_brut) : "—"}</td>
                    <td className="py-3 px-4 text-right text-[var(--m15-white)] font-medium">{f.montant_net ? formatFCFA(f.montant_net) : "—"}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className={`${STATUT_CONFIG[f.statut]?.color ?? "bg-gray-500"} text-white text-xs`}>
                        {STATUT_CONFIG[f.statut]?.label ?? f.statut}
                      </Badge>
                    </td>
                    {isDirecteur && (
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          {f.statut === "soumise" && (
                            <>
                              <Button size="sm" variant="ghost" className="text-cyan-400 hover:text-white"
                                onClick={() => { setValiderTarget(f); setValiderForm({ nb_heures_validees: f.nb_heures_effectuees, montant_net: "", notes_admin: "" }); }}>
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" className="text-red-400 hover:text-white" onClick={() => setRejeterTarget(f)}>
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {f.statut === "validee" && (
                            <Button size="sm" variant="ghost" className="text-green-400 hover:text-white"
                              onClick={() => { setPayerTarget(f); setPayerForm({ date_paiement: new Date().toISOString().split("T")[0], mode_paiement: "", reference_paiement: "" }); }}>
                              <CreditCard className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Contrats ── */}
        <TabsContent value="contrats" className="mt-4 space-y-4">
          {isDirecteur && (
            <Button className="bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold" onClick={() => setShowContratModal(true)}>
              <Plus className="h-4 w-4 mr-2" /> Nouveau contrat
            </Button>
          )}
          <div className="rounded-xl border border-[var(--m15-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--m15-border)] bg-[var(--m15-card)]">
                  <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Professeur</th>
                  <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Type</th>
                  <th className="text-right py-3 px-4 text-[var(--m15-muted)] font-medium">Taux/h</th>
                  <th className="text-right py-3 px-4 text-[var(--m15-muted)] font-medium">H. contractuelles</th>
                  <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Période</th>
                  <th className="text-center py-3 px-4 text-[var(--m15-muted)] font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {contrats.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-[var(--m15-muted)] py-10">Aucun contrat</td></tr>
                ) : contrats.map(c => (
                  <tr key={c.id} className="border-b border-[var(--m15-border)] hover:bg-[var(--elevate-1)]">
                    <td className="py-3 px-4 text-[var(--m15-white)]">{c.prof_prenoms} {c.prof_nom}</td>
                    <td className="py-3 px-4 text-[var(--m15-muted)]">{c.type_libelle}</td>
                    <td className="py-3 px-4 text-right text-[var(--m15-white)]">{formatFCFA(c.taux_horaire_personnalise ?? c.taux)}</td>
                    <td className="py-3 px-4 text-right text-[var(--m15-muted)]">{c.nb_heures_contractuelles ?? "—"} h</td>
                    <td className="py-3 px-4 text-[var(--m15-muted)]">{c.date_debut} → {c.date_fin ?? "indéterminé"}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className={c.actif ? "bg-green-600 text-white" : "bg-gray-500 text-white"}>
                        {c.actif ? "Actif" : "Inactif"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Config types ── */}
        {isDirecteur && (
          <TabsContent value="types" className="mt-4 space-y-4">
            <Button className="bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold" onClick={() => setShowTypeModal(true)}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter un type
            </Button>
            <div className="rounded-xl border border-[var(--m15-border)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--m15-border)] bg-[var(--m15-card)]">
                    <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Libellé</th>
                    <th className="text-right py-3 px-4 text-[var(--m15-muted)] font-medium">Taux horaire</th>
                    <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Description</th>
                    <th className="text-center py-3 px-4 text-[var(--m15-muted)] font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {types.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-[var(--m15-muted)] py-10">Aucun type configuré</td></tr>
                  ) : types.map(t => (
                    <tr key={t.id} className="border-b border-[var(--m15-border)] hover:bg-[var(--elevate-1)]">
                      <td className="py-3 px-4 text-[var(--m15-white)] font-medium">{t.libelle}</td>
                      <td className="py-3 px-4 text-right" style={{ color: "#F5C842" }}>{formatFCFA(t.taux_horaire)}/h</td>
                      <td className="py-3 px-4 text-[var(--m15-muted)]">{t.description ?? "—"}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={t.actif ? "bg-green-600 text-white" : "bg-gray-500 text-white"}>
                          {t.actif ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Modale Valider ── */}
      <Dialog open={!!validerTarget} onOpenChange={o => { if (!o) setValiderTarget(null); }}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <DialogHeader><DialogTitle className="text-[var(--m15-white)]">Valider la feuille d'heures</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Heures validées</Label>
              <Input type="number" value={validerForm.nb_heures_validees}
                onChange={e => setValiderForm(f => ({ ...f, nb_heures_validees: e.target.value }))}
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Montant net (optionnel)</Label>
              <Input type="number" value={validerForm.montant_net}
                onChange={e => setValiderForm(f => ({ ...f, montant_net: e.target.value }))}
                placeholder="Calculé automatiquement si vide"
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Notes admin</Label>
              <Textarea value={validerForm.notes_admin}
                onChange={e => setValiderForm(f => ({ ...f, notes_admin: e.target.value }))} rows={2}
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={() => setValiderTarget(null)}>Annuler</Button>
            <Button className="bg-[var(--m15-cyan)] text-[var(--m15-navy)]" onClick={handleValider} disabled={validPending}>
              {validPending ? "Validation…" : "Valider"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale Rejeter ── */}
      <Dialog open={!!rejeterTarget} onOpenChange={o => { if (!o) setRejeterTarget(null); }}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <DialogHeader><DialogTitle className="text-[var(--m15-white)]">Rejeter la feuille</DialogTitle></DialogHeader>
          <div>
            <Label className="text-[var(--m15-muted)] text-xs uppercase">Motif du rejet (obligatoire)</Label>
            <Textarea value={rejeterNotes} onChange={e => setRejeterNotes(e.target.value)} rows={3}
              placeholder="Expliquez le motif du rejet…"
              className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] resize-none" />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={() => setRejeterTarget(null)}>Annuler</Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleRejeter} disabled={rejetPending || !rejeterNotes}>
              {rejetPending ? "Rejet…" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale Payer ── */}
      <Dialog open={!!payerTarget} onOpenChange={o => { if (!o) setPayerTarget(null); }}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <DialogHeader><DialogTitle className="text-[var(--m15-white)]">Enregistrer le paiement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Date de paiement</Label>
              <Input type="date" value={payerForm.date_paiement}
                onChange={e => setPayerForm(f => ({ ...f, date_paiement: e.target.value }))}
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Mode de paiement</Label>
              <Select value={payerForm.mode_paiement} onValueChange={v => setPayerForm(f => ({ ...f, mode_paiement: v }))}>
                <SelectTrigger className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {["virement", "mobile_money", "especes", "cheque"].map(m => (
                    <SelectItem key={m} value={m} className="text-[var(--m15-white)]">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Référence (optionnel)</Label>
              <Input value={payerForm.reference_paiement}
                onChange={e => setPayerForm(f => ({ ...f, reference_paiement: e.target.value }))}
                placeholder="N° de transaction…"
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={() => setPayerTarget(null)}>Annuler</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handlePayer}
              disabled={payerPending || !payerForm.date_paiement || !payerForm.mode_paiement}>
              {payerPending ? "Enregistrement…" : "Marquer payée"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale Nouveau contrat ── */}
      <Dialog open={showContratModal} onOpenChange={setShowContratModal}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)] max-w-lg">
          <DialogHeader><DialogTitle className="text-[var(--m15-white)]">Nouveau contrat professeur</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Professeur</Label>
              <Select value={contratForm.professeur_id} onValueChange={v => setContratForm(f => ({ ...f, professeur_id: v }))}>
                <SelectTrigger className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Sélectionner un professeur…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {profs.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-[var(--m15-white)]">{p.prenoms} {p.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Type de professeur</Label>
              <Select value={contratForm.type_professeur_id} onValueChange={v => setContratForm(f => ({ ...f, type_professeur_id: v }))}>
                <SelectTrigger className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Sélectionner un type…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {types.map(t => (
                    <SelectItem key={t.id} value={t.id} className="text-[var(--m15-white)]">{t.libelle} — {formatFCFA(t.taux_horaire)}/h</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[var(--m15-muted)] text-xs uppercase">Date début</Label>
                <Input type="date" value={contratForm.date_debut}
                  onChange={e => setContratForm(f => ({ ...f, date_debut: e.target.value }))}
                  className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
              </div>
              <div>
                <Label className="text-[var(--m15-muted)] text-xs uppercase">Date fin (optionnel)</Label>
                <Input type="date" value={contratForm.date_fin}
                  onChange={e => setContratForm(f => ({ ...f, date_fin: e.target.value }))}
                  className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[var(--m15-muted)] text-xs uppercase">H. contractuelles</Label>
                <Input type="number" value={contratForm.nb_heures_contractuelles}
                  onChange={e => setContratForm(f => ({ ...f, nb_heures_contractuelles: e.target.value }))}
                  placeholder="0"
                  className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
              </div>
              <div>
                <Label className="text-[var(--m15-muted)] text-xs uppercase">Taux personnalisé (FCFA/h)</Label>
                <Input type="number" value={contratForm.taux_horaire_personnalise}
                  onChange={e => setContratForm(f => ({ ...f, taux_horaire_personnalise: e.target.value }))}
                  placeholder="Laisser vide = taux type"
                  className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={() => setShowContratModal(false)}>Annuler</Button>
            <Button className="bg-[var(--m15-cyan)] text-[var(--m15-navy)]" onClick={handleCreerContrat} disabled={contratPending}>
              {contratPending ? "Création…" : "Créer le contrat"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale Nouveau type ── */}
      <Dialog open={showTypeModal} onOpenChange={setShowTypeModal}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <DialogHeader><DialogTitle className="text-[var(--m15-white)]">Nouveau type de professeur</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Libellé</Label>
              <Input value={typeForm.libelle} onChange={e => setTypeForm(f => ({ ...f, libelle: e.target.value }))}
                placeholder="ex: Vacataire"
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Taux horaire (FCFA)</Label>
              <Input type="number" value={typeForm.taux_horaire}
                onChange={e => setTypeForm(f => ({ ...f, taux_horaire: e.target.value }))}
                placeholder="ex: 5000"
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Description (optionnel)</Label>
              <Textarea value={typeForm.description} onChange={e => setTypeForm(f => ({ ...f, description: e.target.value }))} rows={2}
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={() => setShowTypeModal(false)}>Annuler</Button>
            <Button className="bg-[var(--m15-cyan)] text-[var(--m15-navy)]" onClick={handleCreerType} disabled={typePending}>
              {typePending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
