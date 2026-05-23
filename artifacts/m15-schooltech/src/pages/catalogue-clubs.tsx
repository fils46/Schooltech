import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Trophy, Calendar, Shield } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGetClubs } from "@workspace/api-client-react";

const CATEGORIES = [
  { value: "tous",     label: "Tous",     emoji: "🎓" },
  { value: "sport",    label: "Sport",    emoji: "🏆" },
  { value: "art",      label: "Art",      emoji: "🎨" },
  { value: "science",  label: "Science",  emoji: "🔬" },
  { value: "culture",  label: "Culture",  emoji: "🎭" },
  { value: "religion", label: "Religion", emoji: "🕌" },
  { value: "autre",    label: "Autre",    emoji: "⭐" },
];

interface ClubItem {
  id: string;
  nom: string;
  description?: string;
  categorie: string;
  logo_url?: string;
  couleur?: string;
  capacite_max?: number;
  responsable_nom?: string;
  responsable_prenoms?: string;
  nb_membres: number;
  est_membre: boolean;
  mon_statut?: string;
  mon_role?: string;
  prochaine_activite?: string;
  actif: boolean;
}

function getInitiales(nom: string): string {
  return nom.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

function ClubCard({ club, onView, onJoin }: { club: ClubItem; onView: () => void; onJoin: () => void }) {
  const couleur = club.couleur ?? "#00C9A7";

  return (
    <Card
      className="bg-slate-800 border-slate-700 hover:border-slate-500 transition-all cursor-pointer group overflow-hidden"
      onClick={onView}
    >
      {/* Accent color bar */}
      <div className="h-1 w-full" style={{ backgroundColor: couleur }} />
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          {/* Logo / initiales */}
          {club.logo_url ? (
            <img src={club.logo_url} alt={club.nom} className="h-14 w-14 rounded-xl object-cover shrink-0" />
          ) : (
            <div
              className="h-14 w-14 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ backgroundColor: couleur + "33", border: `2px solid ${couleur}55` }}
            >
              <span style={{ color: couleur }}>{getInitiales(club.nom)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-white font-semibold text-base truncate group-hover:text-cyan-300 transition-colors">{club.nom}</h3>
            <p className="text-slate-400 text-sm truncate">{club.responsable_nom} {club.responsable_prenoms}</p>
            <Badge variant="outline" className="mt-1 text-xs" style={{ borderColor: couleur + "66", color: couleur }}>
              {CATEGORIES.find(c => c.value === club.categorie)?.emoji} {CATEGORIES.find(c => c.value === club.categorie)?.label}
            </Badge>
          </div>
        </div>

        {club.description && (
          <p className="text-slate-400 text-sm line-clamp-2">{club.description}</p>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-1 text-slate-400">
            <Users className="h-4 w-4" />
            <span>{club.nb_membres}{club.capacite_max ? `/${club.capacite_max}` : ""} membres</span>
          </div>
          {club.prochaine_activite && (
            <div className="flex items-center gap-1 text-slate-500 text-xs">
              <Calendar className="h-3 w-3" />
              <span>{new Date(club.prochaine_activite).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}</span>
            </div>
          )}
        </div>

        {/* Statut membre */}
        {club.est_membre ? (
          <Badge className="w-full justify-center bg-cyan-500/20 text-cyan-300 border-cyan-500/30" variant="outline">
            <Shield className="h-3 w-3 mr-1" />
            Membre · {club.mon_role ?? "membre"}
          </Badge>
        ) : club.mon_statut === "en_attente" ? (
          <Badge className="w-full justify-center bg-yellow-500/20 text-yellow-300 border-yellow-500/30" variant="outline">
            En attente de validation
          </Badge>
        ) : (
          <Button
            size="sm"
            className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs"
            onClick={e => { e.stopPropagation(); onJoin(); }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Rejoindre le club
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function CatalogueClubs() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [categorieFilter, setCategorieFilter] = useState("tous");

  const { data, isLoading } = useGetClubs(
    categorieFilter !== "tous" ? { categorie: categorieFilter, actif: true } : { actif: true },
  );
  const clubs: ClubItem[] = (data as { clubs?: ClubItem[] } | undefined)?.clubs ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="h-7 w-7 text-yellow-400" />
            Clubs & Activités
          </h1>
          <p className="text-slate-400 text-sm mt-1">{clubs.length} club(s) disponible(s)</p>
        </div>
        {["dev", "directeur", "censeur"].includes(user?.role ?? "") && (
          <Button
            onClick={() => navigate("/clubs/nouveau")}
            className="bg-yellow-500 hover:bg-yellow-600 text-slate-900 font-semibold gap-2"
          >
            <Plus className="h-4 w-4" />
            Créer un club
          </Button>
        )}
      </div>

      {/* Filtres catégorie */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => (
          <button
            key={cat.value}
            onClick={() => setCategorieFilter(cat.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              categorieFilter === cat.value
                ? "bg-yellow-500 text-slate-900"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {cat.emoji} {cat.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-slate-400 py-12">Chargement…</div>
      ) : clubs.length === 0 ? (
        <div className="text-center text-slate-500 py-16 flex flex-col items-center gap-3">
          <Trophy className="h-12 w-12 text-slate-600" />
          <p className="text-lg">Aucun club trouvé</p>
          {["dev", "directeur", "censeur"].includes(user?.role ?? "") && (
            <Button onClick={() => navigate("/clubs/nouveau")} variant="outline" className="border-slate-600 text-slate-300">
              Créer le premier club
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {clubs.map(club => (
            <ClubCard
              key={club.id}
              club={club}
              onView={() => navigate(`/clubs/${club.id}`)}
              onJoin={() => navigate(`/clubs/${club.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
