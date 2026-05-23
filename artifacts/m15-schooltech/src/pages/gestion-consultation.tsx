import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Heart, Clock, AlertTriangle, User,
  CheckCircle, Package, FileText, Bell,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetInfirmerieConsultationsId,
  usePutInfirmerieConsultationsId,
  usePutInfirmerieConsultationsIdCloturer,
  getGetInfirmerieConsultationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const STATUT_COLORS: Record<string, string> = {
  en_cours: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  termine: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  renvoye_domicile: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  hospitalise: "bg-red-500/20 text-red-300 border-red-500/30",
};
const STATUT_LABELS: Record<string, string> = {
  en_cours: "En cours",
  termine: "Terminé",
  renvoye_domicile: "Renvoyé à domicile",
  hospitalise: "Hospitalisé",
};

interface ConsultationData {
  consultation?: {
    id: string;
    eleve_id: string;
    eleve_nom?: string;
    eleve_prenoms?: string;
    eleve_photo?: string;
    classe_nom?: string;
    infirmier_nom?: string;
    motif: string;
    symptomes?: string;
    traitement_administre?: string;
    medicaments_donnes?: string;
    heure_entree: string;
    heure_sortie?: string;
    statut: string;
    parent_notifie: boolean;
    observations?: string;
  };
  dossier_resume?: {
    groupe_sanguin?: string;
    allergies?: string[];
    medicaments_interdits?: string;
    nb_visites: number;
    derniere_visite?: string;
  };
}

