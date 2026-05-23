import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetConseilEnCours,
  useSaisirDeliberation,
  useAjouterIntervention,
  useConfirmerPresence,
  type AjouterInterventionInputType,
} from "@workspace/api-client-react";
import { io, type Socket } from "socket.io-client";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Send, UserCheck, Users, MessageSquare, Loader2, CheckCircle2,
  Award, AlertCircle, ChevronDown, ChevronUp, Wifi, WifiOff,
} from "lucide-react";

type ConseilItem = {
  id: string; classe_nom: string; trimestre: string;
  date_conseil: string; heure_debut?: string | null; statut: string;
  ordre_du_jour?: string | null; president_nom: string | null;
};
type Participant = {
  id: string; utilisateur_id: string; utilisateur_nom: string; utilisateur_prenoms: string;
  role_conseil: string; present: boolean; heure_arrivee?: string | null;
};
type Deliberation = {
  id?: string; eleve_id: string; eleve_nom: string; eleve_prenoms: string;
  moyenne_generale?: string | null; rang?: number | null; nb_absences: number;
  decision?: string | null; mention_honneur: boolean;
  appreciation_generale?: string | null; observations?: string | null;
};
type Intervention = {
  id: string; auteur_id: string; auteur_nom: string; contenu: string;
  type: string; eleve_id?: string | null; created_at: string;
};

const DECISION_OPTIONS = [
  { value: "",              label: "— Non saisi —" },
  { value: "passage",       label: "Passage" },
  { value: "redoublement",  label: "Redoublement" },
  { value: "exclusion",     label: "Exclusion" },
  { value: "orientation",   label: "Orientation" },
  { value: "felicitations", label: "Félicitations" },
  { value: "encouragements",label: "Encouragements" },
  { value: "avertissement", label: "Avertissement" },
  { value: "blame",         label: "Blâme" },
];

const TYPE_INTERVENTION_OPTIONS = [
  { value: "general",     label: "Général" },
  { value: "observation", label: "Observation" },
  { value: "decision",    label: "Décision" },
  { value: "question",    label: "Question" },
  { value: "reponse",     label: "Réponse" },
];

const DECISION_COLORS: Record<string, string> = {
  passage: "#00C9A7", redoublement: "#FF4D6D", exclusion: "#FF4D6D",
  orientation: "#F5C842", felicitations: "#00C9A7", encouragements: "#00C9A7",
  avertissement: "#F5C842", blame: "#FF4D6D",
};

const ROLE_LABELS: Record<string, string> = {
  president: "Président", professeur: "Professeur", delegue_eleves: "Délégué élèves",
  delegue_parents: "Délégué parents", censeur: "Censeur", directeur: "Directeur",
};

