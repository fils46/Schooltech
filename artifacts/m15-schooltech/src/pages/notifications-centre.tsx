import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetMesNotifications,
  useMarquerNotificationLue,
  useMarquerToutLu,
  useSupprimerNotification,
  getGetMesNotificationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, CheckCheck, Trash2, UserMinus, AlertTriangle, FileCheck, FileX, Award, MessageSquare, CalendarCheck, ShieldAlert } from "lucide-react";

interface NotifItem {
  id: string; type: string; titre: string; contenu: string;
  lien?: string | null; lu: boolean; created_at: string;
}

const TYPE_ICON: Record<string, { icon: React.ElementType; color: string }> = {
  absence:                  { icon: UserMinus,      color: "#FF4D6D" },
  retard:                   { icon: UserMinus,      color: "#F5C842" },
  alerte_seuil:             { icon: AlertTriangle,  color: "#FF4D6D" },
  justification_validee:    { icon: FileCheck,      color: "#00C9A7" },
  justification_rejetee:    { icon: FileX,          color: "#FF4D6D" },
  bulletin_publie:          { icon: Award,          color: "#F5C842" },
  message:                  { icon: MessageSquare,  color: "#0080FF" },
  annonce:                  { icon: Bell,           color: "#0080FF" },
  rdv:                      { icon: CalendarCheck,  color: "#00C9A7" },
  incident_signale:         { icon: ShieldAlert,    color: "#FF4D6D" },
  sanction_en_attente:      { icon: ShieldAlert,    color: "#F5C842" },
  sanction_validee:         { icon: ShieldAlert,    color: "#00C9A7" },
  sanction_refusee:         { icon: ShieldAlert,    color: "#FF4D6D" },
  incident_escalade:        { icon: ShieldAlert,    color: "#FF4D6D" },
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Hier";
  return `Il y a ${days} jours`;
}

const FILTERS = [
  { id: "", label: "Toutes" },
  { id: "false", label: "Non lues" },
  { id: "true",  label: "Lues" },
];

export default function NotificationsCentre() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [luFilter, setLuFilter] = useState<"" | "true" | "false">("");

  const params = {
    ...(luFilter !== "" ? { lu: luFilter === "true" } : {}),
    limit: 50,
  };
  const qKey = getGetMesNotificationsQueryKey(params);

  const { data, isLoading } = useGetMesNotifications(params, {
    query: { queryKey: qKey, enabled: !!user },
  });
  const notifications: NotifItem[] = (data as { notifications?: NotifItem[] })?.notifications ?? [];
  const total: number = (data as { total?: number })?.total ?? 0;

  const marquerLue = useMarquerNotificationLue();
  const marquerTout = useMarquerToutLu();
  const supprimer = useSupprimerNotification();

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: qKey });
    void qc.invalidateQueries({ queryKey: ["notif-count"] });
  };

  function handleClick(n: NotifItem) {
    if (!n.lu) {
      marquerLue.mutate({ id: n.id }, { onSuccess: invalidate });
    }
    if (n.lien) setLocation(n.lien);
  }

  function handleMarquerTout() {
    marquerTout.mutate(undefined, {
      onSuccess: () => { toast({ title: "Toutes les notifications marquées comme lues." }); invalidate(); },
    });
  }

  function handleSupprimer(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    supprimer.mutate({ id }, {
      onSuccess: () => { toast({ title: "Notification supprimée." }); invalidate(); },
    });
  }

  const nonLues = notifications.filter(n => !n.lu).length;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            <Bell className="w-6 h-6" style={{ color: "#00C9A7" }} />
            Notifications
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            {total} notification{total !== 1 ? "s" : ""}
            {nonLues > 0 && ` · ${nonLues} non lue${nonLues !== 1 ? "s" : ""}`}
          </p>
        </div>
        {nonLues > 0 && (
          <button onClick={handleMarquerTout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "rgba(0,201,167,0.12)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.25)" }}>
            <CheckCheck className="w-4 h-4" /> Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-2">
        {FILTERS.map(f => (
          <button key={f.id} onClick={() => setLuFilter(f.id as "" | "true" | "false")}
            className="px-4 py-1.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: luFilter === f.id ? "rgba(0,201,167,0.12)" : "var(--m15-card)",
              color: luFilter === f.id ? "#00C9A7" : "var(--m15-muted)",
              border: luFilter === f.id ? "1px solid rgba(0,201,167,0.25)" : "1px solid var(--m15-border)",
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : notifications.length === 0 ? (
          <div className="p-12 rounded-2xl text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <Bell className="w-12 h-12 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.5 }} />
            <p style={{ color: "var(--m15-white)" }}>Aucune notification.</p>
          </div>
        ) : notifications.map(n => {
          const meta = TYPE_ICON[n.type] ?? { icon: Bell, color: "var(--m15-muted)" };
          const Icon = meta.icon;
          return (
            <div key={n.id}
              onClick={() => handleClick(n)}
              className="flex items-start gap-4 p-4 rounded-2xl cursor-pointer transition-all group"
              style={{
                background: n.lu ? "var(--m15-card)" : "rgba(0,201,167,0.04)",
                border: n.lu ? "1px solid var(--m15-border)" : "1px solid rgba(0,201,167,0.15)",
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = "0.85"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = "1"}>
              {/* Icône */}
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${meta.color}18` }}>
                <Icon className="w-5 h-5" style={{ color: meta.color }} />
              </div>
              {/* Contenu */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>
                    {n.titre}
                    {!n.lu && (
                      <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs font-bold"
                        style={{ background: "#00C9A7", color: "var(--m15-navy)" }}>Nouveau</span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs" style={{ color: "var(--m15-muted)" }}>{timeAgo(n.created_at)}</span>
                    <button onClick={(e) => handleSupprimer(n.id, e)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg"
                      style={{ color: "var(--m15-muted)" }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>{n.contenu}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