export default function GestionConsultation() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const params = useParams<{ id: string }>();
  const id = params.id ?? "";
  const qc = useQueryClient();

  const { data, isLoading } = useGetInfirmerieConsultationsId(id) as { data: ConsultationData | undefined; isLoading: boolean };

  const [symptomes, setSymptomes] = useState("");
  const [traitement, setTraitement] = useState("");
  const [medicaments, setMedicaments] = useState("");
  const [observations, setObservations] = useState("");
  const [statut, setStatut] = useState("");
  const [saved, setSaved] = useState(false);

  const consultation = data?.consultation;
  const dossier = data?.dossier_resume;

  useEffect(() => {
    if (consultation) {
      setSymptomes(consultation.symptomes ?? "");
      setTraitement(consultation.traitement_administre ?? "");
      setMedicaments(consultation.medicaments_donnes ?? "");
      setObservations(consultation.observations ?? "");
      setStatut(consultation.statut);
    }
  }, [consultation]);

  const { mutate: update, isPending: isUpdating } = usePutInfirmerieConsultationsId();
  const { mutate: cloturer, isPending: isCloturing } = usePutInfirmerieConsultationsIdCloturer();

  function handleSave() {
    update(
      { id, data: { symptomes, traitement_administre: traitement, medicaments_donnes: medicaments, observations, statut } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
          qc.invalidateQueries({ queryKey: getGetInfirmerieConsultationsQueryKey() });
        },
      },
    );
  }

  function handleCloturer() {
    cloturer(
      { id },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetInfirmerieConsultationsQueryKey() });
          navigate("/infirmerie/consultations");
        },
      },
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48 text-[var(--m15-muted)]">
        Chargement…
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <p className="text-[var(--m15-muted)]">Consultation introuvable.</p>
        <Button variant="outline" onClick={() => navigate("/infirmerie")} className="border-[var(--m15-border)] text-[var(--m15-white)]">
          Retour
        </Button>
      </div>
    );
  }

  const isEditable = consultation.statut === "en_cours";

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/infirmerie/consultations")}
            className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour
          </Button>
          <h1 className="text-xl font-bold text-[var(--m15-white)]">Consultation</h1>
          <Badge className={STATUT_COLORS[consultation.statut] ?? ""} variant="outline">
            {STATUT_LABELS[consultation.statut] ?? consultation.statut}
          </Badge>
        </div>
        {consultation.parent_notifie && (
          <Badge variant="outline" className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 gap-1">
            <Bell className="h-3 w-3" /> Parent notifié
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Colonne élève + dossier */}
        <div className="space-y-4">
          {/* Infos élève */}
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--m15-white)] text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-cyan-400" />
                Élève
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                {consultation.eleve_photo ? (
                  <img src={consultation.eleve_photo} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[var(--m15-card2)] flex items-center justify-center">
                    <User className="h-6 w-6 text-[var(--m15-muted)]" />
                  </div>
                )}
                <div>
                  <p className="text-[var(--m15-white)] font-semibold">{consultation.eleve_nom} {consultation.eleve_prenoms}</p>
                  <p className="text-[var(--m15-muted)] text-sm">{consultation.classe_nom ?? "—"}</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-[var(--m15-border)] text-[var(--m15-white)] hover:text-[var(--m15-white)] text-xs gap-2"
                onClick={() => navigate(`/infirmerie/dossier/${consultation.eleve_id}`)}
              >
                <FileText className="h-3 w-3" />
                Voir le dossier médical
              </Button>
            </CardContent>
          </Card>

          {/* Résumé dossier */}
          {dossier && (
            <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-[var(--m15-white)] text-sm flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-400" />
                  Dossier médical
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {dossier.groupe_sanguin && (
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--m15-muted)]">Groupe sanguin</span>
                    <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30">
                      {dossier.groupe_sanguin}
                    </Badge>
                  </div>
                )}
                {(dossier.allergies?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-[var(--m15-muted)] mb-1">Allergies</p>
                    <div className="flex flex-wrap gap-1">
                      {dossier.allergies?.map((a, i) => (
                        <Badge key={i} variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                          {a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {dossier.medicaments_interdits && (
                  <div className="flex items-start gap-1">
                    <AlertTriangle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-red-400 text-xs font-medium">Médicaments interdits</p>
                      <p className="text-[var(--m15-white)] text-xs">{dossier.medicaments_interdits}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1 border-t border-[var(--m15-border)]">
                  <span className="text-[var(--m15-muted)]">Visites totales</span>
                  <span className="text-[var(--m15-white)] font-semibold">{dossier.nb_visites}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Horaires */}
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--m15-white)] text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-400" />
                Horaires
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--m15-muted)]">Entrée</span>
                <span className="text-[var(--m15-white)]">
                  {new Date(consultation.heure_entree).toLocaleString("fr-FR", {
                    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
              </div>
              {consultation.heure_sortie && (
                <div className="flex justify-between">
                  <span className="text-[var(--m15-muted)]">Sortie</span>
                  <span className="text-[var(--m15-white)]">
                    {new Date(consultation.heure_sortie).toLocaleString("fr-FR", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[var(--m15-muted)]">Infirmier(e)</span>
                <span className="text-[var(--m15-white)]">{consultation.infirmier_nom ?? "—"}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Formulaire consultation */}
        <div className="md:col-span-2 space-y-4">
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--m15-white)] text-base">Motif : {consultation.motif}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Symptômes observés</Label>
                <Textarea
                  value={symptomes}
                  onChange={e => setSymptomes(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Décrire les symptômes…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] resize-none disabled:opacity-60"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--m15-white)] flex items-center gap-2">
                  <Package className="h-3 w-3" />
                  Traitement administré
                </Label>
                <Textarea
                  value={traitement}
                  onChange={e => setTraitement(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Soins effectués…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] resize-none disabled:opacity-60"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Médicaments donnés</Label>
                <Input
                  value={medicaments}
                  onChange={e => setMedicaments(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Ex: Paracétamol 500mg × 2…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] disabled:opacity-60"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Statut</Label>
                <Select value={statut} onValueChange={setStatut} disabled={!isEditable}>
                  <SelectTrigger className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] disabled:opacity-60">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                    <SelectItem value="en_cours" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">En cours</SelectItem>
                    <SelectItem value="renvoye_domicile" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Renvoyé à domicile</SelectItem>
                    <SelectItem value="hospitalise" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Hospitalisé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Observations</Label>
                <Textarea
                  value={observations}
                  onChange={e => setObservations(e.target.value)}
                  disabled={!isEditable}
                  placeholder="Notes supplémentaires…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] resize-none disabled:opacity-60"
                  rows={2}
                />
              </div>

              {isEditable && (
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={isUpdating}
                    variant="outline"
                    className="flex-1 border-[var(--m15-border)] text-[var(--m15-white)] hover:text-[var(--m15-white)] gap-2"
                  >
                    {saved ? (
                      <><CheckCircle className="h-4 w-4 text-emerald-400" /> Sauvegardé</>
                    ) : (
                      isUpdating ? "Sauvegarde…" : "Sauvegarder"
                    )}
                  </Button>
                  <Button
                    type="button"
                    onClick={handleCloturer}
                    disabled={isCloturing}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-[var(--m15-white)] gap-2"
                  >
                    <CheckCircle className="h-4 w-4" />
                    {isCloturing ? "Clôture…" : "Clôturer et notifier"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
