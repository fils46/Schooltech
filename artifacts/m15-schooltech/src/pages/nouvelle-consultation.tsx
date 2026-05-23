import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Search, User, AlertTriangle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  usePostInfirmerieConsultations,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface EleveItem {
  id: string;
  nom: string;
  prenoms: string;
  matricule: string;
  photo_url?: string;
}

export default function NouvelleConsultation() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [searchEleve, setSearchEleve] = useState("");
  const [selectedEleve, setSelectedEleve] = useState<EleveItem | null>(null);
  const [motif, setMotif] = useState("");
  const [symptomes, setSymptomes] = useState("");
  const [heureEntree, setHeureEntree] = useState(
    new Date().toISOString().slice(0, 16),
  );
  const [error, setError] = useState("");

  const token = localStorage.getItem("m15_token");
  const { data: elevesData } = useQuery({
    queryKey: ["eleves-search", searchEleve],
    queryFn: async () => {
      const res = await axios.get(`/api/eleves?q=${encodeURIComponent(searchEleve)}&limit=10`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.data as { eleves?: EleveItem[] };
    },
    enabled: searchEleve.length >= 2,
  });
  const eleves: EleveItem[] = elevesData?.eleves ?? [];

  const { mutate: ouvrir, isPending } = usePostInfirmerieConsultations();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedEleve) { setError("Veuillez sélectionner un élève."); return; }
    if (!motif.trim()) { setError("Le motif est obligatoire."); return; }

    ouvrir(
      {
        data: {
          eleve_id: selectedEleve.id,
          motif: motif.trim(),
          symptomes: symptomes.trim() || undefined,
          heure_entree: new Date(heureEntree).toISOString(),
        },
      },
      {
        onSuccess: (data) => {
          const res = data as { consultation?: { id: string } };
          if (res.consultation?.id) {
            navigate(`/infirmerie/consultation/${res.consultation.id}`);
          } else {
            navigate("/infirmerie");
          }
        },
        onError: () => setError("Erreur lors de l'ouverture de la consultation."),
      },
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/infirmerie")}
          className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Button>
        <h1 className="text-xl font-bold text-[var(--m15-white)]">Nouvelle consultation</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Sélection élève */}
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
              <User className="h-4 w-4 text-cyan-400" />
              Élève
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedEleve ? (
              <div className="flex items-center justify-between p-3 bg-[var(--elevate-2)] rounded-lg">
                <div className="flex items-center gap-3">
                  {selectedEleve.photo_url ? (
                    <img src={selectedEleve.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-[var(--m15-card2)] flex items-center justify-center">
                      <User className="h-5 w-5 text-[var(--m15-muted)]" />
                    </div>
                  )}
                  <div>
                    <p className="text-[var(--m15-white)] font-medium">{selectedEleve.nom} {selectedEleve.prenoms}</p>
                    <p className="text-[var(--m15-muted)] text-sm">Mat. {selectedEleve.matricule}</p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedEleve(null)}
                  className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] text-xs"
                >
                  Changer
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--m15-muted)]" />
                  <Input
                    placeholder="Rechercher un élève (nom, matricule)…"
                    value={searchEleve}
                    onChange={e => setSearchEleve(e.target.value)}
                    className="pl-9 bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                  />
                </div>
                {searchEleve.length >= 2 && (
                  <div className="border border-[var(--m15-border)] rounded-lg overflow-hidden">
                    {eleves.length === 0 ? (
                      <p className="text-[var(--m15-muted)] text-sm p-3">Aucun élève trouvé</p>
                    ) : (
                      eleves.map(el => (
                        <button
                          key={el.id}
                          type="button"
                          className="w-full flex items-center gap-3 p-3 hover:bg-[var(--m15-card2)] transition-colors text-left border-b border-[var(--m15-border)] last:border-0"
                          onClick={() => { setSelectedEleve(el); setSearchEleve(""); }}
                        >
                          <div className="h-8 w-8 rounded-full bg-[var(--m15-card2)] flex items-center justify-center shrink-0">
                            <User className="h-4 w-4 text-[var(--m15-muted)]" />
                          </div>
                          <div>
                            <p className="text-[var(--m15-white)] text-sm font-medium">{el.nom} {el.prenoms}</p>
                            <p className="text-[var(--m15-muted)] text-xs">Mat. {el.matricule}</p>
                          </div>
                          <Plus className="h-4 w-4 text-cyan-400 ml-auto" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Détails consultation */}
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[var(--m15-white)] text-base">Détails de la consultation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Heure d'entrée *</Label>
              <Input
                type="datetime-local"
                value={heureEntree}
                onChange={e => setHeureEntree(e.target.value)}
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Motif de consultation *</Label>
              <Input
                placeholder="Ex: Maux de tête, douleur abdominale, blessure…"
                value={motif}
                onChange={e => setMotif(e.target.value)}
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Symptômes observés</Label>
              <Textarea
                placeholder="Description des symptômes…"
                value={symptomes}
                onChange={e => setSymptomes(e.target.value)}
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] resize-none"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/infirmerie")}
            className="flex-1 border-[var(--m15-border)] text-[var(--m15-white)] hover:text-[var(--m15-white)]"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={isPending || !selectedEleve || !motif.trim()}
            className="flex-1 bg-rose-600 hover:bg-rose-700 text-[var(--m15-white)]"
          >
            {isPending ? "Ouverture…" : "Ouvrir la consultation"}
          </Button>
        </div>
      </form>
    </div>
  );
}
