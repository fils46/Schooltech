import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, Calendar, Activity, Star, Users, TrendingUp, Clock } from "lucide-react";
import { useGetClubsMesClubs } from "@workspace/api-client-react";

const ROLE_COLORS: Record<string, string> = {
  membre:     "bg-slate-500/20 text-slate-300 border-slate-500/30",
  delegue:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  capitaine:  "bg-orange-500/20 text-orange-300 border-orange-500/30",
  secretaire: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  tresorier:  "bg-green-500/20 text-green-300 border-green-500/30",
};

const CATEGORIES_LABELS: Record<string, string> = {
  sport: "🏆", art: "🎨", science: "🔬",
  culture: "🎭", religion: "🕌", autre: "⭐",
};

interface MonClubItem {
  id: string; nom: string; categorie: string; logo_url?: string; couleur?: string;
  responsable_nom?: string; mon_role: string; taux_presence: number;
  nb_distinctions: number; prochaine_activite?: string;
}

interface DistinctionItem {
  id: string; club_id: string; club_nom?: string; titre: string; description?: string;
  date_obtention: string; decerne_par_nom?: string;
}

export default function MesClubs() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useGetClubsMesClubs();

  const clubsActifs: MonClubItem[] = (data as any)?.clubs_actifs ?? [];
  const demandesEnAttente: Record<string, any>[] = (data as any)?.demandes_en_attente ?? [];
  const distinctions: DistinctionItem[] = (data as any)?.distinctions ?? [];

  if (isLoading) {
    return <div className="flex items-center justify-center h-48 text-slate-400">Chargement…</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Trophy className="h-7 w-7 text-yellow-400" /> Mes Clubs
        </h1>
        <p className="text-slate-400 text-sm mt-1">Vos activités parascolaires</p>
      </div>

      {/* Clubs actifs */}
      <section className="space-y-3">
        <h2 className="text-white font-semibold text-lg flex items-center gap-2">
          <Users className="h-5 w-5 text-cyan-400" /> Mes clubs actifs
        </h2>
        {clubsActifs.length === 0 ? (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-8 text-center">
              <Trophy className="h-10 w-10 mx-auto mb-3 text-slate-600" />
              <p className="text-slate-400">Vous n'êtes membre d'aucun club</p>
              <Button onClick={() => navigate("/clubs")} className="mt-4 bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold">
                Découvrir les clubs
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {clubsActifs.map(club => {
              const couleur = club.couleur ?? "#00C9A7";
              return (
                <Card key={club.id} className="bg-slate-800 border-slate-700 hover:border-slate-500 transition-all cursor-pointer overflow-hidden"
                  onClick={() => navigate(`/clubs/${club.id}`)}>
                  <div className="h-1 w-full" style={{ backgroundColor: couleur }} />
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      {club.logo_url ? (
                        <img src={club.logo_url} alt={club.nom} className="h-12 w-12 rounded-xl object-cover" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold"
                          style={{ backgroundColor: couleur + "22", color: couleur }}>
                          {CATEGORIES_LABELS[club.categorie] ?? "⭐"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold truncate">{club.nom}</p>
                        <p className="text-slate-400 text-xs">{club.responsable_nom}</p>
                      </div>
                      <Badge variant="outline" className={ROLE_COLORS[club.mon_role] ?? ""}>{club.mon_role}</Badge>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-slate-700/50 rounded-lg p-2">
                        <p className="text-cyan-400 font-bold text-lg">{club.taux_presence}%</p>
                        <p className="text-slate-400 text-xs">Présence</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-2">
                        <p className="text-yellow-400 font-bold text-lg">{club.nb_distinctions}</p>
                        <p className="text-slate-400 text-xs">Distinctions</p>
                      </div>
                      <div className="bg-slate-700/50 rounded-lg p-2">
                        {club.prochaine_activite ? (
                          <>
                            <p className="text-white font-bold text-sm">{new Date(club.prochaine_activite).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</p>
                            <p className="text-slate-400 text-xs">Prochaine</p>
                          </>
                        ) : (
                          <>
                            <p className="text-slate-500 font-bold text-sm">—</p>
                            <p className="text-slate-400 text-xs">Activité</p>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Demandes en attente */}
      {demandesEnAttente.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-400" /> Demandes en attente ({demandesEnAttente.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {demandesEnAttente.map(club => (
              <Card key={club.id} className="bg-slate-800 border-yellow-500/30 border">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-white font-medium">{club.nom}</p>
                    <p className="text-slate-400 text-sm">{club.responsable_nom}</p>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 shrink-0" variant="outline">En attente</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Mes distinctions */}
      {distinctions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-white font-semibold text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-400" /> Mes distinctions
          </h2>
          <div className="space-y-3">
            {distinctions.map(d => (
              <div key={d.id} className="flex items-start gap-4 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <div className="h-10 w-10 rounded-full bg-yellow-500/20 flex items-center justify-center shrink-0">
                  <Trophy className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-yellow-300 font-semibold">{d.titre}</p>
                  {d.description && <p className="text-slate-400 text-sm mt-1">{d.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>{d.club_nom}</span>
                    <span>·</span>
                    <span>{new Date(d.date_obtention).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" })}</span>
                    {d.decerne_par_nom && <><span>·</span><span>Par {d.decerne_par_nom}</span></>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bouton accès catalogue */}
      <div className="text-center pt-4">
        <Button onClick={() => navigate("/clubs")} variant="outline" className="border-slate-600 text-slate-300 gap-2">
          <Activity className="h-4 w-4" /> Découvrir tous les clubs
        </Button>
      </div>
    </div>
  );
}
