import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetApiAnnonces,
  useGetApiAnnoncesId,
  getGetApiAnnoncesQueryKey,
  getGetApiAnnoncesNonLuesCountQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useSocket } from "@/hooks/useSocket";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone, Pin, Info, AlertTriangle, CalendarDays, Bell, Clock,
} from "lucide-react";

interface AnnonceItem {
  id: string; titre: string; contenu: string; type: string;
  destinataires: string[]; date_publication: string | null;
  date_expiration: string | null; publie: boolean; epingle: boolean;
  nb_vues: number; lu: boolean; created_at: string;
  auteur_nom: string; auteur_prenoms: string; auteur_role: string;
  piece_jointe_url?: string | null; piece_jointe_nom?: string | null;
}

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  information: { label: "Information",  icon: Info,          color: "#0080FF", bg: "rgba(0,128,255,0.12)" },
  urgence:     { label: "Urgent",       icon: AlertTriangle, color: "#FF4D6D", bg: "rgba(255,77,109,0.12)" },
  evenement:   { label: "Événement",    icon: CalendarDays,  color: "#F5C842", bg: "rgba(245,200,66,0.12)" },
  rappel:      { label: "Rappel",       icon: Bell,          color: "#00C9A7", bg: "rgba(0,201,167,0.12)" },
};

