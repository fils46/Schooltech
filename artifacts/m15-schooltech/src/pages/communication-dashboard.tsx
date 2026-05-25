import { useState } from "react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetAnnonces,
  useDeleteAnnoncesId,
  usePutAnnoncesIdPublier,
  getGetAnnoncesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Megaphone, Plus, Eye, Pencil, Trash2, SendHorizonal,
  Info, AlertTriangle, CalendarDays, Bell, Pin,
  CheckCircle2, FileText, Loader2,
} from "lucide-react";

interface AnnonceItem {
  id: string; titre: string; contenu: string; type: string;
  destinataires: string[]; date_publication: string | null;
  publie: boolean; epingle: boolean; nb_vues: number; lu: boolean;
  created_at: string; auteur_nom: string; auteur_prenoms: string;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  information: { label: "Information", icon: Info,          color: "#0080FF", bg: "rgba(0,128,255,0.12)" },
  urgence:     { label: "Urgent",      icon: AlertTriangle, color: "#FF4D6D", bg: "rgba(255,77,109,0.12)" },
  evenement:   { label: "Événement",   icon: CalendarDays,  color: "#F5C842", bg: "rgba(245,200,66,0.12)" },
  rappel:      { label: "Rappel",      icon: Bell,          color: "#00C9A7", bg: "rgba(0,201,167,0.12)" },
};

