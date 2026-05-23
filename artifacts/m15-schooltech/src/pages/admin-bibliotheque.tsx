import React, { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  BookOpen, Clock, Eye, Download, Check, Trash2, BarChart2,
  TrendingUp, FileText, Video, BookMarked, Layers, X,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useGetBibliothequeRessourcesEnAttente,
  getGetBibliothequeRessourcesEnAttenteQueryKey,
  useGetBibliothequeRessources,
  getGetBibliothequeRessourcesQueryKey,
  useGetBibliothequeStats,
  getGetBibliothequeStatsQueryKey,
  usePutBibliothequeRessourcesIdValider,
  usePutBibliothequeRessourcesIdPublier,
  useDeleteBibliothequeRessourcesId,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";

const TYPE_LABELS: Record<string, string> = {
  manuel: "Manuel", fiche_cours: "Fiche de cours", exercice: "Exercice",
  video: "Vidéo", document_officiel: "Officiel", autre: "Autre",
};
const TYPE_ICONS: Record<string, React.ReactElement> = {
  manuel: <BookOpen className="h-4 w-4" />,
  fiche_cours: <FileText className="h-4 w-4" />,
  exercice: <Layers className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  document_officiel: <BookMarked className="h-4 w-4" />,
  autre: <FileText className="h-4 w-4" />,
};

export default function AdminBibliotheque() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState<"attente" | "toutes" | "stats">("attente");

  const attenteQk = getGetBibliothequeRessourcesEnAttenteQueryKey();
  const { data: attenteData, isLoading: attenteLoading } = useGetBibliothequeRessourcesEnAttente({
    query: { queryKey: attenteQk },
  });

  const toutesQk = getGetBibliothequeRessourcesQueryKey({});
  const { data: toutesData, isLoading: toutesLoading } = useGetBibliothequeRessources({}, {
    query: { queryKey: toutesQk },
  });

  const statsQk = getGetBibliothequeStatsQueryKey();
  const { data: statsData } = useGetBibliothequeStats({ query: { queryKey: statsQk } });

  const valider = usePutBibliothequeRessourcesIdValider({
    mutation: {
      onSuccess: () => {
        toast.success("Ressource validée et publiée");
        qc.invalidateQueries({ queryKey: attenteQk });
        qc.invalidateQueries({ queryKey: toutesQk });
        qc.invalidateQueries({ queryKey: statsQk });
      },
    },
  });

  const publier = usePutBibliothequeRessourcesIdPublier({
    mutation: {
      onSuccess: () => {
        toast.success("Statut de publication mis à jour");
        qc.invalidateQueries({ queryKey: toutesQk });
      },
    },
  });

  const supprimer = useDeleteBibliothequeRessourcesId({
    mutation: {
      onSuccess: () => {
        toast.success("Ressource supprimée");
        qc.invalidateQueries({ queryKey: attenteQk });
        qc.invalidateQueries({ queryKey: toutesQk });
        qc.invalidateQueries({ queryKey: statsQk });
        setDeleteId(null);
      },
    },
  });

  const enAttente = attenteData?.ressources ?? [];
  const toutes = toutesData?.ressources ?? [];
  const stats = statsData;

  const statCards = [
    { label: "Ressources publiées", value: stats?.total_publiees ?? 0, icon: <BookOpen className="h-5 w-5" />, color: "text-[#00C9A7]" },
    { label: "En attente validation", value: stats?.en_attente_validation ?? 0, icon: <Clock className="h-5 w-5" />, color: "text-yellow-400" },
    { label: "Consultations ce mois", value: stats?.consultations_mois ?? 0, icon: <Eye className="h-5 w-5" />, color: "text-blue-400" },
    { label: "Téléchargements ce mois", value: stats?.telechargements_mois ?? 0, icon: <Download className="h-5 w-5" />, color: "text-purple-400" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="font-syne text-2xl font-bold text-white">Administration bibliothèque</h1>
        <p className="text-[#8B9DC3] text-sm mt-1">Validation, gestion et statistiques des ressources</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((s) => (
          <Card key={s.label} className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
            <CardContent className="p-4">
              <div className={`${s.color} mb-2`}>{s.icon}</div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-[#8B9DC3] mt-0.5">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-[rgba(0,201,167,0.1)] pb-0">
        {(["attente", "toutes", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-[#00C9A7] text-[#00C9A7]"
                : "border-transparent text-[#8B9DC3] hover:text-white"
            }`}
          >
            {t === "attente" ? `En attente (${enAttente.length})` : t === "toutes" ? "Toutes les ressources" : "Statistiques"}
          </button>
        ))}
      </div>

      {/* En attente */}
      {tab === "attente" && (
        attenteLoading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="h-32 bg-[#111E35] rounded-xl animate-pulse" />)}
          </div>
        ) : enAttente.length === 0 ? (
          <div className="text-center py-16 text-[#8B9DC3] bg-[#111E35] rounded-xl border border-[rgba(0,201,167,0.1)]">
            <Check className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Aucune ressource en attente</p>
          </div>
        ) : (
          <div className="space-y-4">
            {enAttente.map((r) => {
              const type = r.type ?? "autre";
              return (
                <div key={r.id} className="bg-[#111E35] border border-yellow-500/20 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-[#1a2a44] flex items-center justify-center text-[#00C9A7] shrink-0">
                        {TYPE_ICONS[type]}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-white truncate">{r.titre}</p>
                        <p className="text-sm text-[#8B9DC3]">
                          {TYPE_LABELS[type]} · {(r.niveau ?? []).join(", ")} · par <span className="text-white">{r.auteur_nom ?? "—"}</span>
                        </p>
                        {r.description && (
                          <p className="text-xs text-[#8B9DC3] mt-1 line-clamp-2">{r.description}</p>
                        )}
                        <p className="text-xs text-[#8B9DC3] mt-1">
                          Déposé le {r.created_at ? new Date(r.created_at).toLocaleDateString("fr-FR") : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => r.id && valider.mutate({ id: r.id })}
                        disabled={valider.isPending}
                        className="bg-[#00C9A7] hover:bg-[#00b096] text-[#0A1628] font-semibold"
                      >
                        <Check className="h-4 w-4 mr-1" /> Valider & Publier
                      </Button>
                      <button
                        onClick={() => r.id && setDeleteId(r.id)}
                        className="p-1.5 text-[#8B9DC3] hover:text-red-400 transition-colors"
                        title="Refuser et supprimer"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Toutes les ressources */}
      {tab === "toutes" && (
        toutesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-[#111E35] rounded-xl animate-pulse" />)}
          </div>
        ) : (
          <div className="bg-[#111E35] border border-[rgba(0,201,167,0.15)] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[rgba(0,201,167,0.1)]">
                  <th className="text-left px-4 py-3 text-xs text-[#8B9DC3] uppercase tracking-wide">Titre</th>
                  <th className="text-left px-4 py-3 text-xs text-[#8B9DC3] uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs text-[#8B9DC3] uppercase tracking-wide">Statut</th>
                  <th className="text-right px-4 py-3 text-xs text-[#8B9DC3] uppercase tracking-wide">Consult.</th>
                  <th className="text-right px-4 py-3 text-xs text-[#8B9DC3] uppercase tracking-wide">DL</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {toutes.map((r) => (
                  <tr key={r.id} className="border-b border-[rgba(0,201,167,0.05)] last:border-0 hover:bg-[rgba(0,201,167,0.03)]">
                    <td className="px-4 py-3">
                      <p className="text-white text-sm font-medium truncate max-w-[200px]">{r.titre}</p>
                      <p className="text-xs text-[#8B9DC3]">{r.auteur_nom}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[#8B9DC3]">{TYPE_LABELS[r.type ?? "autre"]}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge className={`text-xs border w-fit ${r.valide ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" : "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"}`}>
                          {r.valide ? "Validé" : "Non validé"}
                        </Badge>
                        <Badge className={`text-xs border w-fit ${r.publie ? "bg-green-500/20 text-green-300 border-green-500/30" : "bg-slate-500/20 text-slate-300 border-slate-500/30"}`}>
                          {r.publie ? "Publié" : "Brouillon"}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-[#8B9DC3]">{r.nb_consultations ?? 0}</td>
                    <td className="px-4 py-3 text-right text-sm text-[#8B9DC3]">{r.nb_telechargements ?? 0}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => r.id && publier.mutate({ id: r.id, data: { publie: !r.publie } })}
                          className={`text-xs px-2 py-1 rounded border transition-colors ${
                            r.publie
                              ? "border-slate-500/30 text-slate-300 hover:border-slate-400"
                              : "border-green-500/30 text-green-300 hover:border-green-400"
                          }`}
                        >
                          {r.publie ? "Dépublier" : "Publier"}
                        </button>
                        <button
                          onClick={() => navigate(`/bibliotheque/ressource/${r.id}/stats`)}
                          className="p-1.5 text-[#8B9DC3] hover:text-[#F5C842]"
                        >
                          <BarChart2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => r.id && setDeleteId(r.id)} className="p-1.5 text-[#8B9DC3] hover:text-red-400">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Statistiques */}
      {tab === "stats" && (
        <div className="space-y-8">
          {stats?.activite_30j && stats.activite_30j.length > 0 && (
            <div className="bg-[#111E35] border border-[rgba(0,201,167,0.15)] rounded-xl p-5">
              <h3 className="font-syne font-semibold mb-4">Activité — 30 derniers jours</h3>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={stats.activite_30j}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.1)" />
                  <XAxis dataKey="date" tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }} />
                  <Legend />
                  <Line type="monotone" dataKey="consultations" stroke="#00C9A7" name="Consultations" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="telechargements" stroke="#F5C842" name="Téléchargements" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {stats?.par_type && (
              <div className="bg-[#111E35] border border-[rgba(0,201,167,0.15)] rounded-xl p-5">
                <h3 className="font-syne font-semibold mb-4">Répartition par type</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={stats.par_type} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,157,195,0.1)" />
                    <XAxis type="number" tick={{ fill: "#8B9DC3", fontSize: 11 }} />
                    <YAxis dataKey="type" type="category" tick={{ fill: "#8B9DC3", fontSize: 11 }} width={70}
                      tickFormatter={(v: string) => TYPE_LABELS[v] ?? v} />
                    <Tooltip contentStyle={{ background: "#111E35", border: "1px solid rgba(0,201,167,0.2)", borderRadius: 8 }} />
                    <Bar dataKey="total" fill="#00C9A7" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {stats?.top_consultees && stats.top_consultees.length > 0 && (
              <div className="bg-[#111E35] border border-[rgba(0,201,167,0.15)] rounded-xl p-5">
                <h3 className="font-syne font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-[#00C9A7]" /> Top 5 consultées
                </h3>
                <div className="space-y-3">
                  {stats.top_consultees.slice(0, 5).map((r, i) => {
                    const maxConsult = stats.top_consultees?.[0]?.nb_consultations ?? 1;
                    const consult = r.nb_consultations ?? 0;
                    return (
                      <div key={r.id} className="flex items-center gap-3">
                        <span className="text-lg font-bold text-[#8B9DC3] w-5 shrink-0">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{r.titre}</p>
                          <p className="text-xs text-[#8B9DC3]">{consult} consultations</p>
                        </div>
                        <div className="h-1.5 bg-[#1a2a44] rounded-full w-20 shrink-0">
                          <div
                            className="h-full bg-[#00C9A7] rounded-full"
                            style={{ width: `${Math.min(100, (consult / (maxConsult || 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent className="bg-[#111E35] border-[rgba(0,201,167,0.2)] text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette ressource ?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#8B9DC3]">
              Cette action est irréversible. La ressource sera définitivement retirée de la bibliothèque.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-[rgba(0,201,167,0.2)] text-[#8B9DC3] hover:text-white bg-transparent">
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && supprimer.mutate({ id: deleteId })}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
