import { useState } from "react";
import {
  useListerPrestations,
  useListerFactures,
  useEmettreFacture,
  usePayerFacturePrestation,
  useAnnulerFacture,
  useConfigurerPrestation,
  useListerUtilisateurs,
  getListerFacturesQueryKey,
  getListerPrestationsQueryKey,
  useGetRecapPrestations,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, CreditCard, X, Receipt } from "lucide-react";

const CATEGORIE_COLORS: Record<string, string> = {
  sortie: "bg-blue-600",
  document: "bg-purple-600",
  club: "bg-orange-500",
  autre: "bg-gray-500",
};

const STATUT_COLORS: Record<string, { color: string; label: string }> = {
  en_attente: { color: "bg-yellow-500", label: "En attente" },
  paye: { color: "bg-green-600", label: "Payé" },
  annule: { color: "bg-gray-500", label: "Annulé" },
};

function formatFCFA(n: number | string | null | undefined): string {
  const v = parseFloat(String(n ?? "0")) || 0;
  return v.toLocaleString("fr-CI") + " FCFA";
}

type Prestation = {
  id: string;
  libelle: string;
  categorie: string;
  montant: string;
  description: string | null;
  actif: boolean;
};

type Facture = {
  id: string;
  eleve_id: string;
  eleve_nom: string;
  eleve_prenoms: string | null;
  prestation_libelle: string;
  prestation_categorie: string;
  montant: string;
  statut: string;
  date_emission: string;
  date_paiement: string | null;
  mode_paiement: string | null;
  reference_paiement: string | null;
  note: string | null;
};

type RecapCat = {
  categorie: string;
  nb_factures: number;
  montant_paye: number;
  montant_en_attente: number;
  montant_total: number;
};

const MOIS_LABELS = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