const ROLE_LABELS: Record<string, string> = {
  tous: "Tous", directeur: "Directeur", censeur: "Censeur",
  professeur: "Professeurs", eleve: "Élèves", parent: "Parents",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const TYPES_FILTER = [
  { id: "", label: "Tous les types" },
  { id: "information", label: "Information" },
  { id: "urgence",     label: "Urgent" },
  { id: "evenement",   label: "Événement" },
  { id: "rappel",      label: "Rappel" },
];

const PUBLIE_FILTER = [
  { id: "", label: "Tous" },
  { id: "false", label: "Brouillons" },
  { id: "true",  label: "Publiées" },
];

export default function CommunicationDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [typeFilter,   setTypeFilter]   = useState("");
  const [publieFilter, setPublieFilter] = useState("");
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const params = {
    ...(typeFilter   ? { type: typeFilter as "information" | "urgence" | "evenement" | "rappel" } : {}),
    ...(publieFilter ? { publie: publieFilter === "true" } : {}),
  };
  const qKey = getGetAnnoncesQueryKey(params);

  const { data, isLoading } = useGetAnnonces(params, {
    query: { queryKey: qKey, enabled: !!user, staleTime: 30_000 },
  });
  const annonces: AnnonceItem[] = (data as any)?.annonces ?? [];
  const total: number           = (data as any)?.total    ?? 0;

  const deleteMut  = useDeleteAnnoncesId();
  const publishMut = usePutAnnoncesIdPublier();

  const invalidate = () => void qc.invalidateQueries({ queryKey: ["get", "/api/annonces"] });

  function handleDelete(id: string) {
    setDeletingId(id);
    deleteMut.mutate({ id }, {
      onSuccess: () => { toast({ title: "Annonce supprimée." }); setDeletingId(null); invalidate(); },
      onError:   () => { toast({ title: "Erreur lors de la suppression.", variant: "destructive" }); setDeletingId(null); },
    });
  }

  function handlePublish(id: string) {
    setPublishingId(id);
    publishMut.mutate({ id }, {
      onSuccess: () => { toast({ title: "Annonce publiée et notifications envoyées." }); setPublishingId(null); invalidate(); },
      onError:   () => { toast({ title: "Erreur lors de la publication.", variant: "destructive" }); setPublishingId(null); },
    });
  }

  /* Stats */
  const nbPubliees  = annonces.filter(a => a.publie).length;
  const nbBrouillon = annonces.filter(a => !a.publie).length;
  const nbUrgentes  = annonces.filter(a => a.type === "urgence" && a.publie).length;
  const totalVues   = annonces.reduce((s, a) => s + (a.nb_vues ?? 0), 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"
            style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            <Megaphone className="w-6 h-6" style={{ color: "#00C9A7" }} />
            Annonces
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            {total} annonce{total !== 1 ? "s" : ""} au total
          </p>
        </div>
        <Button
          onClick={() => setLocation("/annonces/creer")}
          className="gap-2"
          style={{ background: "linear-gradient(135deg, #0080FF, #00C9A7)", border: "none" }}>
          <Plus className="w-4 h-4" /> Nouvelle annonce
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Publiées",   value: nbPubliees,  color: "#00C9A7", icon: CheckCircle2 },
          { label: "Brouillons", value: nbBrouillon, color: "#F5C842", icon: FileText },
          { label: "Urgentes",   value: nbUrgentes,  color: "#FF4D6D", icon: AlertTriangle },
          { label: "Vues totales", value: totalVues,  color: "#0080FF", icon: Eye },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="p-5 rounded-2xl flex items-center gap-4"
              style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${s.color}18` }}>
                <Icon className="w-5 h-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{s.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1.5">
          {TYPES_FILTER.map(f => (
            <button key={f.id} onClick={() => setTypeFilter(f.id)}
              className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: typeFilter === f.id ? "rgba(0,201,167,0.12)" : "var(--m15-card)",
                color: typeFilter === f.id ? "#00C9A7" : "var(--m15-muted)",
                border: typeFilter === f.id ? "1px solid rgba(0,201,167,0.25)" : "1px solid var(--m15-border)",
              }}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {PUBLIE_FILTER.map(f => (
            <button key={f.id} onClick={() => setPublieFilter(f.id)}
              className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: publieFilter === f.id ? "rgba(0,128,255,0.12)" : "var(--m15-card)",
                color: publieFilter === f.id ? "#0080FF" : "var(--m15-muted)",
                border: publieFilter === f.id ? "1px solid rgba(0,128,255,0.25)" : "1px solid var(--m15-border)",
              }}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table annonces */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--m15-border)" }}>
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : annonces.length === 0 ? (
          <div className="p-16 text-center">
            <Megaphone className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
            <p style={{ color: "var(--m15-muted)" }}>Aucune annonce. Créez-en une !</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid var(--m15-border)" }}>
                {["Titre", "Type", "Destinataires", "Date publication", "Statut", "Vues", "Actions"].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-semibold text-xs uppercase tracking-wide"
                    style={{ color: "var(--m15-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {annonces.map((a, idx) => {
                const meta = TYPE_META[a.type] ?? TYPE_META["information"];
                const Icon = meta.icon;
                return (
                  <tr key={a.id}
                    style={{
                      borderBottom: idx < annonces.length - 1 ? "1px solid var(--m15-border)" : "none",
                      background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                    }}>
                    {/* Titre */}
                    <td className="px-4 py-3 max-w-xs">
                      <div className="flex items-center gap-2">
                        {a.epingle && <Pin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#F5C842" }} />}
                        <span className="font-medium truncate" style={{ color: "var(--m15-white)" }}>
                          {a.titre}
                        </span>
                      </div>
                    </td>
                    {/* Type */}
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit"
                        style={{ background: meta.bg, color: meta.color }}>
                        <Icon className="w-3 h-3" /> {meta.label}
                      </span>
                    </td>
                    {/* Destinataires */}
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(a.destinataires ?? ["tous"]).map(d => (
                          <span key={d} className="px-2 py-0.5 rounded-full text-xs"
                            style={{ background: "rgba(255,255,255,0.06)", color: "var(--m15-muted)" }}>
                            {ROLE_LABELS[d] ?? d}
                          </span>
                        ))}
                      </div>
                    </td>
                    {/* Date */}
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--m15-muted)" }}>
                      {fmtDate(a.date_publication)}
                    </td>
                    {/* Statut */}
                    <td className="px-4 py-3">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          background: a.publie ? "rgba(0,201,167,0.12)" : "rgba(245,200,66,0.12)",
                          color: a.publie ? "#00C9A7" : "#F5C842",
                        }}>
                        {a.publie ? "Publiée" : "Brouillon"}
                      </span>
                    </td>
                    {/* Vues */}
                    <td className="px-4 py-3 text-center" style={{ color: "var(--m15-muted)" }}>
                      {a.nb_vues}
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Voir */}
                        <button
                          onClick={() => setLocation(`/fil-annonces?id=${a.id}`)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "var(--m15-muted)" }}
                          title="Voir"
                          onMouseEnter={e => (e.currentTarget.style.color = "#0080FF")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--m15-muted)")}>
                          <Eye className="w-4 h-4" />
                        </button>
                        {/* Modifier */}
                        <button
                          onClick={() => setLocation(`/annonces/${a.id}/editer`)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "var(--m15-muted)" }}
                          title="Modifier"
                          onMouseEnter={e => (e.currentTarget.style.color = "#00C9A7")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--m15-muted)")}>
                          <Pencil className="w-4 h-4" />
                        </button>
                        {/* Publier (si brouillon) */}
                        {!a.publie && (
                          <button
                            onClick={() => handlePublish(a.id)}
                            disabled={publishingId === a.id}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--m15-muted)" }}
                            title="Publier"
                            onMouseEnter={e => (e.currentTarget.style.color = "#F5C842")}
                            onMouseLeave={e => (e.currentTarget.style.color = "var(--m15-muted)")}>
                            {publishingId === a.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <SendHorizonal className="w-4 h-4" />}
                          </button>
                        )}
                        {/* Supprimer */}
                        <button
                          onClick={() => handleDelete(a.id)}
                          disabled={deletingId === a.id}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "var(--m15-muted)" }}
                          title="Supprimer"
                          onMouseEnter={e => (e.currentTarget.style.color = "#FF4D6D")}
                          onMouseLeave={e => (e.currentTarget.style.color = "var(--m15-muted)")}>
                          {deletingId === a.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
