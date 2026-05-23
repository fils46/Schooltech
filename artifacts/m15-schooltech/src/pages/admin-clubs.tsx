import React from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trophy, Users, Calendar, Clock, Plus, CheckCircle, XCircle, Settings,
  BarChart3, Activity,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetClubsStats,
  useGetClubs,
  usePutClubsId,
  getGetClubsQueryKey,
  getGetClubsStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIES_LABELS: Record<string, string> = {
  sport: "🏆 Sport", art: "🎨 Art", science: "🔬 Science",
  culture: "🎭 Culture", religion: "🕌 Religion", autre: "⭐ Autre",
};

interface ClubItem {
  id: string; nom: string; categorie: string; actif: boolean;
  responsable_nom?: string; responsable_prenoms?: string; nb_membres: number;
  couleur?: string;
}

export default function AdminClubs() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const { data: statsData } = useGetClubsStats();
  const stats = statsData as Record<string, any> | undefined;

  const { data: clubsData, isLoading } = useGetClubs({});
  const clubs: ClubItem[] = (clubsData as { clubs?: ClubItem[] } | undefined)?.clubs ?? [];

  const { mutate: toggleActif } = usePutClubsId();

  function handleToggleActif(club: ClubItem) {
    toggleActif({ id: club.id, data: { actif: !club.actif } as any }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetClubsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetClubsStatsQueryKey() });
      },
    });
  }

  const statCards = [
    { label: "Clubs actifs",       value: (stats as any)?.total_clubs ?? 0,         icon: Trophy,   color: "text-yellow-400" },
    { label: "Membres inscrits",   value: (stats as any)?.total_membres ?? 0,       icon: Users,    color: "text-cyan-400" },
    { label: "Activités ce mois",  value: (stats as any)?.activites_ce_mois ?? 0,   icon: Calendar, color: "text-blue-400" },
    { label: "Demandes en attente",value: (stats as any)?.demandes_en_attente ?? 0, icon: Clock,    color: "text-orange-400" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
            <Trophy className="h-7 w-7 text-yellow-400" /> Administration — Clubs
          </h1>
          <p className="text-[var(--m15-muted)] text-sm mt-1">Gestion des clubs et activités parascolaires</p>
        </div>
        <Button onClick={() => navigate("/clubs/nouveau")} className="bg-yellow-500 hover:bg-yellow-600 text-[var(--m15-white)] font-semibold gap-2">
          <Plus className="h-4 w-4" /> Créer un club
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(s => (
          <Card key={s.label} className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 rounded-xl bg-[var(--m15-card2)] flex items-center justify-center shrink-0`}>
                <s.icon className={`h-5 w-5 ${s.color}`} />
              </div>
              <div>
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[var(--m15-muted)] text-xs">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Répartition par catégorie */}
      {(stats?.par_categorie ?? []).length > 0 && (
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-yellow-400" /> Répartition par catégorie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(stats?.par_categorie ?? []).map((cat: any) => {
                const totalClubs = (stats as any)?.total_clubs ?? 0;
                const pct = totalClubs > 0 ? Math.round((cat.nb_clubs / totalClubs) * 100) : 0;
                return (
                  <div key={cat.categorie} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--m15-white)]">{CATEGORIES_LABELS[cat.categorie] ?? cat.categorie}</span>
                      <span className="text-[var(--m15-muted)]">{cat.nb_clubs} club(s) — {pct}%</span>
                    </div>
                    <div className="h-2 bg-[var(--m15-card2)] rounded-full overflow-hidden">
                      <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tableau des clubs */}
      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-[var(--m15-white)] text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400" /> Tous les clubs ({clubs.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center text-[var(--m15-muted)] py-8">Chargement…</div>
          ) : clubs.length === 0 ? (
            <div className="text-center text-[var(--m15-muted)] py-12">
              <Trophy className="h-10 w-10 mx-auto mb-2 text-[var(--m15-muted)]" />
              <p>Aucun club créé</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {clubs.map(club => {
                const couleur = club.couleur ?? "#00C9A7";
                return (
                  <div key={club.id} className="flex items-center gap-4 p-4 hover:bg-[var(--elevate-1)] transition-colors">
                    {/* Indicateur couleur */}
                    <div className="h-10 w-1 rounded-full shrink-0" style={{ backgroundColor: couleur }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[var(--m15-white)] font-medium truncate">{club.nom}</p>
                        {!club.actif && (
                          <Badge className="bg-[var(--elevate-2)] text-[var(--m15-muted)] border-[var(--m15-border)] text-xs" variant="outline">Inactif</Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs" style={{ borderColor: couleur + "55", color: couleur }}>
                          {CATEGORIES_LABELS[club.categorie] ?? club.categorie}
                        </Badge>
                        <span className="text-[var(--m15-muted)] text-xs">{club.responsable_nom} {club.responsable_prenoms}</span>
                        <span className="text-[var(--m15-muted)] text-xs flex items-center gap-1">
                          <Users className="h-3 w-3" /> {club.nb_membres} membre(s)
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button size="sm" variant="ghost"
                        onClick={() => navigate(`/clubs/${club.id}`)}
                        className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] h-8 px-2">
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => handleToggleActif(club)}
                        className={`h-8 px-2 ${club.actif ? "text-red-400 hover:text-red-300 hover:bg-red-500/10" : "text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"}`}>
                        {club.actif ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
