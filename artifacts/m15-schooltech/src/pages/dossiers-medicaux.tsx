import React, { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Heart, Search, User, Plus, X, Save,
  AlertTriangle, Phone, Shield, CheckCircle,
} from "lucide-react";
import {
  useGetInfirmerieDossierEleveId,
  usePutInfirmerieDossierEleveId,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

const GROUPES_SANGUINS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

interface EleveItem {
  id: string;
  nom: string;
  prenoms: string;
  matricule: string;
  photo_url?: string;
  classe_nom?: string;
}

interface DossierMedicalData {
  dossier?: {
    id: string;
    groupe_sanguin?: string;
    allergies?: string[];
    antecedents?: string;
    medicaments_autorises?: string;
    medicaments_interdits?: string;
    medecin_nom?: string;
    medecin_contact?: string;
    assurance_nom?: string;
    assurance_numero?: string;
    contact_urgence_nom?: string;
    contact_urgence_tel?: string;
    contact_urgence_lien?: string;
    observations_generales?: string;
  };
  eleve?: {
    id: string;
    nom: string;
    prenoms: string;
    matricule: string;
    photo_url?: string;
    classe_nom?: string;
  };
}

function DossierDetail({ eleveId }: { eleveId: string }) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useGetInfirmerieDossierEleveId(eleveId) as {
    data: DossierMedicalData | undefined;
    isLoading: boolean;
  };

  const dossier = data?.dossier;
  const eleve = data?.eleve;

  const [groupeSanguin, setGroupeSanguin] = useState("");
  const [allergies, setAllergies] = useState<string[]>([]);
  const [newAllergie, setNewAllergie] = useState("");
  const [antecedents, setAntecedents] = useState("");
  const [medsAutorises, setMedsAutorises] = useState("");
  const [medsInterdits, setMedsInterdits] = useState("");
  const [medecinNom, setMedecinNom] = useState("");
  const [medecinContact, setMedecinContact] = useState("");
  const [assuranceNom, setAssuranceNom] = useState("");
  const [assuranceNumero, setAssuranceNumero] = useState("");
  const [urgenceNom, setUrgenceNom] = useState("");
  const [urgenceTel, setUrgenceTel] = useState("");
  const [urgenceLien, setUrgenceLien] = useState("");
  const [observations, setObservations] = useState("");
  const [saved, setSaved] = useState(false);

  const { mutate: updateDossier, isPending } = usePutInfirmerieDossierEleveId();

  useEffect(() => {
    if (dossier) {
      setGroupeSanguin(dossier.groupe_sanguin ?? "");
      setAllergies(dossier.allergies ?? []);
      setAntecedents(dossier.antecedents ?? "");
      setMedsAutorises(dossier.medicaments_autorises ?? "");
      setMedsInterdits(dossier.medicaments_interdits ?? "");
      setMedecinNom(dossier.medecin_nom ?? "");
      setMedecinContact(dossier.medecin_contact ?? "");
      setAssuranceNom(dossier.assurance_nom ?? "");
      setAssuranceNumero(dossier.assurance_numero ?? "");
      setUrgenceNom(dossier.contact_urgence_nom ?? "");
      setUrgenceTel(dossier.contact_urgence_tel ?? "");
      setUrgenceLien(dossier.contact_urgence_lien ?? "");
      setObservations(dossier.observations_generales ?? "");
    }
  }, [dossier]);

  function addAllergie() {
    const val = newAllergie.trim();
    if (val && !allergies.includes(val)) {
      setAllergies(prev => [...prev, val]);
      setNewAllergie("");
    }
  }

  function handleSave() {
    updateDossier(
      {
        eleveId,
        data: {
          groupe_sanguin: groupeSanguin || undefined,
          allergies,
          antecedents: antecedents || undefined,
          medicaments_autorises: medsAutorises || undefined,
          medicaments_interdits: medsInterdits || undefined,
          medecin_nom: medecinNom || undefined,
          medecin_contact: medecinContact || undefined,
          assurance_nom: assuranceNom || undefined,
          assurance_numero: assuranceNumero || undefined,
          contact_urgence_nom: urgenceNom || undefined,
          contact_urgence_tel: urgenceTel || undefined,
          contact_urgence_lien: urgenceLien || undefined,
          observations_generales: observations || undefined,
        },
      },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        },
      },
    );
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-48 text-[var(--m15-muted)]">Chargement…</div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/infirmerie/dossiers")}
          className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <h1 className="text-xl font-bold text-[var(--m15-white)]">Dossier médical</h1>
      </div>

      {eleve && (
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4 flex items-center gap-4">
            {eleve.photo_url ? (
              <img src={eleve.photo_url} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="h-14 w-14 rounded-full bg-[var(--m15-card2)] flex items-center justify-center">
                <User className="h-7 w-7 text-[var(--m15-muted)]" />
              </div>
            )}
            <div>
              <p className="text-[var(--m15-white)] text-lg font-bold">{eleve.nom} {eleve.prenoms}</p>
              <p className="text-[var(--m15-muted)] text-sm">Mat. {eleve.matricule} · {eleve.classe_nom ?? "—"}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Informations médicales */}
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
              <Heart className="h-4 w-4 text-rose-400" />
              Informations médicales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Groupe sanguin</Label>
              <Select value={groupeSanguin} onValueChange={setGroupeSanguin}>
                <SelectTrigger className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {GROUPES_SANGUINS.map(g => (
                    <SelectItem key={g} value={g} className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Allergies</Label>
              <div className="flex gap-2">
                <Input
                  value={newAllergie}
                  onChange={e => setNewAllergie(e.target.value)}
                  placeholder="Ajouter une allergie…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addAllergie())}
                />
                <Button type="button" onClick={addAllergie} size="sm" variant="outline" className="border-[var(--m15-border)]">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {allergies.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {allergies.map((a, i) => (
                    <Badge key={i} variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/30 gap-1 pr-1">
                      {a}
                      <button onClick={() => setAllergies(prev => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Antécédents médicaux</Label>
              <Textarea
                value={antecedents}
                onChange={e => setAntecedents(e.target.value)}
                placeholder="Antécédents, maladies chroniques…"
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Médicaments autorisés</Label>
              <Textarea
                value={medsAutorises}
                onChange={e => setMedsAutorises(e.target.value)}
                placeholder="Ex: Paracétamol, Ibuprofène…"
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] resize-none"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--m15-white)] flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                Médicaments interdits
              </Label>
              <Textarea
                value={medsInterdits}
                onChange={e => setMedsInterdits(e.target.value)}
                placeholder="Médicaments à éviter absolument…"
                className="bg-[var(--m15-card2)] border-red-800/40 text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] resize-none"
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {/* Médecin traitant */}
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
                <User className="h-4 w-4 text-cyan-400" />
                Médecin traitant
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Nom du médecin</Label>
                <Input
                  value={medecinNom}
                  onChange={e => setMedecinNom(e.target.value)}
                  placeholder="Dr. Kouamé…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Contact</Label>
                <Input
                  value={medecinContact}
                  onChange={e => setMedecinContact(e.target.value)}
                  placeholder="+225 07 XX XX XX XX"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Assurance */}
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-400" />
                Assurance maladie
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Compagnie</Label>
                <Input
                  value={assuranceNom}
                  onChange={e => setAssuranceNom(e.target.value)}
                  placeholder="MUGEF-CI, CNPS…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Numéro de police</Label>
                <Input
                  value={assuranceNumero}
                  onChange={e => setAssuranceNumero(e.target.value)}
                  placeholder="N° de contrat…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact urgence */}
          <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardHeader className="pb-3">
              <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-400" />
                Contact d'urgence
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Nom</Label>
                <Input
                  value={urgenceNom}
                  onChange={e => setUrgenceNom(e.target.value)}
                  placeholder="Nom complet"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Téléphone</Label>
                <Input
                  value={urgenceTel}
                  onChange={e => setUrgenceTel(e.target.value)}
                  placeholder="+225 05 XX XX XX XX"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Lien de parenté</Label>
                <Input
                  value={urgenceLien}
                  onChange={e => setUrgenceLien(e.target.value)}
                  placeholder="Père, mère, tuteur…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Observations générales */}
      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-[var(--m15-white)] text-base">Observations générales</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={observations}
            onChange={e => setObservations(e.target.value)}
            placeholder="Remarques diverses sur l'état de santé général de l'élève…"
            className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] resize-none"
            rows={3}
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isPending}
          className="bg-rose-600 hover:bg-rose-700 text-[var(--m15-white)] gap-2 min-w-[160px]"
        >
          {saved ? (
            <><CheckCircle className="h-4 w-4" /> Sauvegardé</>
          ) : (
            <><Save className="h-4 w-4" /> {isPending ? "Sauvegarde…" : "Enregistrer"}</>
          )}
        </Button>
      </div>
    </div>
  );
}

function DossiersList() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");

  const token = localStorage.getItem("m15_token");
  const { data, isLoading } = useQuery({
    queryKey: ["eleves-dossiers-list", search],
    queryFn: async () => {
      const params = search ? `?q=${encodeURIComponent(search)}&limit=30` : "?limit=30";
      const res = await axios.get(`/api/eleves${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as { eleves?: EleveItem[] };
    },
  });

  const eleves: EleveItem[] = data?.eleves ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
          <Heart className="h-7 w-7 text-rose-400" />
          Dossiers médicaux
        </h1>
        <p className="text-[var(--m15-muted)] text-sm mt-1">Consultez et mettez à jour les dossiers médicaux des élèves</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--m15-muted)]" />
        <Input
          placeholder="Rechercher un élève…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
        />
      </div>

      {isLoading ? (
        <div className="text-center text-[var(--m15-muted)] py-12">Chargement…</div>
      ) : eleves.length === 0 ? (
        <div className="text-center text-[var(--m15-muted)] py-12">
          {search ? "Aucun élève trouvé pour cette recherche." : "Aucun élève disponible."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {eleves.map(el => (
            <Card
              key={el.id}
              className="bg-[var(--m15-card)] border-[var(--m15-border)] hover:border-[var(--m15-border)] cursor-pointer transition-colors"
              onClick={() => navigate(`/infirmerie/dossier/${el.id}`)}
            >
              <CardContent className="p-4 flex items-center gap-3">
                {el.photo_url ? (
                  <img src={el.photo_url} alt="" className="h-12 w-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-12 w-12 rounded-full bg-[var(--m15-card2)] flex items-center justify-center shrink-0">
                    <User className="h-6 w-6 text-[var(--m15-muted)]" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[var(--m15-white)] font-medium truncate">{el.nom} {el.prenoms}</p>
                  <p className="text-[var(--m15-muted)] text-sm">Mat. {el.matricule}</p>
                  {el.classe_nom && (
                    <p className="text-[var(--m15-muted)] text-xs">{el.classe_nom}</p>
                  )}
                </div>
                <Heart className="h-4 w-4 text-rose-400 shrink-0" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DossiersMedicaux() {
  const params = useParams<{ eleveId: string }>();
  return params.eleveId ? <DossierDetail eleveId={params.eleveId} /> : <DossiersList />;
}