function timeAgo(d: string | null) {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  if (days < 7) return `Il y a ${days} jours`;
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const TYPES = [
  { id: "", label: "Tous" },
  { id: "information", label: "Info" },
  { id: "urgence", label: "Urgent" },
  { id: "evenement", label: "Événement" },
  { id: "rappel", label: "Rappel" },
];

export default function FilAnnonces() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const socket = useSocket();

  const [typeFilter, setTypeFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = {
    ...(typeFilter ? { type: typeFilter as "information" | "urgence" | "evenement" | "rappel" } : {}),
    publie: true,
  };
  const qKey = getGetApiAnnoncesQueryKey(params);

  const { data, isLoading } = useGetApiAnnonces(params, {
    query: { queryKey: qKey, enabled: !!user, staleTime: 30_000 },
  });
  const annonces: AnnonceItem[] = (data as any)?.annonces ?? [];
  const total: number = (data as any)?.total ?? 0;

  const detailQk = getGetApiAnnoncesQueryKey({ id: selectedId ?? "" } as any);
  const { data: detailData } = useGetApiAnnoncesId(selectedId ?? "", {
    query: { queryKey: detailQk, enabled: !!selectedId, staleTime: 0 },
  });
  const detail: AnnonceItem | null = (detailData as any)?.annonce ?? null;

  /* Socket : nouvelle annonce en temps réel */
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      void qc.invalidateQueries({ queryKey: qKey });
      void qc.invalidateQueries({ queryKey: getGetApiAnnoncesNonLuesCountQueryKey() });
    };
    socket.on("nouvelle_annonce", handler);
    return () => { socket.off("nouvelle_annonce", handler); };
  }, [socket, qc, qKey]);

  function openDetail(id: string) {
    setSelectedId(id);
    /* Invalider après lecture pour màj badge "lu" */
    setTimeout(() => {
      void qc.invalidateQueries({ queryKey: qKey });
      void qc.invalidateQueries({ queryKey: getGetApiAnnoncesNonLuesCountQueryKey() });
    }, 500);
  }

  const epinglées = annonces.filter(a => a.epingle);
  const normales   = annonces.filter(a => !a.epingle);

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"
            style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            <Megaphone className="w-6 h-6" style={{ color: "#00C9A7" }} />
            Annonces
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            {total} annonce{total !== 1 ? "s" : ""} publiée{total !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Filtres type */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map(t => {
          const meta = t.id ? TYPE_META[t.id] : null;
          const active = typeFilter === t.id;
          return (
            <button key={t.id} onClick={() => setTypeFilter(t.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active ? (meta?.bg ?? "rgba(0,201,167,0.12)") : "var(--m15-card)",
                color: active ? (meta?.color ?? "#00C9A7") : "var(--m15-muted)",
                border: active
                  ? `1px solid ${meta?.color ?? "#00C9A7"}40`
                  : "1px solid var(--m15-border)",
              }}>
              {meta && <meta.icon className="w-3.5 h-3.5" />}
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Épinglées */}
      {epinglées.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5"
            style={{ color: "#F5C842" }}>
            <Pin className="w-3.5 h-3.5" /> Épinglées
          </p>
          {epinglées.map(a => <AnnonceCard key={a.id} annonce={a} onClick={openDetail} />)}
        </div>
      )}

      {/* Fil principal */}
      <div className="space-y-3">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)
          : normales.length === 0 && epinglées.length === 0
            ? (
              <div className="p-16 rounded-2xl text-center"
                style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                <Megaphone className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
                <p style={{ color: "var(--m15-white)" }}>Aucune annonce pour le moment.</p>
              </div>
            )
            : normales.map(a => <AnnonceCard key={a.id} annonce={a} onClick={openDetail} />)
        }
      </div>

      {/* Dialog détail */}
      <Dialog open={!!selectedId} onOpenChange={open => !open && setSelectedId(null)}>
        <DialogContent
          className="max-w-lg"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          {!detail ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Type badge */}
              {(() => {
                const meta = TYPE_META[detail.type] ?? TYPE_META["information"];
                const Icon = meta.icon;
                return (
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                      style={{ background: meta.bg, color: meta.color }}>
                      <Icon className="w-3.5 h-3.5" /> {meta.label}
                    </span>
                    {detail.epingle && (
                      <span className="flex items-center gap-1 text-xs font-semibold"
                        style={{ color: "#F5C842" }}>
                        <Pin className="w-3.5 h-3.5" /> Épinglée
                      </span>
                    )}
                  </div>
                );
              })()}

              <h2 className="text-xl font-bold" style={{ color: "var(--m15-white)" }}>
                {detail.titre}
              </h2>

              <p className="text-sm flex items-center gap-2" style={{ color: "var(--m15-muted)" }}>
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: "rgba(0,128,255,0.15)", color: "#0080FF" }}>
                  {(detail.auteur_prenoms?.[0] ?? "") + (detail.auteur_nom?.[0] ?? "")}
                </span>
                {detail.auteur_prenoms} {detail.auteur_nom}
                {" · "}
                <Clock className="w-3.5 h-3.5" />
                {timeAgo(detail.date_publication ?? detail.created_at)}
              </p>

              <div className="p-4 rounded-xl whitespace-pre-wrap text-sm leading-relaxed"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--m15-border)",
                  color: "var(--m15-white)",
                }}>
                {detail.contenu}
              </div>

              {detail.piece_jointe_url && (
                <a href={detail.piece_jointe_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm underline"
                  style={{ color: "#0080FF" }}>
                  📎 {detail.piece_jointe_nom ?? "Pièce jointe"}
                </a>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnonceCard({ annonce, onClick }: { annonce: AnnonceItem; onClick: (id: string) => void }) {
  const meta = TYPE_META[annonce.type] ?? TYPE_META["information"];
  const Icon = meta.icon;

  return (
    <div
      onClick={() => onClick(annonce.id)}
      className="p-5 rounded-2xl cursor-pointer transition-all"
      style={{
        background: annonce.lu ? "var(--m15-card)" : "rgba(0,201,167,0.04)",
        border: annonce.lu
          ? (annonce.epingle ? "1px solid rgba(245,200,66,0.25)" : "1px solid var(--m15-border)")
          : "1px solid rgba(0,201,167,0.2)",
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
      <div className="flex items-start gap-4">
        {/* Icône type */}
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: meta.bg }}>
          <Icon className="w-5 h-5" style={{ color: meta.color }} />
        </div>

        {/* Corps */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-sm leading-snug"
              style={{ color: "var(--m15-white)" }}>
              {annonce.titre}
              {!annonce.lu && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: "#00C9A7", color: "var(--m15-navy)" }}>
                  Nouveau
                </span>
              )}
            </h3>
            <span className="text-xs flex-shrink-0" style={{ color: "var(--m15-muted)" }}>
              {timeAgo(annonce.date_publication ?? annonce.created_at)}
            </span>
          </div>
          <p className="text-sm line-clamp-2" style={{ color: "var(--m15-muted)" }}>
            {annonce.contenu}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs flex items-center gap-1" style={{ color: "var(--m15-muted)" }}>
              <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ background: "rgba(0,128,255,0.15)", color: "#0080FF" }}>
                {(annonce.auteur_prenoms?.[0] ?? "") + (annonce.auteur_nom?.[0] ?? "")}
              </span>
              {annonce.auteur_prenoms} {annonce.auteur_nom}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