export default function GestionPrestations() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDirecteur = user?.role === "directeur" || user?.role === "dev";

  const now = new Date();
  const [recapMois, setRecapMois] = useState(String(now.getMonth() + 1));

  /* ── Données ── */
  const { data: rawPrestations } = useListerPrestations({});
  const prestations: Prestation[] = (rawPrestations as { data?: Prestation[] })?.data ?? [];

  const { data: rawFactures } = useListerFactures({});
  const factures: Facture[] = (rawFactures as { data?: Facture[] })?.data ?? [];

  const { data: rawRecap } = useGetRecapPrestations({ mois: parseInt(recapMois), annee: now.getFullYear() });
  const recap: RecapCat[] = (rawRecap as { data?: { recap?: RecapCat[]; total_encaisse?: number } })?.data?.recap ?? [];
  const totalEncaisse = (rawRecap as { data?: { total_encaisse?: number } })?.data?.total_encaisse ?? 0;

  const { data: rawEleves } = useListerUtilisateurs({ role: "eleve" });
  const eleves = (rawEleves ?? []) as Array<{ id: string; nom: string; prenoms: string | null }>;

  /* ── Mutations ── */
  const { mutate: emettre, isPending: emettreP } = useEmettreFacture();
  const { mutate: payerFacture, isPending: payerP } = usePayerFacturePrestation();
  const { mutate: annuler, isPending: annulerP } = useAnnulerFacture();
  const { mutate: creerPrestation, isPending: creerP } = useConfigurerPrestation();

  const invalidateFactures = () => queryClient.invalidateQueries({ queryKey: getListerFacturesQueryKey() });

  /* ── Modales ── */
  const [showEmettreModal, setShowEmettreModal] = useState(false);
  const [emettreForm, setEmettreForm] = useState({ prestation_id: "", eleve_id: "", annee_scolaire_id: "", note: "" });

  const [payerTarget, setPayerTarget] = useState<Facture | null>(null);
  const [payerForm, setPayerForm] = useState({ date_paiement: "", mode_paiement: "", reference_paiement: "" });

  const [showPrestationModal, setShowPrestationModal] = useState(false);
  const [prestationForm, setPrestationForm] = useState({ libelle: "", categorie: "", montant: "", description: "" });

  const [filtreStatut, setFiltreStatut] = useState("all");

  const facturesFiltrees = factures.filter(f => filtreStatut === "all" || f.statut === filtreStatut);

  const selectedPrestation = prestations.find(p => p.id === emettreForm.prestation_id);

  const handleEmettre = () => {
    emettre(
      { data: { prestation_id: emettreForm.prestation_id, eleve_id: emettreForm.eleve_id, annee_scolaire_id: emettreForm.annee_scolaire_id || "placeholder", note: emettreForm.note || undefined } },
      {
        onSuccess: () => { toast({ title: "Facture émise." }); setShowEmettreModal(false); invalidateFactures(); },
        onError: () => toast({ title: "Erreur lors de l'émission.", variant: "destructive" }),
      },
    );
  };

  const handlePayer = () => {
    if (!payerTarget) return;
    payerFacture(
      { id: payerTarget.id, data: { date_paiement: payerForm.date_paiement, mode_paiement: payerForm.mode_paiement as "especes" | "mobile_money" | "virement" | "cheque", reference_paiement: payerForm.reference_paiement || undefined } },
      {
        onSuccess: () => { toast({ title: "Paiement enregistré." }); setPayerTarget(null); invalidateFactures(); },
        onError: () => toast({ title: "Erreur lors du paiement.", variant: "destructive" }),
      },
    );
  };

  const handleAnnuler = (id: string) => {
    annuler(
      { id },
      {
        onSuccess: () => { toast({ title: "Facture annulée." }); invalidateFactures(); },
        onError: () => toast({ title: "Erreur lors de l'annulation.", variant: "destructive" }),
      },
    );
  };

  const handleCreerPrestation = () => {
    creerPrestation(
      { data: { libelle: prestationForm.libelle, categorie: prestationForm.categorie as "sortie" | "document" | "club" | "autre", montant: parseFloat(prestationForm.montant), description: prestationForm.description || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Prestation créée." });
          setShowPrestationModal(false);
          setPrestationForm({ libelle: "", categorie: "", montant: "", description: "" });
          queryClient.invalidateQueries({ queryKey: getListerPrestationsQueryKey() });
        },
        onError: () => toast({ title: "Erreur lors de la création.", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
          <Receipt className="h-7 w-7 text-[var(--m15-cyan)]" />
          Gestion des prestations
        </h1>
        <p className="text-[var(--m15-muted)] text-sm mt-1">Facturation des services annexes</p>
      </div>

      <Tabs defaultValue="factures">
        <TabsList className="bg-[var(--m15-card)] border border-[var(--m15-border)]">
          <TabsTrigger value="factures" className="data-[state=active]:bg-[var(--m15-cyan)] data-[state=active]:text-[var(--m15-navy)]">Factures</TabsTrigger>
          <TabsTrigger value="recap" className="data-[state=active]:bg-[var(--m15-cyan)] data-[state=active]:text-[var(--m15-navy)]">Récapitulatif</TabsTrigger>
          {isDirecteur && <TabsTrigger value="config" className="data-[state=active]:bg-[var(--m15-cyan)] data-[state=active]:text-[var(--m15-navy)]">Configuration</TabsTrigger>}
        </TabsList>

        {/* ── Factures ── */}
        <TabsContent value="factures" className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button className="bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold" onClick={() => setShowEmettreModal(true)}>
              <Plus className="h-4 w-4 mr-2" /> Émettre une facture
            </Button>
            <Select value={filtreStatut} onValueChange={setFiltreStatut}>
              <SelectTrigger className="w-40 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)]">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                <SelectItem value="all" className="text-[var(--m15-white)]">Tous statuts</SelectItem>
                {Object.entries(STATUT_COLORS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="text-[var(--m15-white)]">{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border border-[var(--m15-border)] overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--m15-border)] bg-[var(--m15-card)]">
                  <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Élève</th>
                  <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Prestation</th>
                  <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Catégorie</th>
                  <th className="text-right py-3 px-4 text-[var(--m15-muted)] font-medium">Montant</th>
                  <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Date</th>
                  <th className="text-center py-3 px-4 text-[var(--m15-muted)] font-medium">Statut</th>
                  <th className="text-center py-3 px-4 text-[var(--m15-muted)] font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {facturesFiltrees.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-[var(--m15-muted)] py-10">Aucune facture</td></tr>
                ) : facturesFiltrees.map(f => (
                  <tr key={f.id} className="border-b border-[var(--m15-border)] hover:bg-[var(--elevate-1)]">
                    <td className="py-3 px-4 text-[var(--m15-white)]">{f.eleve_prenoms} {f.eleve_nom}</td>
                    <td className="py-3 px-4 text-[var(--m15-muted)]">{f.prestation_libelle}</td>
                    <td className="py-3 px-4">
                      <Badge className={`${CATEGORIE_COLORS[f.prestation_categorie] ?? "bg-gray-500"} text-white text-xs`}>{f.prestation_categorie}</Badge>
                    </td>
                    <td className="py-3 px-4 text-right text-[var(--m15-white)] font-medium">{formatFCFA(f.montant)}</td>
                    <td className="py-3 px-4 text-[var(--m15-muted)]">{f.date_emission}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge className={`${STATUT_COLORS[f.statut]?.color ?? "bg-gray-500"} text-white text-xs`}>
                        {STATUT_COLORS[f.statut]?.label ?? f.statut}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {f.statut === "en_attente" && (
                          <>
                            <Button size="sm" variant="ghost" className="text-green-400 hover:text-white" title="Enregistrer paiement"
                              onClick={() => { setPayerTarget(f); setPayerForm({ date_paiement: new Date().toISOString().split("T")[0], mode_paiement: "", reference_paiement: "" }); }}>
                              <CreditCard className="h-4 w-4" />
                            </Button>
                            {isDirecteur && (
                              <Button size="sm" variant="ghost" className="text-red-400 hover:text-white" title="Annuler" onClick={() => handleAnnuler(f.id)} disabled={annulerP}>
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── Récapitulatif ── */}
        <TabsContent value="recap" className="mt-4 space-y-4">
          <div className="flex items-center gap-3">
            <Select value={recapMois} onValueChange={setRecapMois}>
              <SelectTrigger className="w-40 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                {MOIS_LABELS.slice(1).map((l, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)} className="text-[var(--m15-white)]">{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[var(--m15-muted)] text-sm">Total encaissé : <span className="text-[var(--m15-cyan)] font-bold">{formatFCFA(totalEncaisse)}</span></p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recap.map(r => (
              <Card key={r.categorie} className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Badge className={`${CATEGORIE_COLORS[r.categorie] ?? "bg-gray-500"} text-white text-xs`}>{r.categorie}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--m15-muted)]">Factures</span>
                    <span className="text-[var(--m15-white)]">{r.nb_factures}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--m15-muted)]">Payé</span>
                    <span className="text-green-400">{formatFCFA(r.montant_paye)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--m15-muted)]">En attente</span>
                    <span className="text-yellow-400">{formatFCFA(r.montant_en_attente)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* ── Configuration ── */}
        {isDirecteur && (
          <TabsContent value="config" className="mt-4 space-y-4">
            <Button className="bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold" onClick={() => setShowPrestationModal(true)}>
              <Plus className="h-4 w-4 mr-2" /> Ajouter une prestation
            </Button>
            <div className="rounded-xl border border-[var(--m15-border)] overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--m15-border)] bg-[var(--m15-card)]">
                    <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Libellé</th>
                    <th className="text-left py-3 px-4 text-[var(--m15-muted)] font-medium">Catégorie</th>
                    <th className="text-right py-3 px-4 text-[var(--m15-muted)] font-medium">Montant</th>
                    <th className="text-center py-3 px-4 text-[var(--m15-muted)] font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {prestations.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-[var(--m15-muted)] py-10">Aucune prestation configurée</td></tr>
                  ) : prestations.map(p => (
                    <tr key={p.id} className="border-b border-[var(--m15-border)] hover:bg-[var(--elevate-1)]">
                      <td className="py-3 px-4 text-[var(--m15-white)] font-medium">{p.libelle}</td>
                      <td className="py-3 px-4">
                        <Badge className={`${CATEGORIE_COLORS[p.categorie] ?? "bg-gray-500"} text-white text-xs`}>{p.categorie}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right" style={{ color: "#F5C842" }}>{formatFCFA(p.montant)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={p.actif ? "bg-green-600 text-white" : "bg-gray-500 text-white"}>{p.actif ? "Actif" : "Inactif"}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* ── Modale Émettre facture ── */}
      <Dialog open={showEmettreModal} onOpenChange={setShowEmettreModal}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <DialogHeader><DialogTitle className="text-[var(--m15-white)]">Émettre une facture</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Prestation</Label>
              <Select value={emettreForm.prestation_id} onValueChange={v => setEmettreForm(f => ({ ...f, prestation_id: v }))}>
                <SelectTrigger className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {prestations.filter(p => p.actif).map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-[var(--m15-white)]">
                      {p.libelle} — {formatFCFA(p.montant)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPrestation && (
                <p className="text-[var(--m15-gold)] text-sm mt-1">Montant : {formatFCFA(selectedPrestation.montant)}</p>
              )}
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Élève</Label>
              <Select value={emettreForm.eleve_id} onValueChange={v => setEmettreForm(f => ({ ...f, eleve_id: v }))}>
                <SelectTrigger className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Rechercher un élève…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {eleves.map(e => (
                    <SelectItem key={e.id} value={e.id} className="text-[var(--m15-white)]">{e.prenoms} {e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Note (optionnel)</Label>
              <Textarea value={emettreForm.note} onChange={e => setEmettreForm(f => ({ ...f, note: e.target.value }))} rows={2}
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={() => setShowEmettreModal(false)}>Annuler</Button>
            <Button className="bg-[var(--m15-cyan)] text-[var(--m15-navy)]" onClick={handleEmettre} disabled={emettreP || !emettreForm.prestation_id || !emettreForm.eleve_id}>
              {emettreP ? "Émission…" : "Émettre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale Payer facture ── */}
      <Dialog open={!!payerTarget} onOpenChange={o => { if (!o) setPayerTarget(null); }}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <DialogHeader><DialogTitle className="text-[var(--m15-white)]">Enregistrer le paiement</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Date de paiement</Label>
              <Input type="date" value={payerForm.date_paiement} onChange={e => setPayerForm(f => ({ ...f, date_paiement: e.target.value }))}
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Mode de paiement</Label>
              <Select value={payerForm.mode_paiement} onValueChange={v => setPayerForm(f => ({ ...f, mode_paiement: v }))}>
                <SelectTrigger className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {["especes", "mobile_money", "virement", "cheque"].map(m => (
                    <SelectItem key={m} value={m} className="text-[var(--m15-white)]">{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Référence (optionnel)</Label>
              <Input value={payerForm.reference_paiement} onChange={e => setPayerForm(f => ({ ...f, reference_paiement: e.target.value }))}
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={() => setPayerTarget(null)}>Annuler</Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handlePayer} disabled={payerP || !payerForm.date_paiement || !payerForm.mode_paiement}>
              {payerP ? "Enregistrement…" : "Confirmer paiement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Modale Nouvelle prestation ── */}
      <Dialog open={showPrestationModal} onOpenChange={setShowPrestationModal}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <DialogHeader><DialogTitle className="text-[var(--m15-white)]">Nouvelle prestation de service</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Libellé</Label>
              <Input value={prestationForm.libelle} onChange={e => setPrestationForm(f => ({ ...f, libelle: e.target.value }))}
                placeholder="ex: Sortie scolaire, Attestation…"
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Catégorie</Label>
              <Select value={prestationForm.categorie} onValueChange={v => setPrestationForm(f => ({ ...f, categorie: v }))}>
                <SelectTrigger className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {["sortie", "document", "club", "autre"].map(c => (
                    <SelectItem key={c} value={c} className="text-[var(--m15-white)]">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Montant (FCFA)</Label>
              <Input type="number" value={prestationForm.montant} onChange={e => setPrestationForm(f => ({ ...f, montant: e.target.value }))}
                placeholder="ex: 5000"
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]" />
            </div>
            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase">Description (optionnel)</Label>
              <Textarea value={prestationForm.description} onChange={e => setPrestationForm(f => ({ ...f, description: e.target.value }))} rows={2}
                className="mt-1 bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={() => setShowPrestationModal(false)}>Annuler</Button>
            <Button className="bg-[var(--m15-cyan)] text-[var(--m15-navy)]" onClick={handleCreerPrestation} disabled={creerP}>
              {creerP ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
