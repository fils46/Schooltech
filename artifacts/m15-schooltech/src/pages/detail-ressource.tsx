import React from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Download, Star, BookOpen, FileText, Video, BookMarked, Layers,
  Eye, ArrowLeft, Calendar, Globe,
} from "lucide-react";
import {
  useGetBibliothequeRessourcesId,
  getGetBibliothequeRessourcesIdQueryKey,
  useGetBibliothequeRessources,
  getGetBibliothequeRessourcesQueryKey,
  usePostBibliothequeRessourcesIdFavori,
  usePostBibliothequeRessourcesIdTelecharger,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TYPE_LABELS: Record<string, string> = {
  manuel: "Manuel", fiche_cours: "Fiche de cours", exercice: "Exercice",
  video: "Vidéo", document_officiel: "Officiel", autre: "Autre",
};
const TYPE_ICONS: Record<string, React.ReactElement> = {
  manuel: <BookOpen className="h-8 w-8" />,
  fiche_cours: <FileText className="h-8 w-8" />,
  exercice: <Layers className="h-8 w-8" />,
  video: <Video className="h-8 w-8" />,
  document_officiel: <BookMarked className="h-8 w-8" />,
  autre: <FileText className="h-8 w-8" />,
};
const TYPE_COLORS: Record<string, string> = {
  manuel: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  fiche_cours: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  exercice: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  video: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  document_officiel: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  autre: "bg-slate-500/20 text-slate-300 border-slate-500/30",
};

export default function DetailRessource() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  const qk = getGetBibliothequeRessourcesIdQueryKey(id!);
  const { data, isLoading } = useGetBibliothequeRessourcesId(id!, {
    query: { queryKey: qk, enabled: !!id },
  });
  const ressource = data?.ressource;

  const similairesParams = ressource ? { type: ressource.type, limit: 4 } : {};
  const similairesQk = getGetBibliothequeRessourcesQueryKey(similairesParams);
  const { data: similairesData } = useGetBibliothequeRessources(similairesParams, {
    query: { queryKey: similairesQk, enabled: !!ressource },
  });
  const similaires = (similairesData?.ressources ?? []).filter((r) => r.id !== id).slice(0, 4);

  const toggleFavori = usePostBibliothequeRessourcesIdFavori({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: qk }),
    },
  });

  const telecharger = usePostBibliothequeRessourcesIdTelecharger({
    mutation: {
      onSuccess: (data) => {
        window.open(data.fichier_url, "_blank");
        toast.success("Téléchargement lancé");
        qc.invalidateQueries({ queryKey: qk });
      },
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-[#00C9A7]" />
      </div>
    );
  }

  if (!ressource) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex flex-col items-center justify-center text-[var(--m15-muted)]">
        <p className="text-lg mb-4">Ressource introuvable</p>
        <Button onClick={() => navigate("/bibliotheque")} variant="outline">
          ← Retour au catalogue
        </Button>
      </div>
    );
  }

  const type = ressource.type ?? "autre";
  const dateAjout = ressource.created_at
    ? new Date(ressource.created_at).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "—";

  return (
    <div className="min-h-screen bg-[#0A1628] text-[var(--m15-white)] px-6 py-8">
      <div className="max-w-5xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[var(--m15-muted)] mb-6">
          <button onClick={() => navigate("/bibliotheque")} className="hover:text-[#00C9A7] flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> Bibliothèque
          </button>
          {ressource.matiere_nom && (
            <>
              <span>/</span>
              <button
                onClick={() => navigate(`/bibliotheque?matiere_id=${ressource.matiere_id}`)}
                className="hover:text-[#00C9A7]"
              >
                {ressource.matiere_nom}
              </button>
            </>
          )}
          <span>/</span>
          <span className="text-[var(--m15-white)] truncate">{ressource.titre}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Colonne gauche */}
          <div className="md:col-span-1 space-y-4">
            <div className="w-full aspect-[3/4] rounded-xl bg-gradient-to-br from-[#111E35] to-[#0A1628] border border-[rgba(0,201,167,0.15)] flex items-center justify-center text-[#00C9A7]">
              {ressource.couverture_url
                ? <img src={ressource.couverture_url} alt="" className="h-full w-full object-cover rounded-xl" />
                : <div className="opacity-30 scale-150">{TYPE_ICONS[type]}</div>
              }
            </div>

            <Button
              className="w-full bg-[#00C9A7] hover:bg-[#00b096] text-[#0A1628] font-semibold h-11"
              onClick={() => telecharger.mutate({ id: id! })}
              disabled={telecharger.isPending}
            >
              <Download className="h-4 w-4 mr-2" />
              {telecharger.isPending ? "En cours…" : "Télécharger"}
            </Button>

            <Button
              variant="outline"
              className={`w-full border-[rgba(0,201,167,0.3)] h-10 ${
                ressource.est_favori ? "text-yellow-400 border-yellow-400/30" : "text-[var(--m15-muted)] hover:text-yellow-400"
              }`}
              onClick={() => toggleFavori.mutate({ id: id! })}
            >
              <Star className={`h-4 w-4 mr-2 ${ressource.est_favori ? "fill-current" : ""}`} />
              {ressource.est_favori ? "Retirer des favoris" : "Ajouter aux favoris"}
            </Button>

            <div className="bg-[#111E35] border border-[rgba(0,201,167,0.15)] rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between text-[var(--m15-muted)]">
                <span>Format</span>
                <span className="text-[var(--m15-white)]">{ressource.fichier_type ?? "—"}</span>
              </div>
              <div className="flex justify-between text-[var(--m15-muted)]">
                <span>Taille</span>
                <span className="text-[var(--m15-white)]">
                  {ressource.fichier_taille
                    ? `${Math.round((ressource.fichier_taille / 1024) * 10) / 10} Mo`
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-[var(--m15-muted)]">
                <span>Langue</span>
                <span className="text-[var(--m15-white)] flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {ressource.langue === "fr" ? "Français" : (ressource.langue ?? "—")}
                </span>
              </div>
            </div>
          </div>

          {/* Colonne droite */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge className={`border ${TYPE_COLORS[type] ?? TYPE_COLORS["autre"]}`}>
                  {TYPE_LABELS[type]}
                </Badge>
                {(ressource.niveau ?? []).map((n) => (
                  <Badge key={n} className="bg-[#1a2a44] text-[var(--m15-muted)] border-[rgba(0,201,167,0.2)]">{n}</Badge>
                ))}
              </div>

              <h1 className="font-syne text-2xl font-bold text-[var(--m15-white)] mb-2">{ressource.titre}</h1>

              {ressource.auteur && (
                <p className="text-[var(--m15-muted)] text-sm mb-1">
                  Document rédigé par <span className="text-[var(--m15-white)]">{ressource.auteur}</span>
                </p>
              )}
              {ressource.auteur_nom && (
                <p className="text-[var(--m15-muted)] text-sm">
                  Ajouté par <span className="text-[var(--m15-white)]">{ressource.auteur_nom}</span>
                  {ressource.auteur_role && <span className="text-[var(--m15-muted)]"> · {ressource.auteur_role}</span>}
                </p>
              )}
            </div>

            {ressource.description && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--m15-muted)] uppercase tracking-wide mb-2">Description</h3>
                <p className="text-[var(--m15-muted)] leading-relaxed">{ressource.description}</p>
              </div>
            )}

            {ressource.matiere_nom && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--m15-muted)] uppercase tracking-wide mb-2">Matière</h3>
                <Badge className="bg-[#1a2a44] text-[#00C9A7] border-[rgba(0,201,167,0.3)]">{ressource.matiere_nom}</Badge>
              </div>
            )}

            {ressource.mots_cles && ressource.mots_cles.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-[var(--m15-muted)] uppercase tracking-wide mb-2">Mots-clés</h3>
                <div className="flex flex-wrap gap-2">
                  {ressource.mots_cles.map((kw) => (
                    <button
                      key={kw}
                      onClick={() => navigate(`/bibliotheque?q=${encodeURIComponent(kw)}`)}
                      className="text-xs bg-[#1a2a44] text-[var(--m15-muted)] px-2.5 py-1 rounded-full border border-[rgba(0,201,167,0.15)] hover:border-[#00C9A7] hover:text-[var(--m15-white)] transition-colors"
                    >
                      #{kw}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-6 text-sm text-[var(--m15-muted)]">
              <span className="flex items-center gap-1.5">
                <Eye className="h-4 w-4" /> {ressource.nb_consultations ?? 0} consultation{(ressource.nb_consultations ?? 0) !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Download className="h-4 w-4" /> {ressource.nb_telechargements ?? 0} téléchargement{(ressource.nb_telechargements ?? 0) !== 1 ? "s" : ""}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" /> {dateAjout}
              </span>
            </div>
          </div>
        </div>

        {/* Ressources similaires */}
        {similaires.length > 0 && (
          <div className="mt-12">
            <h2 className="font-syne text-lg font-semibold mb-4">Ressources similaires</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {similaires.map((r) => {
                const rType = r.type ?? "autre";
                return (
                  <Card
                    key={r.id}
                    className="bg-[#111E35] border-[rgba(0,201,167,0.15)] hover:border-[rgba(0,201,167,0.35)] cursor-pointer transition-all"
                    onClick={() => navigate(`/bibliotheque/ressource/${r.id}`)}
                  >
                    <CardContent className="p-3">
                      <div className="h-20 rounded-lg bg-[#1a2a44] flex items-center justify-center text-[#00C9A7] mb-2">
                        <div className="opacity-40">{TYPE_ICONS[rType]}</div>
                      </div>
                      <p className="text-xs font-semibold text-[var(--m15-white)] line-clamp-2">{r.titre}</p>
                      <p className="text-xs text-[var(--m15-muted)] mt-1">{TYPE_LABELS[rType]}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
