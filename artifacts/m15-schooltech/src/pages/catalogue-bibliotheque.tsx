import React, { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Search, Grid3X3, List, BookOpen, FileText, Video,
  Star, Download, Eye, BookMarked, Layers, Filter,
  X, Heart, HeartOff,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetBibliothequeRessources,
  getGetBibliothequeRessourcesQueryKey,
  usePostBibliothequeRessourcesIdFavori,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const TYPE_LABELS: Record<string, string> = {
  manuel: "Manuel",
  fiche_cours: "Fiche de cours",
  exercice: "Exercice",
  video: "Vidéo",
  document_officiel: "Officiel",
  autre: "Autre",
};

const TYPE_ICONS: Record<string, React.ReactElement> = {
  manuel: <BookOpen className="h-4 w-4" />,
  fiche_cours: <FileText className="h-4 w-4" />,
  exercice: <Layers className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  document_officiel: <BookMarked className="h-4 w-4" />,
  autre: <FileText className="h-4 w-4" />,
};

const TYPE_COLORS: Record<string, string> = {
  manuel: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  fiche_cours: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  exercice: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  video: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  document_officiel: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  autre: "bg-[var(--elevate-1)] text-[var(--m15-white)] border-[var(--m15-border)]/30",
};

const NIVEAUX = ["6eme", "5eme", "4eme", "3eme", "2nde", "1ere", "Tle"];
const LANGUES = [{ value: "fr", label: "Français" }, { value: "en", label: "Anglais" }];

export default function CatalogueBibliotheque() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState("tous");
  const [tri, setTri] = useState("date");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const [selectedNiveaux, setSelectedNiveaux] = useState<string[]>([]);
  const [selectedLangue, setSelectedLangue] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const params = {
    q: search || undefined,
    type: activeType !== "tous" ? activeType : undefined,
    niveau: selectedNiveaux.length === 1 ? selectedNiveaux[0] : undefined,
    langue: selectedLangue || undefined,
    tri,
    page,
    limit: 20,
  };

  const qk = getGetBibliothequeRessourcesQueryKey(params);
  const { data, isLoading } = useGetBibliothequeRessources(params, {
    query: { queryKey: qk },
  });

  const toggleFavori = usePostBibliothequeRessourcesIdFavori({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetBibliothequeRessourcesQueryKey(params) });
      },
    },
  });

  const resetFilters = useCallback(() => {
    setSelectedNiveaux([]);
    setSelectedLangue("");
    setSearch("");
    setActiveType("tous");
    setPage(1);
  }, []);

  const ressources = data?.ressources ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const niveauFiltered = selectedNiveaux.length > 1
    ? ressources.filter((r) => selectedNiveaux.some((n) => (r.niveau ?? []).includes(n)))
    : ressources;

  return (
    <div className="min-h-screen bg-[var(--m15-navy)] text-[var(--m15-white)]">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#111E35] to-[#0A1628] border-b border-[rgba(0,201,167,0.15)] px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="font-syne text-3xl font-bold text-[var(--m15-white)] mb-1">Bibliothèque numérique</h1>
          <p className="text-[var(--m15-muted)] mb-6">Manuels, fiches de cours, exercices et documents officiels</p>

          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[var(--m15-muted)]" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Rechercher un manuel, une fiche de cours, un exercice…"
              className="pl-12 h-12 bg-[var(--m15-card2)] border-[rgba(0,201,167,0.25)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)] text-base focus-visible:ring-[#00C9A7] rounded-xl"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--m15-muted)] hover:text-[var(--m15-white)]">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filtres rapides par type */}
          <div className="flex flex-wrap gap-2">
            {["tous", "manuel", "fiche_cours", "exercice", "video", "document_officiel", "autre"].map((t) => (
              <button
                key={t}
                onClick={() => { setActiveType(t); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  activeType === t
                    ? "bg-[#00C9A7] text-[#0A1628] border-[#00C9A7]"
                    : "bg-transparent border-[rgba(0,201,167,0.2)] text-[var(--m15-muted)] hover:border-[#00C9A7] hover:text-[var(--m15-white)]"
                }`}
              >
                {t !== "tous" && TYPE_ICONS[t]}
                {t === "tous" ? "Tout" : TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 flex gap-6">
        {/* Sidebar filtres */}
        <div className={`${showFilters ? "block" : "hidden"} md:block w-56 shrink-0`}>
          <div className="bg-[var(--m15-card)] border border-[rgba(0,201,167,0.15)] rounded-xl p-4 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-sm text-[var(--m15-white)]">Filtres avancés</span>
              <button onClick={resetFilters} className="text-xs text-[#00C9A7] hover:underline">Réinitialiser</button>
            </div>

            {/* Niveaux */}
            <div className="mb-4">
              <p className="text-xs text-[var(--m15-muted)] uppercase tracking-wide mb-2">Niveau</p>
              <div className="space-y-1.5">
                {NIVEAUX.map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <Checkbox
                      id={`niv-${n}`}
                      checked={selectedNiveaux.includes(n)}
                      onCheckedChange={(checked) => {
                        setSelectedNiveaux((prev) =>
                          checked ? [...prev, n] : prev.filter((x) => x !== n),
                        );
                        setPage(1);
                      }}
                      className="border-[rgba(0,201,167,0.3)] data-[state=checked]:bg-[#00C9A7] data-[state=checked]:border-[#00C9A7]"
                    />
                    <Label htmlFor={`niv-${n}`} className="text-sm text-[var(--m15-muted)] cursor-pointer">{n}</Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Langue */}
            <div>
              <p className="text-xs text-[var(--m15-muted)] uppercase tracking-wide mb-2">Langue</p>
              <div className="space-y-1.5">
                {LANGUES.map((l) => (
                  <div key={l.value} className="flex items-center gap-2">
                    <Checkbox
                      id={`lang-${l.value}`}
                      checked={selectedLangue === l.value}
                      onCheckedChange={(checked) => {
                        setSelectedLangue(checked ? l.value : "");
                        setPage(1);
                      }}
                      className="border-[rgba(0,201,167,0.3)] data-[state=checked]:bg-[#00C9A7] data-[state=checked]:border-[#00C9A7]"
                    />
                    <Label htmlFor={`lang-${l.value}`} className="text-sm text-[var(--m15-muted)] cursor-pointer">{l.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Zone principale */}
        <div className="flex-1 min-w-0">
          {/* Barre d'outils */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2">
              <button
                className="md:hidden flex items-center gap-1.5 text-sm text-[var(--m15-muted)] border border-[rgba(0,201,167,0.2)] rounded-lg px-3 py-1.5 hover:text-[var(--m15-white)]"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Filter className="h-4 w-4" /> Filtres
              </button>
              <span className="text-sm text-[var(--m15-muted)]">
                {isLoading ? "Chargement…" : `${total} ressource${total !== 1 ? "s" : ""}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Select value={tri} onValueChange={(v) => { setTri(v); setPage(1); }}>
                <SelectTrigger className="w-44 bg-[var(--m15-card)] border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] text-sm h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[rgba(0,201,167,0.2)]">
                  <SelectItem value="date" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Plus récent</SelectItem>
                  <SelectItem value="consultations" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Plus consulté</SelectItem>
                  <SelectItem value="telechargements" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Plus téléchargé</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded ${viewMode === "grid" ? "text-[#00C9A7]" : "text-[var(--m15-muted)]"}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded ${viewMode === "list" ? "text-[#00C9A7]" : "text-[var(--m15-muted)]"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Grille / Liste */}
          {isLoading ? (
            <div className={viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[var(--m15-card)] rounded-xl h-52 animate-pulse border border-[rgba(0,201,167,0.1)]" />
              ))}
            </div>
          ) : niveauFiltered.length === 0 ? (
            <div className="text-center py-20 text-[var(--m15-muted)]">
              <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg">Aucune ressource trouvée</p>
              <button onClick={resetFilters} className="mt-3 text-[#00C9A7] text-sm hover:underline">
                Réinitialiser les filtres
              </button>
            </div>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {niveauFiltered.map((r) => {
                const type = r.type ?? "autre";
                return (
                  <Card
                    key={r.id}
                    className="bg-[var(--m15-card)] border-[rgba(0,201,167,0.15)] hover:border-[rgba(0,201,167,0.35)] transition-all cursor-pointer group"
                    onClick={() => navigate(`/bibliotheque/ressource/${r.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="w-full h-28 rounded-lg mb-3 flex items-center justify-center bg-gradient-to-br from-[#1a2a44] to-[#0A1628] text-[#00C9A7] group-hover:from-[#1e3050] transition-all">
                        {r.couverture_url
                          ? <img src={r.couverture_url} alt="" className="h-full w-full object-cover rounded-lg" />
                          : <div className="text-4xl opacity-40">{TYPE_ICONS[type]}</div>
                        }
                      </div>

                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge className={`text-xs border ${TYPE_COLORS[type] ?? TYPE_COLORS["autre"]}`}>
                          {TYPE_LABELS[type]}
                        </Badge>
                        <button
                          onClick={(e) => { e.stopPropagation(); r.id && toggleFavori.mutate({ id: r.id }); }}
                          className={`shrink-0 transition-colors ${r.est_favori ? "text-yellow-400" : "text-[var(--m15-muted)] hover:text-yellow-400"}`}
                        >
                          {r.est_favori ? <Star className="h-4 w-4 fill-current" /> : <Star className="h-4 w-4" />}
                        </button>
                      </div>

                      <p className="font-semibold text-[var(--m15-white)] text-sm leading-snug mb-1 line-clamp-2">{r.titre}</p>
                      {r.auteur && <p className="text-xs text-[var(--m15-muted)] mb-2">{r.auteur}</p>}

                      <div className="flex flex-wrap gap-1 mb-3">
                        {(r.niveau ?? []).slice(0, 3).map((n) => (
                          <span key={n} className="text-xs bg-[var(--m15-card2)] text-[var(--m15-muted)] px-1.5 py-0.5 rounded">{n}</span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between text-xs text-[var(--m15-muted)]">
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{r.nb_consultations ?? 0}</span>
                          <span className="flex items-center gap-1"><Download className="h-3 w-3" />{r.nb_telechargements ?? 0}</span>
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/bibliotheque/ressource/${r.id}`); }}
                          className="text-[#00C9A7] hover:underline"
                        >
                          Consulter →
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {niveauFiltered.map((r) => {
                const type = r.type ?? "autre";
                return (
                  <div
                    key={r.id}
                    className="bg-[var(--m15-card)] border border-[rgba(0,201,167,0.15)] hover:border-[rgba(0,201,167,0.35)] rounded-xl px-4 py-3 flex items-center gap-4 cursor-pointer transition-all"
                    onClick={() => navigate(`/bibliotheque/ressource/${r.id}`)}
                  >
                    <div className="w-10 h-10 rounded-lg bg-[var(--m15-card2)] flex items-center justify-center text-[#00C9A7] shrink-0">
                      {TYPE_ICONS[type]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--m15-white)] text-sm truncate">{r.titre}</p>
                      <p className="text-xs text-[var(--m15-muted)] truncate">{r.auteur_nom ?? r.auteur ?? ""} · {(r.niveau ?? []).join(", ")}</p>
                    </div>
                    <Badge className={`text-xs border shrink-0 ${TYPE_COLORS[type] ?? TYPE_COLORS["autre"]}`}>
                      {TYPE_LABELS[type]}
                    </Badge>
                    <div className="flex items-center gap-3 text-xs text-[var(--m15-muted)] shrink-0">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{r.nb_consultations ?? 0}</span>
                      <span className="flex items-center gap-1"><Download className="h-3 w-3" />{r.nb_telechargements ?? 0}</span>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); r.id && toggleFavori.mutate({ id: r.id }); }}
                      className={`shrink-0 ${r.est_favori ? "text-yellow-400" : "text-[var(--m15-muted)] hover:text-yellow-400"}`}
                    >
                      <Star className={`h-4 w-4 ${r.est_favori ? "fill-current" : ""}`} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] hover:bg-[var(--m15-card)]"
              >
                ← Précédent
              </Button>
              <span className="text-sm text-[var(--m15-muted)]">Page {page} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="border-[rgba(0,201,167,0.2)] text-[var(--m15-white)] hover:bg-[var(--m15-card)]"
              >
                Suivant →
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
