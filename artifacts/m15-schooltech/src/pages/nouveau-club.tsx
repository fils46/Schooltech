import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Trophy, Save } from "lucide-react";
import { usePostClubs, useListerUtilisateurs, useListerAnneesScolaires, getGetClubsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES = [
  { value: "sport",    label: "🏆 Sport" },
  { value: "art",      label: "🎨 Art" },
  { value: "science",  label: "🔬 Science" },
  { value: "culture",  label: "🎭 Culture" },
  { value: "religion", label: "🕌 Religion" },
  { value: "autre",    label: "⭐ Autre" },
];

const COULEURS = [
  "#00C9A7", "#0080FF", "#F59E0B", "#EF4444",
  "#8B5CF6", "#EC4899", "#10B981", "#F97316",
];

export default function NouveauClub() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    nom: "", description: "", categorie: "sport",
    couleur: "#00C9A7", capacite_max: "", responsable_id: "", annee_scolaire_id: "",
  });

  const { data: utilisateursData } = useListerUtilisateurs({ role: "professeur" });
  const professeurs = (utilisateursData as { utilisateurs?: { id: string; nom: string; prenoms: string }[] } | undefined)?.utilisateurs ?? [];

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { annees?: { id: string; libelle: string; actif: boolean }[] } | undefined)?.annees ?? [];
  const anneeActive = annees.find(a => a.actif);

  const { mutate: creerClub, isPending } = usePostClubs();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nom || !form.categorie || !form.responsable_id || !form.annee_scolaire_id) return;

    creerClub({
      data: {
        nom: form.nom,
        description: form.description || undefined,
        categorie: form.categorie as any,
        couleur: form.couleur,
        capacite_max: form.capacite_max ? Number(form.capacite_max) : undefined,
        responsable_id: form.responsable_id,
        annee_scolaire_id: form.annee_scolaire_id,
      },
    }, {
      onSuccess: (data: any) => {
        qc.invalidateQueries({ queryKey: getGetClubsQueryKey() });
        navigate(`/clubs/${data?.id ?? ""}`);
      },
    });
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clubs")} className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
      </div>

      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardHeader>
          <CardTitle className="text-[var(--m15-white)] flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-400" /> Créer un nouveau club
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Nom */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Nom du club *</Label>
              <Input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="Ex : Club de football, Troupe théâtre…"
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]" required />
            </div>

            {/* Catégorie */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Catégorie *</Label>
              <Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v }))}>
                <SelectTrigger className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value} className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Présentation du club, activités proposées…"
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]" />
            </div>

            {/* Responsable */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Responsable (professeur) *</Label>
              <Select value={form.responsable_id} onValueChange={v => setForm(f => ({ ...f, responsable_id: v }))}>
                <SelectTrigger className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Sélectionner un responsable…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {professeurs.map(p => (
                    <SelectItem key={p.id} value={p.id} className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">
                      {p.nom} {p.prenoms}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Année scolaire */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Année scolaire *</Label>
              <Select value={form.annee_scolaire_id} onValueChange={v => setForm(f => ({ ...f, annee_scolaire_id: v }))}>
                <SelectTrigger className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue placeholder="Sélectionner une année…" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {annees.map(a => (
                    <SelectItem key={a.id} value={a.id} className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">
                      {a.libelle}{a.actif ? " (active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Capacité max */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Capacité maximale (optionnel)</Label>
              <Input type="number" min="1" value={form.capacite_max}
                onChange={e => setForm(f => ({ ...f, capacite_max: e.target.value }))}
                placeholder="Pas de limite si vide"
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]" />
            </div>

            {/* Couleur */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Couleur du club</Label>
              <div className="flex gap-2 flex-wrap">
                {COULEURS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, couleur: c }))}
                    className="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110"
                    style={{ backgroundColor: c, borderColor: form.couleur === c ? "#fff" : "transparent" }} />
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate("/clubs")}
                className="border-[var(--m15-border)] text-[var(--m15-white)]">
                Annuler
              </Button>
              <Button type="submit" disabled={isPending || !form.nom || !form.responsable_id || !form.annee_scolaire_id}
                className="bg-yellow-500 hover:bg-yellow-600 text-[var(--m15-white)] font-semibold gap-2">
                <Save className="h-4 w-4" />
                {isPending ? "Création…" : "Créer le club"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
