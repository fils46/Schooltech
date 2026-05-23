import React, { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calendar, Save } from "lucide-react";
import {
  usePostClubsClubIdActivites,
  useGetClubsId,
  getGetClubsClubIdActivitesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const TYPES = [
  { value: "seance",      label: "🏃 Séance d'entraînement" },
  { value: "competition", label: "🏆 Compétition" },
  { value: "sortie",      label: "🚌 Sortie" },
  { value: "evenement",   label: "🎉 Événement" },
  { value: "reunion",     label: "📋 Réunion" },
];

export default function NouvelleActivite() {
  const { clubId } = useParams<{ clubId: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    titre: "", description: "", type: "seance",
    date_activite: new Date().toISOString().slice(0, 10),
    heure_debut: "14:00", heure_fin: "", lieu: "",
  });

  const { data: clubData } = useGetClubsId(clubId!);
  const club = clubData as { nom?: string; couleur?: string } | undefined;

  const { mutate: creerActivite, isPending } = usePostClubsClubIdActivites();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.titre || !form.type || !form.date_activite || !form.heure_debut) return;

    creerActivite({
      clubId: clubId!,
      data: {
        titre: form.titre,
        description: form.description || undefined,
        type: form.type as any,
        date_activite: form.date_activite,
        heure_debut: form.heure_debut,
        heure_fin: form.heure_fin || undefined,
        lieu: form.lieu || undefined,
      },
    }, {
      onSuccess: (data: any) => {
        qc.invalidateQueries({ queryKey: getGetClubsClubIdActivitesQueryKey(clubId!) });
        navigate(`/clubs/activite/${data?.id ?? ""}`);
      },
    });
  }

  const couleur = club?.couleur ?? "#00C9A7";

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/clubs/${clubId}`)} className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
      </div>

      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)] overflow-hidden">
        <div className="h-1 w-full" style={{ backgroundColor: couleur }} />
        <CardHeader>
          <CardTitle className="text-[var(--m15-white)] flex items-center gap-2">
            <Calendar className="h-5 w-5 text-cyan-400" />
            Nouvelle activité — {club?.nom ?? "Club"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Titre */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Titre de l'activité *</Label>
              <Input value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Ex : Entraînement hebdomadaire, Match contre Lycée Sud…"
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]" required />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Type d'activité *</Label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                <SelectTrigger className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value} className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Date *</Label>
              <Input type="date" value={form.date_activite}
                onChange={e => setForm(f => ({ ...f, date_activite: e.target.value }))}
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]" required />
            </div>

            {/* Horaires */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Heure de début *</Label>
                <Input type="time" value={form.heure_debut}
                  onChange={e => setForm(f => ({ ...f, heure_debut: e.target.value }))}
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]" required />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Heure de fin</Label>
                <Input type="time" value={form.heure_fin}
                  onChange={e => setForm(f => ({ ...f, heure_fin: e.target.value }))}
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]" />
              </div>
            </div>

            {/* Lieu */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Lieu</Label>
              <Input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))}
                placeholder="Ex : Terrain de sport, Salle polyvalente…"
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]" />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Description (optionnel)</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Informations complémentaires…"
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]" />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => navigate(`/clubs/${clubId}`)}
                className="border-[var(--m15-border)] text-[var(--m15-white)]">
                Annuler
              </Button>
              <Button type="submit" disabled={isPending || !form.titre || !form.date_activite}
                className="bg-yellow-500 hover:bg-yellow-600 text-[var(--m15-white)] font-semibold gap-2">
                <Save className="h-4 w-4" />
                {isPending ? "Planification…" : "Planifier l'activité"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
