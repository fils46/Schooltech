import React, { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Users, CheckCircle, XCircle, Save, Trophy, Star, Activity } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetClubsActivitesIdPresences,
  usePostClubsActivitesIdPresences,
  usePutClubsClubIdActivitesId,
  usePostClubsClubIdDistinctions,
  getGetClubsActivitesIdPresencesQueryKey,
  getGetClubsClubIdActivitesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface PresenceItem {
  id: string; eleve_id: string; eleve_nom?: string; eleve_prenoms?: string;
  eleve_photo?: string; classe_nom?: string; present: boolean; motif_absence?: string;
}

export default function GestionActivite() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [presencesLocales, setPresencesLocales] = useState<Record<string, boolean>>({});
  const [motifsLocaux, setMotifsLocaux] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);

  const [showDistinction, setShowDistinction] = useState(false);
  const [distForm, setDistForm] = useState({ eleve_id: "", titre: "", description: "", date_obtention: new Date().toISOString().slice(0, 10) });

  const { data, isLoading } = useGetClubsActivitesIdPresences(id!);
  const activite = (data as any)?.activite;
  const presences: PresenceItem[] = (data as any)?.presences ?? [];
  const nbPresents: number = (data as any)?.nb_presents ?? 0;
  const nbAbsents: number = (data as any)?.nb_absents ?? 0;
  const clubId: string = activite?.club_id ?? "";

  const { mutate: saisirPresences, isPending: isSaving } = usePostClubsActivitesIdPresences();
  const { mutate: updateActivite, isPending: isUpdating } = usePutClubsClubIdActivitesId();
  const { mutate: attribuerDistinction, isPending: isAttribuing } = usePostClubsClubIdDistinctions();

  function togglePresence(eleveId: string, current: boolean) {
    setPresencesLocales(prev => ({ ...prev, [eleveId]: !current }));
  }

  function getPresent(p: PresenceItem): boolean {
    return presencesLocales[p.eleve_id] !== undefined ? presencesLocales[p.eleve_id] : p.present;
  }

  function handleSavePresences() {
    const presencesPayload = presences.map(p => ({
      eleve_id: p.eleve_id,
      present: getPresent(p),
      motif_absence: !getPresent(p) ? (motifsLocaux[p.eleve_id] ?? p.motif_absence ?? "") : undefined,
    }));

    saisirPresences({ id: id!, data: { presences: presencesPayload } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetClubsActivitesIdPresencesQueryKey(id!) });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  }

  function handleSaveNotes() {
    if (!clubId || !activite) return;
    updateActivite({
      clubId,
      id: id!,
      data: {
        titre: activite.titre,
        type: activite.type,
        date_activite: activite.date_activite,
        heure_debut: activite.heure_debut,
        notes_compte_rendu: notes,
      } as any,
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetClubsClubIdActivitesQueryKey(clubId) });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
    });
  }

  function handleAttribuer() {
    if (!clubId || !distForm.eleve_id || !distForm.titre) return;
    attribuerDistinction({ clubId, data: distForm }, {
      onSuccess: () => {
        setShowDistinction(false);
        setDistForm({ eleve_id: "", titre: "", description: "", date_obtention: new Date().toISOString().slice(0, 10) });
      },
    });
  }

  if (isLoading) return <div className="flex items-center justify-center h-48 text-slate-400">Chargement…</div>;
  if (!activite) return <div className="text-center text-slate-500 py-12">Activité introuvable.</div>;

  const nbPresentsLocal = presences.filter(p => getPresent(p)).length;
  const nbAbsentsLocal = presences.length - nbPresentsLocal;
  const couleur = activite.club_couleur ?? "#00C9A7";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/clubs/${clubId}`)} className="text-slate-400 hover:text-white gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
      </div>

      {/* Header activité */}
      <Card className="bg-slate-800 border-slate-700 overflow-hidden">
        <div className="h-1 w-full" style={{ backgroundColor: couleur }} />
        <CardContent className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-slate-400 text-sm">{activite.club_nom}</p>
              <h1 className="text-xl font-bold text-white">{activite.titre}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-slate-400 text-sm">
                  📅 {new Date(activite.date_activite).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
                <span className="text-slate-400 text-sm">🕐 {activite.heure_debut}{activite.heure_fin ? ` → ${activite.heure_fin}` : ""}</span>
                {activite.lieu && <span className="text-slate-400 text-sm">📍 {activite.lieu}</span>}
              </div>
            </div>
            <Badge variant="outline" className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">
              <Activity className="h-3 w-3 mr-1" /> {activite.type}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Stats en temps réel */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-emerald-400">{nbPresentsLocal}</p>
            <p className="text-slate-400 text-sm">Présents</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-red-400">{nbAbsentsLocal}</p>
            <p className="text-slate-400 text-sm">Absents</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-cyan-400">
              {presences.length > 0 ? Math.round((nbPresentsLocal / presences.length) * 100) : 0}%
            </p>
            <p className="text-slate-400 text-sm">Présence</p>
          </CardContent>
        </Card>
      </div>

      {/* Présences */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-cyan-400" /> Présences
          </CardTitle>
          <Button onClick={handleSavePresences} disabled={isSaving || presences.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 h-8">
            {saved ? <CheckCircle className="h-4 w-4" /> : <Save className="h-4 w-4" />}
            {isSaving ? "Enregistrement…" : saved ? "Enregistré !" : "Enregistrer"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {presences.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-6">Aucun membre inscrit à cette activité</p>
          ) : presences.map(p => {
            const present = getPresent(p);
            return (
              <div key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${present ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"}`}>
                {p.eleve_photo ? (
                  <img src={p.eleve_photo} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-9 w-9 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white shrink-0">
                    {(p.eleve_nom ?? "?")[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{p.eleve_nom} {p.eleve_prenoms}</p>
                  {p.classe_nom && <p className="text-slate-500 text-xs">{p.classe_nom}</p>}
                  {!present && (
                    <Input
                      value={motifsLocaux[p.eleve_id] ?? p.motif_absence ?? ""}
                      onChange={e => setMotifsLocaux(prev => ({ ...prev, [p.eleve_id]: e.target.value }))}
                      placeholder="Motif d'absence (optionnel)"
                      className="mt-1 h-7 text-xs bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                    />
                  )}
                </div>
                <button
                  onClick={() => togglePresence(p.eleve_id, present)}
                  className="shrink-0 transition-transform hover:scale-110"
                >
                  {present ? (
                    <CheckCircle className="h-7 w-7 text-emerald-400" />
                  ) : (
                    <XCircle className="h-7 w-7 text-red-400" />
                  )}
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Compte-rendu */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">Compte-rendu de l'activité</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={notes || activite.notes_compte_rendu || ""}
            onChange={e => setNotes(e.target.value)}
            placeholder="Résumé, observations, résultats de l'activité…"
            className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400 min-h-28"
          />
          <div className="flex gap-3">
            <Button onClick={handleSaveNotes} disabled={isUpdating} variant="outline" className="border-slate-600 text-slate-300 gap-2">
              <Save className="h-4 w-4" /> Sauvegarder
            </Button>
            <Button onClick={() => setShowDistinction(true)} className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold gap-2">
              <Trophy className="h-4 w-4" /> Attribuer une distinction
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Modal distinction */}
      <Dialog open={showDistinction} onOpenChange={setShowDistinction}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-400">
              <Star className="h-5 w-5" /> Attribuer une distinction
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Membre</Label>
              <Select value={distForm.eleve_id} onValueChange={v => setDistForm(f => ({ ...f, eleve_id: v }))}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-white">
                  <SelectValue placeholder="Sélectionner un membre…" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {presences.map(p => (
                    <SelectItem key={p.eleve_id} value={p.eleve_id} className="text-white focus:bg-slate-700">
                      {p.eleve_nom} {p.eleve_prenoms}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Titre de la distinction</Label>
              <Input value={distForm.titre} onChange={e => setDistForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Ex : Meilleur joueur, MVP…" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Description (optionnel)</Label>
              <Textarea value={distForm.description} onChange={e => setDistForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Précisions sur la distinction…" className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-400" />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Date d'obtention</Label>
              <Input type="date" value={distForm.date_obtention} onChange={e => setDistForm(f => ({ ...f, date_obtention: e.target.value }))}
                className="bg-slate-700 border-slate-600 text-white" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistinction(false)} className="border-slate-600 text-slate-300">Annuler</Button>
            <Button onClick={handleAttribuer} disabled={isAttribuing || !distForm.eleve_id || !distForm.titre}
              className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold gap-2">
              <Trophy className="h-4 w-4" /> Attribuer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
