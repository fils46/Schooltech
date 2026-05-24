import { useState, useEffect } from "react";
import {
  useGetMonContrat,
  useGetMesFeuilles,
  useSoumettreFeuilleHeures,
  getGetMesFeuillesQueryKey,
  getGetMonContratQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, DollarSign, FileText, TrendingUp, Send } from "lucide-react";

const MOIS_LABELS = ["", "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];

const STATUT_CONFIG: Record<string, { label: string; color: string }> = {
  brouillon: { label: "Brouillon", color: "bg-gray-500" },
  soumise: { label: "Soumise", color: "bg-yellow-500" },
  validee: { label: "Validée", color: "bg-cyan-500" },
  payee: { label: "Payée", color: "bg-green-600" },
  rejetee: { label: "Rejetée", color: "bg-red-600" },
};

function formatFCFA(n: number): string {
  return n.toLocaleString("fr-CI") + " FCFA";
}

type Contrat = {
  id: string;
  libelle: string;
  taux: string;
  taux_horaire_personnalise: string | null;
  nb_heures_contractuelles: string | null;
};

type Feuille = {
  id: string;
  mois: number;
  annee: number;
  nb_heures_effectuees: string;
  nb_heures_validees: string | null;
  montant_brut: string | null;
  montant_net: string | null;
  statut: string;
  notes_admin: string | null;
};

export default function MaFeuilleHeures() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const now = new Date();
  const [mois, setMois] = useState(String(now.getMonth() + 1));
  const [annee] = useState(String(now.getFullYear()));
  const [nbHeures, setNbHeures] = useState("");
  const [notes, setNotes] = useState("");

  const { data: rawContrat } = useGetMonContrat();
  const { data: rawFeuilles } = useGetMesFeuilles();
  const { mutate: soumettre, isPending } = useSoumettreFeuilleHeures();

  const contrat = (rawContrat as { data?: { contrat?: Contrat; feuilles?: Feuille[] } })?.data?.contrat;
  const feuilles: Feuille[] = (rawContrat as { data?: { feuilles?: Feuille[] } })?.data?.feuilles
    ?? (rawFeuilles as { data?: Feuille[] })?.data
    ?? [];

  const taux = parseFloat(contrat?.taux_horaire_personnalise ?? contrat?.taux ?? "0") || 0;
  const montantEstime = taux * (parseFloat(nbHeures) || 0);

  const feuilleExistante = feuilles.find(
    f => f.mois === parseInt(mois) && f.annee === parseInt(annee),
  );
  const dejaSoumise = feuilleExistante && feuilleExistante.statut !== "rejetee";

  const totalPercuAnnee = feuilles
    .filter(f => f.statut === "payee" && f.annee === parseInt(annee))
    .reduce((s, f) => s + parseFloat(f.montant_net ?? "0"), 0);

  const totalHeuresAnnee = feuilles
    .filter(f => f.annee === parseInt(annee))
    .reduce((s, f) => s + parseFloat(f.nb_heures_effectuees ?? "0"), 0);

  const totalHeuresValidees = feuilles
    .filter(f => f.statut !== "rejetee")
    .reduce((s, f) => s + parseFloat(f.nb_heures_validees ?? "0"), 0);

  const handleSoumettre = () => {
    if (!nbHeures || parseFloat(nbHeures) <= 0) {
      toast({ title: "Nombre d'heures invalide", variant: "destructive" });
      return;
    }
    soumettre(
      { data: { mois: parseInt(mois), annee: parseInt(annee), nb_heures_effectuees: parseFloat(nbHeures), notes_professeur: notes || undefined } },
      {
        onSuccess: () => {
          toast({ title: "Feuille soumise avec succès !" });
          setNbHeures("");
          setNotes("");
          queryClient.invalidateQueries({ queryKey: getGetMesFeuillesQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetMonContratQueryKey() });
        },
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur lors de la soumission.";
          toast({ title: msg, variant: "destructive" });
        },
      },
    );
  };

  if (user?.role !== "professeur") {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[var(--m15-muted)]">Accès réservé aux professeurs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
          <Clock className="h-7 w-7 text-[var(--m15-cyan)]" />
          Mes honoraires
        </h1>
        {contrat ? (
          <p className="text-[var(--m15-muted)] text-sm mt-1">
            Contrat : <span className="text-[var(--m15-white)]">{contrat.libelle}</span>
            {" • "}Taux : <span className="text-[var(--m15-gold)] font-bold">{formatFCFA(taux)}/h</span>
          </p>
        ) : (
          <p className="text-[var(--m15-muted)] text-sm mt-1">Aucun contrat actif — contactez votre direction.</p>
        )}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <p className="text-[var(--m15-muted)] text-xs uppercase tracking-wider mb-1">Heures cette année</p>
            <p className="text-2xl font-bold text-[var(--m15-white)]">{totalHeuresAnnee.toFixed(1)} h</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4">
            <p className="text-[var(--m15-muted)] text-xs uppercase tracking-wider mb-1">Heures validées</p>
            <p className="text-2xl font-bold text-[var(--m15-cyan)]">{totalHeuresValidees.toFixed(1)} h</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)] col-span-2 sm:col-span-1">
          <CardContent className="p-4">
            <p className="text-[var(--m15-muted)] text-xs uppercase tracking-wider mb-1">Honoraires perçus {annee}</p>
            <p className="text-xl font-bold text-[var(--m15-gold)]">{formatFCFA(totalPercuAnnee)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Formulaire soumission */}
      {contrat && (
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardHeader>
            <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
              <Send className="h-5 w-5 text-[var(--m15-cyan)]" />
              Soumettre mes heures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[var(--m15-muted)] text-xs uppercase mb-1 block">Mois</Label>
                <Select value={mois} onValueChange={setMois} disabled={dejaSoumise === true}>
                  <SelectTrigger className="bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                    {MOIS_LABELS.slice(1).map((l, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)} className="text-[var(--m15-white)]">{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[var(--m15-muted)] text-xs uppercase mb-1 block">Nb heures effectuées</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={nbHeures}
                  onChange={e => setNbHeures(e.target.value)}
                  placeholder="Ex: 24"
                  disabled={dejaSoumise === true}
                  className="bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]"
                />
              </div>
            </div>

            {nbHeures && parseFloat(nbHeures) > 0 && (
              <div className="rounded-lg p-3 bg-[var(--m15-navy)] border border-[var(--m15-border)] text-sm space-y-1">
                <p className="text-[var(--m15-muted)]">Taux applicable : <span className="text-[var(--m15-white)]">{formatFCFA(taux)}/h</span></p>
                <p className="text-[var(--m15-muted)]">
                  Montant estimé : <span className="text-[var(--m15-gold)] font-bold text-base">{formatFCFA(montantEstime)}</span>
                  <span className="text-[var(--m15-muted)] text-xs ml-1">(brut, avant validation)</span>
                </p>
              </div>
            )}

            <div>
              <Label className="text-[var(--m15-muted)] text-xs uppercase mb-1 block">Notes (optionnel)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Commentaires pour la direction…"
                disabled={dejaSoumise === true}
                rows={2}
                className="bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] resize-none"
              />
            </div>

            {dejaSoumise ? (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <Badge className={`${STATUT_CONFIG[feuilleExistante?.statut ?? "soumise"]?.color ?? "bg-gray-500"} text-white`}>
                  {STATUT_CONFIG[feuilleExistante?.statut ?? "soumise"]?.label}
                </Badge>
                <p className="text-yellow-300 text-sm">Feuille déjà soumise pour {MOIS_LABELS[parseInt(mois)]}.</p>
              </div>
            ) : (
              <Button
                className="w-full bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold hover:opacity-90"
                onClick={handleSoumettre}
                disabled={isPending || !nbHeures}
              >
                {isPending ? "Soumission…" : "Soumettre pour validation"}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Historique */}
      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
            <FileText className="h-5 w-5 text-[var(--m15-muted)]" />
            Historique de mes feuilles
          </CardTitle>
        </CardHeader>
        <CardContent>
          {feuilles.length === 0 ? (
            <p className="text-[var(--m15-muted)] text-sm text-center py-6">Aucune feuille soumise</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--m15-border)]">
                    <th className="text-left py-2 px-3 text-[var(--m15-muted)] font-medium">Mois</th>
                    <th className="text-right py-2 px-3 text-[var(--m15-muted)] font-medium">H. soumises</th>
                    <th className="text-right py-2 px-3 text-[var(--m15-muted)] font-medium">H. validées</th>
                    <th className="text-right py-2 px-3 text-[var(--m15-muted)] font-medium">Montant net</th>
                    <th className="text-center py-2 px-3 text-[var(--m15-muted)] font-medium">Statut</th>
                    <th className="text-left py-2 px-3 text-[var(--m15-muted)] font-medium">Notes admin</th>
                  </tr>
                </thead>
                <tbody>
                  {feuilles.map(f => (
                    <tr key={f.id} className="border-b border-[var(--m15-border)] hover:bg-[var(--elevate-1)]">
                      <td className="py-2 px-3 text-[var(--m15-white)]">{MOIS_LABELS[f.mois]} {f.annee}</td>
                      <td className="py-2 px-3 text-right text-[var(--m15-muted)]">{f.nb_heures_effectuees} h</td>
                      <td className="py-2 px-3 text-right text-[var(--m15-white)]">{f.nb_heures_validees ?? "—"} h</td>
                      <td className="py-2 px-3 text-right font-medium" style={{ color: "#F5C842" }}>
                        {f.montant_net ? formatFCFA(parseFloat(f.montant_net)) : "—"}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <Badge className={`${STATUT_CONFIG[f.statut]?.color ?? "bg-gray-500"} text-white text-xs`}>
                          {STATUT_CONFIG[f.statut]?.label ?? f.statut}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-[var(--m15-muted)] text-xs max-w-xs truncate">
                        {f.notes_admin ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {feuilles.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--m15-border)] flex justify-end">
              <p className="text-[var(--m15-muted)] text-sm">
                Total perçu {annee} :{" "}
                <span className="text-[var(--m15-gold)] font-bold text-base">{formatFCFA(totalPercuAnnee)}</span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
