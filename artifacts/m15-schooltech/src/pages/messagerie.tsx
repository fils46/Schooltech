import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetBoiteReception, useGetBoiteEnvoi, useGetContactsDisponibles,
  useGetMessage, useEnvoyerMessage, useRepondreMessage, useArchiverMessage,
  getGetBoiteReceptionQueryKey, getGetBoiteEnvoiQueryKey,
  getGetNbMessagesNonLusQueryKey, getGetMessageQueryKey, getGetContactsDisponiblesQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Inbox, Send, Archive, PenSquare, Reply,
  Search, Loader2, MessageSquare,
} from "lucide-react";
import { useSocket } from "@/hooks/useSocket";

type Tab = "reception" | "envoi";

function formatDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "À l'instant";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}min`;
  if (diff < 86_400_000) return d.toLocaleTimeString("fr-FR", { hour:"2-digit", minute:"2-digit" });
  return d.toLocaleDateString("fr-FR", { day:"2-digit", month:"short" });
}

export default function Messagerie() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("reception");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

  /* Socket.io — badge temps réel */
  const socket = useSocket();
  useEffect(() => {
    if (!socket) return;
    const handler = () => {
      qc.invalidateQueries({ queryKey: getGetBoiteReceptionQueryKey() });
      qc.invalidateQueries({ queryKey: getGetNbMessagesNonLusQueryKey() });
    };
    socket.on("nouveau_message", handler);
    return () => { socket.off("nouveau_message", handler); };
  }, [socket, qc]);

  const recQk = getGetBoiteReceptionQueryKey();
  const envQk = getGetBoiteEnvoiQueryKey();

  const { data: receptionData, isLoading: loadingRec } = useGetBoiteReception(
    undefined,
    { query: { queryKey: recQk, staleTime: 30_000 } }
  );
  const { data: envoiData, isLoading: loadingEnv } = useGetBoiteEnvoi(
    { query: { queryKey: envQk, staleTime: 30_000 } }
  );

  const msgQk = getGetMessageQueryKey(selectedId ?? "");
  const { data: msgDetail } = useGetMessage(
    selectedId ?? "",
    { query: { queryKey: msgQk, enabled: !!selectedId } }
  );

  const archiveMut = useArchiverMessage({
    mutation: {
      onSuccess: () => {
        setSelectedId(null);
        qc.invalidateQueries({ queryKey: recQk });
        qc.invalidateQueries({ queryKey: envQk });
        toast({ title: "Message archivé" });
      },
    },
  });

  const messages = (tab === "reception" ? (receptionData as any)?.messages : (envoiData as any)?.messages) ?? [];
  const isLoading = tab === "reception" ? loadingRec : loadingEnv;

  const filtered = messages.filter((m: any) =>
    !search ||
    m.sujet?.toLowerCase().includes(search.toLowerCase()) ||
    m.expediteur_nom?.toLowerCase().includes(search.toLowerCase()) ||
    m.destinataire_nom?.toLowerCase().includes(search.toLowerCase())
  );

  const detail = (msgDetail as any)?.message;
  const reponses = (msgDetail as any)?.reponses ?? [];

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col p-4 gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Poppins, sans-serif" }}>Messagerie</h1>
        <Button
          size="sm"
          onClick={() => setComposeOpen(true)}
          className="gap-2"
          style={{ background: "linear-gradient(135deg, #0080FF, #00C9A7)", border: "none" }}
        >
          <PenSquare className="h-4 w-4" /> Nouveau message
        </Button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Colonne gauche — liste */}
        <div className="w-full md:w-80 lg:w-96 flex flex-col gap-3 flex-shrink-0">
          {/* Tabs */}
          <div className="flex rounded-lg overflow-hidden border">
            {(["reception","envoi"] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setSelectedId(null); }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium transition-colors",
                  tab === t ? "text-[var(--m15-white)]" : "text-muted-foreground hover:bg-muted"
                )}
                style={tab === t ? { background: "linear-gradient(135deg, #0A1628, #0080FF)" } : {}}
              >
                {t === "reception" ? <Inbox className="h-4 w-4" /> : <Send className="h-4 w-4" />}
                {t === "reception" ? "Réception" : "Envoi"}
              </button>
            ))}
          </div>

          {/* Recherche */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Liste messages */}
          <ScrollArea className="flex-1 rounded-lg border">
            {isLoading ? (
              <div className="p-3 space-y-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="flex gap-2 p-2">
                    <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Aucun message</p>
              </div>
            ) : (
              <div>
                {filtered.map((m: any) => {
                  const interlocuteur = tab === "reception"
                    ? `${m.expediteur_prenoms} ${m.expediteur_nom}`
                    : `${m.destinataire_prenoms} ${m.destinataire_nom}`;
                  const initiales = tab === "reception"
                    ? `${m.expediteur_prenoms?.[0] ?? ""}${m.expediteur_nom?.[0] ?? ""}`
                    : `${m.destinataire_prenoms?.[0] ?? ""}${m.destinataire_nom?.[0] ?? ""}`;

                  return (
                    <div
                      key={m.id}
                      onClick={() => setSelectedId(m.id)}
                      className={cn(
                        "flex items-start gap-3 p-3 cursor-pointer border-b transition-colors",
                        selectedId === m.id ? "bg-blue-50 dark:bg-blue-900/20" : "hover:bg-muted/50",
                        tab === "reception" && !m.lu ? "bg-cyan-50/50 dark:bg-cyan-900/10" : ""
                      )}
                    >
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarFallback className="text-xs font-semibold" style={{ background: "var(--m15-navy)", color: "#00C9A7" }}>
                          {initiales}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={cn("text-sm truncate", !m.lu && tab === "reception" ? "font-bold" : "font-medium")}>
                            {interlocuteur}
                          </p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{formatDate(m.created_at)}</span>
                        </div>
                        <p className={cn("text-xs truncate", !m.lu && tab === "reception" ? "font-semibold" : "text-muted-foreground")}>
                          {m.sujet}
                        </p>
                        {tab === "reception" && !m.lu && (
                          <div className="h-1.5 w-1.5 rounded-full mt-1" style={{ background: "#00C9A7" }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Colonne droite — détail */}
        <div className="flex-1 min-w-0 hidden md:flex flex-col">
          {!selectedId ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground border rounded-lg">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Sélectionnez un message pour le lire</p>
              </div>
            </div>
          ) : !detail ? (
            <div className="flex-1 border rounded-lg p-6 space-y-4">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-32" />
            </div>
          ) : (
            <div className="flex-1 flex flex-col border rounded-lg overflow-hidden">
              {/* Header message */}
              <div className="p-5 border-b">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">{detail.sujet}</h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      De : <span className="font-medium">{detail.expediteur_prenoms} {detail.expediteur_nom}</span>
                      {" · "}{formatDate(detail.created_at)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => archiveMut.mutate({ id: selectedId })}
                    title="Archiver"
                  >
                    <Archive className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Corps + réponses */}
              <ScrollArea className="flex-1 p-5">
                <div className="max-w-none">
                  <p className="whitespace-pre-wrap text-sm">{detail.contenu}</p>
                </div>

                {reponses.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-4">
                      {reponses.map((r: any) => (
                        <div key={r.id} className={cn(
                          "p-3 rounded-lg",
                          r.expediteur_id === user?.id ? "bg-blue-50 dark:bg-blue-900/20 ml-6" : "bg-muted mr-6"
                        )}>
                          <p className="text-xs font-semibold mb-1">
                            {r.expediteur_prenoms} {r.expediteur_nom} · {formatDate(r.created_at)}
                          </p>
                          <p className="text-sm whitespace-pre-wrap">{r.contenu}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ScrollArea>

              {/* Zone réponse */}
              <ReplyBox messageId={selectedId} receptionQk={recQk} envoiQk={envQk} detailQk={msgQk} />
            </div>
          )}
        </div>
      </div>

      {/* Modal composer */}
      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={() => {
          setComposeOpen(false);
          qc.invalidateQueries({ queryKey: envQk });
        }}
      />
    </div>
  );
}

function ReplyBox({ messageId, receptionQk, envoiQk, detailQk }: {
  messageId: string;
  receptionQk: readonly unknown[];
  envoiQk: readonly unknown[];
  detailQk: readonly unknown[];
}) {
  const [text, setText] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const mut = useRepondreMessage({
    mutation: {
      onSuccess: () => {
        setText("");
        qc.invalidateQueries({ queryKey: receptionQk });
        qc.invalidateQueries({ queryKey: envoiQk });
        qc.invalidateQueries({ queryKey: detailQk });
        toast({ title: "Réponse envoyée" });
      },
      onError: () => toast({ title: "Erreur lors de l'envoi", variant: "destructive" }),
    },
  });

  return (
    <div className="p-4 border-t flex gap-2">
      <Textarea
        placeholder="Répondre… (Ctrl+Entrée pour envoyer)"
        value={text}
        onChange={e => setText(e.target.value)}
        className="flex-1 min-h-[60px] max-h-32 resize-none"
        onKeyDown={e => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && text.trim()) {
            mut.mutate({ id: messageId, data: { contenu: text.trim() } });
          }
        }}
      />
      <Button
        size="sm"
        disabled={!text.trim() || mut.isPending}
        onClick={() => mut.mutate({ id: messageId, data: { contenu: text.trim() } })}
        style={{ background: "linear-gradient(135deg, #0080FF, #00C9A7)", border: "none" }}
        className="self-end"
      >
        {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Reply className="h-4 w-4" />}
      </Button>
    </div>
  );
}

function ComposeModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const { toast } = useToast();
  const [destinataireId, setDestinataire] = useState("");
  const [sujet, setSujet] = useState("");
  const [contenu, setContenu] = useState("");

  const contactsQk = getGetContactsDisponiblesQueryKey();
  const { data: contactsData } = useGetContactsDisponibles({ query: { queryKey: contactsQk, enabled: open } });
  const contacts = (contactsData as any)?.contacts ?? [];

  const mut = useEnvoyerMessage({
    mutation: {
      onSuccess: () => {
        setSujet(""); setContenu(""); setDestinataire("");
        onSent();
        toast({ title: "Message envoyé ✓" });
      },
      onError: () => toast({ title: "Erreur d'envoi", variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PenSquare className="h-5 w-5" style={{ color: "#0080FF" }} />
            Nouveau message
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Destinataire</label>
            <Select value={destinataireId} onValueChange={setDestinataire}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un destinataire" />
              </SelectTrigger>
              <SelectContent>
                {contacts.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.prenoms} {c.nom} · <span className="capitalize text-muted-foreground">{c.role}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Sujet</label>
            <Input
              placeholder="Objet du message"
              value={sujet}
              onChange={e => setSujet(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Message</label>
            <Textarea
              placeholder="Votre message…"
              value={contenu}
              onChange={e => setContenu(e.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!destinataireId || !sujet.trim() || !contenu.trim() || mut.isPending}
            onClick={() => mut.mutate({ data: { destinataire_id: destinataireId, sujet: sujet.trim(), contenu: contenu.trim() } })}
            style={{ background: "linear-gradient(135deg, #0080FF, #00C9A7)", border: "none" }}
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Envoyer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