export default function ConseilSalle() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [connected, setConnected] = useState(false);
  const [deliberations, setDeliberations] = useState<Deliberation[]>([]);
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const [newMessage, setNewMessage] = useState("");
  const [messageType, setMessageType] = useState("general");
  const [messageEleveId, setMessageEleveId] = useState("");
  const [expandedEleve, setExpandedEleve] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [presenceConfirmed, setPresenceConfirmed] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: enCoursData, isLoading } = useGetConseilEnCours(id ?? "");

  const conseil: ConseilItem | null = (enCoursData as { conseil?: ConseilItem })?.conseil ?? null;

  /* Hydrate local state from initial query */
  useEffect(() => {
    const d = (enCoursData as { deliberations?: Deliberation[] })?.deliberations ?? [];
    const i = (enCoursData as { interventions?: Intervention[] })?.interventions ?? [];
    const p = (enCoursData as { participants?: Participant[] })?.participants ?? [];
    if (d.length > 0) setDeliberations(d);
    if (i.length > 0) setInterventions(i);
    if (p.length > 0) setParticipants(p);
  }, [enCoursData]);

  const deliberer  = useSaisirDeliberation();
  const intervenir = useAjouterIntervention();
  const presence   = useConfirmerPresence();

  /* ── Socket.io ─────────────────────────────────────────── */
  useEffect(() => {
    if (!id || !user) return;
    const token = localStorage.getItem("m15_token");
    const socket = io(window.location.origin, { path: "/api/socket.io", auth: { token } });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("rejoindre_conseil", id);
    });
    socket.on("disconnect", () => setConnected(false));

    socket.on("deliberation_maj", ({ deliberation }: { deliberation: Deliberation }) => {
      setDeliberations(prev => {
        const idx = prev.findIndex(d => d.eleve_id === deliberation.eleve_id);
        if (idx >= 0) { const next = [...prev]; next[idx] = deliberation; return next; }
        return [...prev, deliberation];
      });
    });

    socket.on("intervention_ajoutee", ({ intervention }: { intervention: Intervention }) => {
      setInterventions(prev => [...prev, intervention]);
    });

    socket.on("presence_confirmee", ({ utilisateur_id, heure_arrivee }: { utilisateur_id: string; heure_arrivee: string }) => {
      setParticipants(prev => prev.map(p =>
        p.utilisateur_id === utilisateur_id ? { ...p, present: true, heure_arrivee } : p
      ));
    });

    socket.on("conseil_termine", () => {
      toast({ title: "Le conseil de classe est terminé." });
      setLocation(`/conseils-classe/resultats/${id}`);
    });

    return () => {
      socket.emit("quitter_conseil", id);
      socket.disconnect();
    };
  }, [id, user]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [interventions]);

  function handleConfirmerPresence() {
    if (!id) return;
    presence.mutate({ id }, {
      onSuccess: () => { setPresenceConfirmed(true); toast({ title: "Présence confirmée." }); },
      onError: () => toast({ title: "Erreur.", variant: "destructive" }),
    });
  }

  function handleSauvegarderDeliberation(eleve_id: string, fields: Partial<Deliberation>) {
    if (!id) return;
    setSaving(eleve_id);
    deliberer.mutate(
      { id, data: { eleve_id, ...fields } as Parameters<typeof deliberer.mutate>[0]["data"] },
      {
        onSuccess: () => setSaving(null),
        onError: () => { setSaving(null); toast({ title: "Erreur de sauvegarde.", variant: "destructive" }); },
      }
    );
  }

  function handleEnvoyerMessage() {
    if (!id || !newMessage.trim()) return;
    intervenir.mutate(
      { id, data: { contenu: newMessage.trim(), type: messageType as AjouterInterventionInputType, ...(messageEleveId ? { eleve_id: messageEleveId } : {}) } },
      {
        onSuccess: () => { setNewMessage(""); setMessageEleveId(""); },
        onError: () => toast({ title: "Erreur.", variant: "destructive" }),
      }
    );
  }

  const canDeliberer = ["dev","directeur","censeur"].includes(user?.role ?? "");
  const isParticipant = participants.some(p => p.utilisateur_id === user?.id);
  const sortedDelibs = [...deliberations].sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid lg:grid-cols-3 gap-4">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!conseil) {
    return (
      <div className="max-w-xl mx-auto text-center p-12 rounded-2xl" style={{ background: "var(--m15-card)", border: "1px dashed var(--m15-border)" }}>
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p style={{ color: "var(--m15-muted)" }}>Conseil introuvable ou accès non autorisé.</p>
        <button onClick={() => setLocation("/conseils-classe")} className="mt-4 px-4 py-2 rounded-xl text-sm"
          style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>Retour</button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/conseils-classe")}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                {conseil.classe_nom} — T{conseil.trimestre}
              </span>
              <span className="px-2 py-0.5 rounded-lg text-xs font-semibold animate-pulse"
                style={{ background: "rgba(0,128,255,0.15)", color: "#0080FF" }}>EN COURS</span>
              <span className="flex items-center gap-1 text-xs" style={{ color: connected ? "#00C9A7" : "var(--m15-muted)" }}>
                {connected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {connected ? "Temps réel" : "Reconnexion..."}
              </span>
            </div>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
              {conseil.date_conseil}{conseil.heure_debut ? ` · ${conseil.heure_debut}` : ""} · Président : {conseil.president_nom ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isParticipant && !presenceConfirmed && (
            <button onClick={handleConfirmerPresence} disabled={presence.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(0,201,167,0.15)", border: "1px solid rgba(0,201,167,0.3)", color: "#00C9A7" }}>
              {presence.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
              Confirmer ma présence
            </button>
          )}
          <button onClick={() => setLocation(`/conseils-classe/resultats/${id}`)}
            className="px-4 py-2 rounded-xl text-sm font-semibold"
            style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>
            Résultats →
          </button>
        </div>
      </div>

      {conseil.ordre_du_jour && (
        <div className="rounded-xl p-3 text-sm" style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.2)" }}>
          <span style={{ color: "#F5C842", fontWeight: 600 }}>Ordre du jour : </span>
          <span style={{ color: "var(--m15-muted)" }}>{conseil.ordre_du_jour}</span>
        </div>
      )}

      {/* Corps 3 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_300px] gap-4">

        {/* Col 1 — Participants */}
        <div className="rounded-2xl p-4 space-y-2" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4" style={{ color: "#F5C842" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>Participants</span>
            <span className="ml-auto text-xs" style={{ color: "var(--m15-muted)" }}>
              {participants.filter(p => p.present).length}/{participants.length}
            </span>
          </div>
          {participants.length === 0 ? (
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Aucun participant.</p>
          ) : (
            participants.map(p => (
              <div key={p.id} className="flex items-center gap-2 p-2 rounded-xl"
                style={{ background: p.present ? "rgba(0,201,167,0.06)" : "var(--elevate-1)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: p.present ? "rgba(0,201,167,0.2)" : "var(--elevate-2)", color: p.present ? "#00C9A7" : "var(--m15-muted)" }}>
                  {p.utilisateur_prenoms.charAt(0)}{p.utilisateur_nom.charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--m15-white)" }}>
                    {p.utilisateur_prenoms} {p.utilisateur_nom}
                  </p>
                  <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{ROLE_LABELS[p.role_conseil] ?? p.role_conseil}</p>
                </div>
                {p.present && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#00C9A7" }} />}
              </div>
            ))
          )}
        </div>

        {/* Col 2 — Délibérations */}
        <div className="rounded-2xl" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center gap-2 p-4 border-b" style={{ borderColor: "var(--m15-border)" }}>
            <Award className="w-4 h-4" style={{ color: "#00C9A7" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>Délibérations</span>
            <span className="ml-auto text-xs" style={{ color: "var(--m15-muted)" }}>
              {sortedDelibs.filter(d => d.decision).length}/{sortedDelibs.length} traités
            </span>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "520px" }}>
            {sortedDelibs.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
                  Aucun élève à délibérer. Les bulletins doivent être générés avant le conseil.
                </p>
              </div>
            ) : (
              sortedDelibs.map(d => {
                const isExpanded = expandedEleve === d.eleve_id;
                const decColor = d.decision ? (DECISION_COLORS[d.decision] ?? "var(--m15-muted)") : "var(--m15-muted)";
                return (
                  <div key={d.eleve_id} className="border-b last:border-0" style={{ borderColor: "var(--m15-border)" }}>
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer transition-colors"
                      style={{ background: "transparent" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                      onClick={() => setExpandedEleve(isExpanded ? null : d.eleve_id)}
                    >
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: d.decision ? `${decColor}20` : "var(--elevate-2)", color: d.decision ? decColor : "var(--m15-muted)" }}>
                        {d.rang != null ? `#${d.rang}` : "?"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>{d.eleve_prenoms} {d.eleve_nom}</p>
                        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                          Moy. {d.moyenne_generale != null ? Number(d.moyenne_generale).toFixed(2) : "—"} · {d.nb_absences} abs.
                        </p>
                      </div>
                      {d.decision ? (
                        <span className="px-2 py-0.5 rounded text-xs font-semibold" style={{ background: `${decColor}20`, color: decColor }}>
                          {DECISION_OPTIONS.find(o => o.value === d.decision)?.label ?? d.decision}
                        </span>
                      ) : (
                        <span className="text-xs opacity-50" style={{ color: "var(--m15-muted)" }}>Non saisi</span>
                      )}
                      {saving === d.eleve_id
                        ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: "#00C9A7" }} />
                        : (isExpanded
                          ? <ChevronUp className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />
                          : <ChevronDown className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />)
                      }
                    </div>

                    {isExpanded && canDeliberer && (
                      <div className="px-4 pb-4 space-y-3" style={{ background: "rgba(255,255,255,0.02)" }}>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Décision</label>
                            <Select
                              value={d.decision ?? ""}
                              onValueChange={v => {
                                const updated = { ...d, decision: v || null };
                                setDeliberations(prev => prev.map(x => x.eleve_id === d.eleve_id ? updated : x));
                                handleSauvegarderDeliberation(d.eleve_id, { decision: v || null });
                              }}
                            >
                              <SelectTrigger style={{ background: "var(--elevate-2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", fontSize: "0.8rem" }}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DECISION_OPTIONS.map(o => <SelectItem key={o.value || "_none"} value={o.value || "_none"}>{o.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-end pb-1">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={d.mention_honneur}
                                onChange={e => {
                                  const updated = { ...d, mention_honneur: e.target.checked };
                                  setDeliberations(prev => prev.map(x => x.eleve_id === d.eleve_id ? updated : x));
                                  handleSauvegarderDeliberation(d.eleve_id, { mention_honneur: e.target.checked });
                                }}
                                className="w-4 h-4 rounded"
                              />
                              <span className="text-xs" style={{ color: "var(--m15-muted)" }}>Mention d'honneur</span>
                            </label>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Appréciation générale</label>
                          <Textarea
                            rows={2}
                            value={d.appreciation_generale ?? ""}
                            onChange={e => setDeliberations(prev => prev.map(x => x.eleve_id === d.eleve_id ? { ...x, appreciation_generale: e.target.value } : x))}
                            onBlur={e => handleSauvegarderDeliberation(d.eleve_id, { appreciation_generale: e.target.value })}
                            placeholder="Appréciation générale..."
                            style={{ background: "var(--elevate-2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", fontSize: "0.8rem" }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Col 3 — Interventions */}
        <div className="rounded-2xl flex flex-col" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", height: "600px" }}>
          <div className="flex items-center gap-2 p-4 border-b flex-shrink-0" style={{ borderColor: "var(--m15-border)" }}>
            <MessageSquare className="w-4 h-4" style={{ color: "#0080FF" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>Interventions</span>
            <span className="ml-auto text-xs" style={{ color: "var(--m15-muted)" }}>{interventions.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {interventions.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-xs text-center" style={{ color: "var(--m15-muted)" }}>Aucune intervention. Soyez le premier à prendre la parole.</p>
              </div>
            ) : (
              interventions.map(i => {
                const isMe = i.auteur_id === user?.id;
                return (
                  <div key={i.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${isMe ? "rounded-br-sm" : "rounded-bl-sm"}`}
                      style={{
                        background: isMe ? "rgba(0,128,255,0.15)" : "var(--elevate-2)",
                        border: isMe ? "1px solid rgba(0,128,255,0.25)" : "1px solid var(--m15-border)",
                      }}>
                      {!isMe && (
                        <p className="text-xs font-semibold mb-0.5" style={{ color: "#00C9A7" }}>{i.auteur_nom}</p>
                      )}
                      <p style={{ color: "var(--m15-white)" }}>{i.contenu}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
                          {TYPE_INTERVENTION_OPTIONS.find(t => t.value === i.type)?.label ?? i.type}
                        </span>
                        <span className="text-xs opacity-60" style={{ color: "var(--m15-muted)" }}>
                          {new Date(i.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t flex-shrink-0 space-y-2" style={{ borderColor: "var(--m15-border)" }}>
            <div className="flex gap-2">
              <Select value={messageType} onValueChange={setMessageType}>
                <SelectTrigger style={{ background: "var(--elevate-2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", fontSize: "0.75rem", width: "110px" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_INTERVENTION_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
              {sortedDelibs.length > 0 && (
                <Select value={messageEleveId || "__all__"} onValueChange={v => setMessageEleveId(v === "__all__" ? "" : v)}>
                  <SelectTrigger style={{ background: "var(--elevate-2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", fontSize: "0.75rem", flex: 1 }}>
                    <SelectValue placeholder="Élève (opt.)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Général</SelectItem>
                    {sortedDelibs.map(d => (
                      <SelectItem key={d.eleve_id} value={d.eleve_id}>{d.eleve_prenoms} {d.eleve_nom}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex gap-2">
              <Textarea
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleEnvoyerMessage(); } }}
                rows={2}
                placeholder="Votre intervention... (↵ pour envoyer)"
                style={{ background: "var(--elevate-2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", fontSize: "0.85rem", resize: "none" }}
              />
              <button
                onClick={handleEnvoyerMessage}
                disabled={!newMessage.trim() || intervenir.isPending}
                className="w-10 flex-shrink-0 flex items-center justify-center rounded-xl"
                style={{ background: newMessage.trim() ? "#0080FF" : "var(--elevate-2)", color: newMessage.trim() ? "#fff" : "var(--m15-muted)" }}
              >
                {intervenir.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
