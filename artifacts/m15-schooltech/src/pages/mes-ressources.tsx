import React, { useState } from "react";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Star, Clock, Eye, Download, BookOpen, FileText, Video,
  BookMarked, Layers, RotateCcw, HeartOff,
} from "lucide-react";
import {
  useGetBibliothequeFavoris,
  getGetBibliothequeFavorisQueryKey,
  useGetBibliothequeHistorique,
  getGetBibliothequeHistoriqueQueryKey,
  usePostBibliothequeRessourcesIdFavori,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const TYPE_LABELS: Record<string, string> = {
  manuel: "Manuel", fiche_cours: "Fiche de cours", exercice: "Exercice",
  video: "Vidéo", document_officiel: "Officiel", autre: "Autre",
};
const TYPE_ICONS: Record<string, React.ReactElement> = {
  manuel: <BookOpen className="h-5 w-5" />,
  fiche_cours: <FileText className="h-5 w-5" />,
  exercice: <Layers className="h-5 w-5" />,
  video: <Video className="h-5 w-5" />,
  document_officiel: <BookMarked className="h-5 w-5" />,
  autre: <FileText className="h-5 w-5" />,
};

export default function MesRessources() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [historiqueFilter, setHistoriqueFilter] = useState("tout");

  const favQk = getGetBibliothequeFavorisQueryKey();
  const { data: favData, isLoading: favLoading } = useGetBibliothequeFavoris({
    query: { queryKey: favQk },
  });

  const histParams = historiqueFilter !== "tout" ? { action: historiqueFilter } : {};
  const histQk = getGetBibliothequeHistoriqueQueryKey(histParams);
  const { data: histData, isLoading: histLoading } = useGetBibliothequeHistorique(histParams, {
    query: { queryKey: histQk },
  });

  const toggleFavori = usePostBibliothequeRessourcesIdFavori({
    mutation: {
      onSuccess: () => qc.invalidateQueries({ queryKey: favQk }),
    },
  });

  const favoris = favData?.ressources ?? [];
  const historique = histData?.historique ?? [];

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="font-syne text-2xl font-bold text-white">Mes ressources</h1>
        <p className="text-[#8B9DC3] text-sm mt-1">Vos favoris et votre historique de consultation</p>
      </div>

      <Tabs defaultValue="favoris">
        <TabsList className="bg-[#111E35] border border-[rgba(0,201,167,0.15)] mb-6">
          <TabsTrigger value="favoris" className="data-[state=active]:bg-[#00C9A7] data-[state=active]:text-[#0A1628] text-[#8B9DC3]">
            <Star className="h-4 w-4 mr-2" /> Mes favoris ({favoris.length})
          </TabsTrigger>
          <TabsTrigger value="historique" className="data-[state=active]:bg-[#00C9A7] data-[state=active]:text-[#0A1628] text-[#8B9DC3]">
            <Clock className="h-4 w-4 mr-2" /> Mon historique ({historique.length})
          </TabsTrigger>
        </TabsList>

        {/* Favoris */}
        <TabsContent value="favoris">
          {favLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-[#111E35] rounded-xl animate-pulse" />)}
            </div>
          ) : favoris.length === 0 ? (
            <div className="text-center py-20 text-[#8B9DC3]">
              <Star className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium mb-1">Aucun favori</p>
              <p className="text-sm mb-4">Parcourez le catalogue et ajoutez des ressources à vos favoris</p>
              <Button onClick={() => navigate("/bibliotheque")} className="bg-[#00C9A7] hover:bg-[#00b096] text-[#0A1628]">
                Explorer le catalogue
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favoris.map((r) => {
                const type = r.type ?? "autre";
                return (
                  <div
                    key={r.id}
                    className="bg-[#111E35] border border-[rgba(0,201,167,0.15)] hover:border-[rgba(0,201,167,0.35)] rounded-xl p-4 cursor-pointer transition-all group"
                    onClick={() => navigate(`/bibliotheque/ressource/${r.id}`)}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="w-10 h-10 rounded-lg bg-[#1a2a44] flex items-center justify-center text-[#00C9A7]">
                        {TYPE_ICONS[type] ?? <FileText className="h-5 w-5" />}
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); r.id && toggleFavori.mutate({ id: r.id }); }}
                        className="text-yellow-400 hover:text-[#8B9DC3] transition-colors"
                        title="Retirer des favoris"
                      >
                        <HeartOff className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="font-semibold text-white text-sm line-clamp-2 mb-1">{r.titre}</p>
                    {r.auteur && <p className="text-xs text-[#8B9DC3] mb-2">{r.auteur}</p>}
                    <div className="flex items-center justify-between">
                      <Badge className="text-xs bg-[#1a2a44] text-[#8B9DC3] border-[rgba(0,201,167,0.2)]">
                        {TYPE_LABELS[type]}
                      </Badge>
                      <span className="text-xs text-[#8B9DC3]">
                        {(r.niveau ?? []).slice(0, 2).join(", ")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Historique */}
        <TabsContent value="historique">
          <div className="flex gap-2 mb-4">
            {["tout", "consultation", "telechargement"].map((f) => (
              <button
                key={f}
                onClick={() => setHistoriqueFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-all ${
                  historiqueFilter === f
                    ? "bg-[#00C9A7] text-[#0A1628] border-[#00C9A7]"
                    : "border-[rgba(0,201,167,0.2)] text-[#8B9DC3] hover:text-white"
                }`}
              >
                {f === "tout" ? "Tout" : f === "consultation" ? "Consultations" : "Téléchargements"}
              </button>
            ))}
          </div>

          {histLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-[#111E35] rounded-xl animate-pulse" />)}
            </div>
          ) : historique.length === 0 ? (
            <div className="text-center py-20 text-[#8B9DC3]">
              <Clock className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-lg font-medium mb-1">Aucun historique</p>
              <p className="text-sm">Vos consultations et téléchargements apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-2">
              {historique.map((h) => (
                <div
                  key={h.id}
                  className="bg-[#111E35] border border-[rgba(0,201,167,0.15)] rounded-xl px-4 py-3 flex items-center gap-4"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    h.action === "consultation"
                      ? "bg-blue-500/20 text-blue-300"
                      : "bg-green-500/20 text-green-300"
                  }`}>
                    {h.action === "consultation" ? <Eye className="h-4 w-4" /> : <Download className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{h.ressource_titre}</p>
                    <p className="text-xs text-[#8B9DC3]">
                      {h.action === "consultation" ? "Consulté" : "Téléchargé"} ·{" "}
                      {h.created_at
                        ? formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: fr })
                        : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate(`/bibliotheque/ressource/${h.ressource_id}`)}
                    className="shrink-0 text-xs text-[#00C9A7] hover:underline flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" /> Reconsulter
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
