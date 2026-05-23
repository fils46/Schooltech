import React, { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Users, Trophy, Calendar, Shield, Star, Settings,
  CheckCircle, XCircle, Plus, Activity, UserCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetClubsId,
  useGetClubsIdMembres,
  useGetClubsIdMembresEnAttente,
  useGetClubsClubIdActivites,
  usePostClubsIdInscrire,
  usePutClubsClubIdMembresMembreId,
  useDeleteClubsClubIdMembresMembreId,
  getGetClubsIdQueryKey,
  getGetClubsIdMembresQueryKey,
  getGetClubsIdMembresEnAttenteQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES_LABELS: Record<string, string> = {
  sport: "🏆 Sport", art: "🎨 Art", science: "🔬 Science",
  culture: "🎭 Culture", religion: "🕌 Religion", autre: "⭐ Autre",
};
const ROLE_COLORS: Record<string, string> = {
  membre:     "bg-slate-500/20 text-slate-300 border-slate-500/30",
  delegue:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  capitaine:  "bg-orange-500/20 text-orange-300 border-orange-500/30",
  secretaire: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  tresorier:  "bg-green-500/20 text-green-300 border-green-500/30",
};
const TYPE_ACTIVITE_LABELS: Record<string, string> = {
  seance: "Séance", competition: "Compétition", sortie: "Sortie",
  evenement: "Événement", reunion: "Réunion",
};
const STATUT_ACTIVITE_COLORS: Record<string, string> = {
  planifiee:  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  en_cours:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  terminee:   "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  annulee:    "bg-red-500/20 text-red-300 border-red-500/30",
};

interface ClubMembre {
  id: string; eleve_id: string; eleve_nom?: string; eleve_prenoms?: string;
  eleve_photo?: string; classe_nom?: string; statut: string; role_membre: string;
  date_inscription: string;
}

export default function DetailClub() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"presentation"|"activites"|"membres"|"stats">("presentation");

  const { data: clubData, isLoading } = useGetClubsId(id!);
  const club = clubData as Record<string, any> | undefined;
  const couleur = club?.couleur ?? "#00C9A7";

  const { data: membresData } = useGetClubsIdMembres(id!, {});
  const { data: attenteData } = useGetClubsIdMembresEnAttente(id!);
  const { data: activitesData } = useGetClubsClubIdActivites(id!);

  const membres: ClubMembre[] = (membresData as { membres?: ClubMembre[] } | undefined)?.membres ?? [];
  const enAttente: ClubMembre[] = (attenteData as { membres?: ClubMembre[] } | undefined)?.membres ?? [];
  const activites: Record<string, any>[] = (activitesData as { activites?: Record<string, any>[] } | undefined)?.activites ?? [];

  const { mutate: inscrire, isPending: isInscribing } = usePostClubsIdInscrire();
  const { mutate: traiter } = usePutClubsClubIdMembresMembreId();
  const { mutate: retirer } = useDeleteClubsClubIdMembresMembreId();

  const isAdmin = ["dev", "directeur", "censeur"].includes(user?.role ?? "");
  const isResponsable = club?.responsable_id === user?.id || isAdmin;

  function handleInscrire() {
    inscrire({ id: id! }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetClubsIdQueryKey(id!) });
      },
    });
  }

  function handleTraiter(membreId: string, statut: "accepte" | "refuse") {
    traiter({ clubId: id!, membreId, data: { statut } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetClubsIdQueryKey(id!) });
        qc.invalidateQueries({ queryKey: getGetClubsIdMembresQueryKey(id!) });
        qc.invalidateQueries({ queryKey: getGetClubsIdMembresEnAttenteQueryKey(id!) });
      },
    });
  }

  function handleRetirer(membreId: string) {
    retirer({ clubId: id!, membreId }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetClubsIdMembresQueryKey(id!) });
      },
    });
  }

  if (isLoading) return <div className="flex items-center justify-center h-48 text-slate-400">Chargement…</div>;
  if (!club) return <div className="text-center text-slate-500 py-12">Club introuvable.</div>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clubs")} className="text-slate-400 hover:text-white gap-2">
          <ArrowLeft className="h-4 w-4" /> Retour
        </Button>
      </div>

      <Card className="bg-slate-800 border-slate-700 overflow-hidden">
        <div className="h-2 w-full" style={{ backgroundColor: couleur }} />
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Logo */}
            <div className="shrink-0">
              {club.logo_url ? (
                <img src={club.logo_url} alt={club.nom} className="h-20 w-20 rounded-2xl object-cover" />
              ) : (
                <div className="h-20 w-20 rounded-2xl flex items-center justify-center text-2xl font-bold"
                  style={{ backgroundColor: couleur + "22", border: `2px solid ${couleur}55`, color: couleur }}>
                  {club.nom?.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)}
                </div>
              )}
            </div>
            {/* Infos */}
            <div className="flex-1">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold text-white">{club.nom}</h1>
                  <p className="text-slate-400">{club.responsable_nom} {club.responsable_prenoms}</p>
                  <Badge variant="outline" className="mt-2" style={{ borderColor: couleur + "66", color: couleur }}>
                    {CATEGORIES_LABELS[club.categorie] ?? club.categorie}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Users className="h-4 w-4" />
                  <span>{club.nb_membres}{club.capacite_max ? `/${club.capacite_max}` : ""} membres</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {user?.role === "eleve" && !club.est_membre && club.mon_statut !== "en_attente" && (
                  <Button onClick={handleInscrire} disabled={isInscribing} className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold gap-2">
                    <Plus className="h-4 w-4" /> Rejoindre le club
                  </Button>
                )}
                {user?.role === "eleve" && club.mon_statut === "en_attente" && (
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 px-4 py-2" variant="outline">En attente de validation</Badge>
                )}
                {user?.role === "eleve" && club.est_membre && (
                  <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 px-4 py-2" variant="outline">
                    <Shield className="h-3 w-3 mr-1" /> Membre · {club.mon_role}
                  </Badge>
                )}
                {isResponsable && (
                  <Button onClick={() => navigate(`/clubs/${id}/gerer`)} variant="outline" className="border-slate-600 text-slate-300 gap-2">
                    <Settings className="h-4 w-4" /> Gérer le club
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Onglets */}
      <div className="flex gap-1 bg-slate-800 rounded-xl p-1 border border-slate-700 flex-wrap">
        {[
          { key: "presentation", label: "Présentation", icon: Trophy },
          { key: "activites", label: "Activités", icon: Calendar },
          ...(isResponsable ? [
            { key: "membres", label: `Membres (${membres.length + enAttente.length})`, icon: Users },
          ] : []),
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${activeTab === tab.key ? "bg-slate-600 text-white" : "text-slate-400 hover:text-white"}`}>
            <tab.icon className="h-4 w-4" /> {tab.label}
          </button>
        ))}
      </div>

      {/* Contenu onglets */}
      {activeTab === "presentation" && (
        <div className="space-y-5">
          {club.description && (
            <Card className="bg-slate-800 border-slate-700">
              <CardContent className="p-5">
                <p className="text-slate-300 leading-relaxed">{club.description}</p>
              </CardContent>
            </Card>
          )}

          {/* Membres acceptés */}
          {membres.length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-400" /> Membres
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {membres.slice(0, 8).map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    {m.eleve_photo ? (
                      <img src={m.eleve_photo} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white">
                        {(m.eleve_nom ?? "?")[0]}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="text-white text-sm">{m.eleve_nom} {m.eleve_prenoms}</p>
                      {m.classe_nom && <p className="text-slate-500 text-xs">{m.classe_nom}</p>}
                    </div>
                    <Badge variant="outline" className={ROLE_COLORS[m.role_membre] ?? ""}>{m.role_membre}</Badge>
                  </div>
                ))}
                {membres.length > 8 && <p className="text-slate-500 text-sm text-center">+{membres.length - 8} autres membres</p>}
              </CardContent>
            </Card>
          )}

          {/* Distinctions récentes */}
          {((club.distinctions_recentes as any[]) ?? []).length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-400" /> Distinctions récentes
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {((club.distinctions_recentes as any[]) ?? []).map((d: any) => (
                  <div key={d.id} className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <Trophy className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-yellow-300 font-medium text-sm">{d.titre}</p>
                      <p className="text-slate-400 text-xs">{d.eleve_nom} {d.eleve_prenoms} · {new Date(d.date_obtention).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "activites" && (
        <div className="space-y-3">
          {isResponsable && (
            <div className="flex justify-end">
              <Button onClick={() => navigate(`/clubs/${id}/nouvelle-activite`)} className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold gap-2">
                <Plus className="h-4 w-4" /> Nouvelle activité
              </Button>
            </div>
          )}
          {activites.length === 0 ? (
            <div className="text-center text-slate-500 py-12">
              <Calendar className="h-10 w-10 mx-auto mb-2 text-slate-600" />
              <p>Aucune activité planifiée</p>
            </div>
          ) : (
            activites.map(a => (
              <Card key={a.id} className="bg-slate-800 border-slate-700 hover:border-slate-500 transition-colors cursor-pointer"
                onClick={() => navigate(`/clubs/activite/${a.id}`)}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: couleur + "22" }}>
                    <Activity className="h-5 w-5" style={{ color: couleur }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">{a.titre}</p>
                    <p className="text-slate-400 text-sm">
                      {new Date(a.date_activite).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })} · {a.heure_debut}
                    </p>
                    {a.lieu && <p className="text-slate-500 text-xs">{a.lieu}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className={STATUT_ACTIVITE_COLORS[a.statut] ?? ""}>{a.statut}</Badge>
                    <Badge variant="outline" className="text-slate-400 border-slate-600 text-xs">{TYPE_ACTIVITE_LABELS[a.type] ?? a.type}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === "membres" && (
        <div className="space-y-5">
          {/* Demandes en attente */}
          {enAttente.length > 0 && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-yellow-400" />
                  Demandes en attente ({enAttente.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {enAttente.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{m.eleve_nom} {m.eleve_prenoms}</p>
                      {m.classe_nom && <p className="text-slate-400 text-xs">{m.classe_nom}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" onClick={() => handleTraiter(m.id, "accepte")}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-7 text-xs px-2">
                        <CheckCircle className="h-3 w-3" /> Accepter
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleTraiter(m.id, "refuse")}
                        className="border-red-500/50 text-red-400 hover:bg-red-500/20 gap-1 h-7 text-xs px-2">
                        <XCircle className="h-3 w-3" /> Refuser
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Membres acceptés */}
          <Card className="bg-slate-800 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-400" /> Membres ({membres.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {membres.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">Aucun membre accepté</p>
              ) : membres.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-700/50 transition-colors">
                  {m.eleve_photo ? (
                    <img src={m.eleve_photo} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-slate-600 flex items-center justify-center text-xs text-white">
                      {(m.eleve_nom ?? "?")[0]}
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-white text-sm">{m.eleve_nom} {m.eleve_prenoms}</p>
                    {m.classe_nom && <p className="text-slate-500 text-xs">{m.classe_nom}</p>}
                  </div>
                  <Badge variant="outline" className={ROLE_COLORS[m.role_membre] ?? ""}>{m.role_membre}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => handleRetirer(m.id)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2">
                    <XCircle className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
