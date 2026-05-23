import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePostApiAnnonces,
  usePutApiAnnoncesId,
  useGetApiAnnoncesId,
  usePutApiAnnoncesIdPublier,
  getGetApiAnnoncesQueryKey,
  getGetApiAnnoncesIdQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Megaphone, ArrowLeft, Send, Save, Pin, Info, AlertTriangle,
  CalendarDays, Bell, Loader2,
} from "lucide-react";

type AnnonceType = "information" | "urgence" | "evenement" | "rappel";

const TYPES: { id: AnnonceType; label: string; icon: React.ElementType; color: string }[] = [
  { id: "information", label: "Information",  icon: Info,          color: "#0080FF" },
  { id: "urgence",     label: "Urgent",       icon: AlertTriangle, color: "#FF4D6D" },
  { id: "evenement",   label: "Événement",    icon: CalendarDays,  color: "#F5C842" },
  { id: "rappel",      label: "Rappel",       icon: Bell,          color: "#00C9A7" },
];

const DEST_OPTIONS = [
  { id: "tous",       label: "Tous" },
  { id: "directeur",  label: "Directeur" },
  { id: "censeur",    label: "Censeurs" },
  { id: "professeur", label: "Professeurs" },
  { id: "eleve",      label: "Élèves" },
  { id: "parent",     label: "Parents" },
];

export default function FormulaireAnnonce() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const annonceId = params.id;
  const isEdit = !!annonceId;

  const [titre,          setTitre]          = useState("");
  const [contenu,        setContenu]        = useState("");
  const [type,           setType]           = useState<AnnonceType>("information");
  const [destinataires,  setDestinataires]  = useState<string[]>(["tous"]);
  const [datePublication, setDatePub]       = useState("");
  const [dateExpiration,  setDateExp]       = useState("");
  const [epingle,        setEpingle]        = useState(false);
  const [publie,         setPublie]         = useState(false);
  const [pieceJointeUrl, setPieceJointeUrl] = useState("");
  const [pieceJointeNom, setPieceJointeNom] = useState("");

  /* Chargement annonce existante */
  const detailQk = getGetApiAnnoncesIdQueryKey(annonceId ?? "");
  const { data: existingData, isLoading: loadingExisting } = useGetApiAnnoncesId(
    annonceId ?? "",
    { query: { queryKey: detailQk, enabled: isEdit } }
  );

  useEffect(() => {
    const a = (existingData as any)?.annonce;
    if (!a) return;
    setTitre(a.titre ?? "");
    setContenu(a.contenu ?? "");
    setType((a.type as AnnonceType) ?? "information");
    setDestinataires(a.destinataires ?? ["tous"]);
    setEpingle(a.epingle ?? false);
    setPublie(a.publie ?? false);
    if (a.date_publication) setDatePub(a.date_publication.slice(0, 16));
    if (a.date_expiration)  setDateExp(a.date_expiration.slice(0, 16));
    if (a.piece_jointe_url) setPieceJointeUrl(a.piece_jointe_url);
    if (a.piece_jointe_nom) setPieceJointeNom(a.piece_jointe_nom);
  }, [existingData]);

  const createMut  = usePostApiAnnonces();
  const updateMut  = usePutApiAnnoncesId();
  const publishMut = usePutApiAnnoncesIdPublier();

  const isLoading = createMut.isPending || updateMut.isPending || publishMut.isPending;

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: getGetApiAnnoncesQueryKey() });
  };

  function toggleDest(id: string) {
    if (id === "tous") {
      setDestinataires(["tous"]);
      return;
    }
    setDestinataires(prev => {
      const without = prev.filter(d => d !== "tous");
      if (without.includes(id)) {
        const next = without.filter(d => d !== id);
        return next.length === 0 ? ["tous"] : next;
      }
      return [...without, id];
    });
  }

  function buildPayload(asPublie: boolean) {
    return {
      titre: titre.trim(),
      contenu: contenu.trim(),
      type,
      destinataires,
      date_publication: datePublication || (asPublie ? new Date().toISOString() : null),
      date_expiration: dateExpiration || null,
      epingle,
      publie: asPublie,
      piece_jointe_url: pieceJointeUrl || null,
      piece_jointe_nom: pieceJointeNom || null,
    };
  }

  function handleSave(asPublie: boolean) {
    if (!titre.trim() || !contenu.trim()) {
      toast({ title: "Le titre et le contenu sont obligatoires.", variant: "destructive" }); return;
    }

    if (isEdit && annonceId) {
      updateMut.mutate({ id: annonceId, data: buildPayload(asPublie) as any }, {
        onSuccess: () => {
          if (asPublie && !((existingData as any)?.annonce?.publie)) {
            publishMut.mutate({ id: annonceId }, {
              onSuccess: () => { toast({ title: "Annonce publiée ✓" }); invalidateAll(); setLocation("/annonces"); },
              onError:   () => { toast({ title: "Erreur lors de la publication.", variant: "destructive" }); },
            });
          } else {
            toast({ title: "Annonce enregistrée ✓" }); invalidateAll(); setLocation("/annonces");
          }
        },
        onError: () => toast({ title: "Erreur lors de l'enregistrement.", variant: "destructive" }),
      });
    } else {
      createMut.mutate({ data: buildPayload(asPublie) as any }, {
        onSuccess: () => {
          toast({ title: asPublie ? "Annonce publiée ✓" : "Brouillon enregistré ✓" });
          invalidateAll(); setLocation("/annonces");
        },
        onError: () => toast({ title: "Erreur lors de la création.", variant: "destructive" }),
      });
    }
  }

  const typeMeta = TYPES.find(t => t.id === type) ?? TYPES[0];

  if (isEdit && loadingExisting) {
    return (
      <div className="max-w-2xl space-y-4">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => setLocation("/annonces")}
          className="p-2 rounded-xl transition-colors"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}
          onMouseEnter={e => (e.currentTarget.style.color = "var(--m15-white)")}
          onMouseLeave={e => (e.currentTarget.style.color = "var(--m15-muted)")}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3"
            style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            <Megaphone className="w-6 h-6" style={{ color: "#00C9A7" }} />
            {isEdit ? "Modifier l'annonce" : "Nouvelle annonce"}
          </h2>
        </div>
      </div>

      <div className="space-y-6 p-6 rounded-2xl"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>

        {/* Titre */}
        <div className="space-y-2">
          <label className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
            Titre <span style={{ color: "#FF4D6D" }}>*</span>
          </label>
          <Input
            value={titre}
            onChange={e => setTitre(e.target.value)}
            placeholder="Titre de l'annonce…"
            maxLength={200}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--m15-border)" }}
          />
        </div>

        {/* Type */}
        <div className="space-y-2">
          <label className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
            Type
          </label>
          <div className="flex flex-wrap gap-2">
            {TYPES.map(t => {
              const Icon = t.icon;
              const active = type === t.id;
              return (
                <button key={t.id} onClick={() => setType(t.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: active ? `${t.color}18` : "rgba(255,255,255,0.04)",
                    color: active ? t.color : "var(--m15-muted)",
                    border: active ? `1px solid ${t.color}40` : "1px solid var(--m15-border)",
                  }}>
                  <Icon className="w-4 h-4" /> {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Destinataires */}
        <div className="space-y-2">
          <label className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
            Destinataires
          </label>
          <div className="flex flex-wrap gap-2">
            {DEST_OPTIONS.map(d => {
              const active = destinataires.includes(d.id);
              return (
                <button key={d.id} onClick={() => toggleDest(d.id)}
                  className="px-3 py-1.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: active ? "rgba(0,201,167,0.12)" : "rgba(255,255,255,0.04)",
                    color: active ? "#00C9A7" : "var(--m15-muted)",
                    border: active ? "1px solid rgba(0,201,167,0.3)" : "1px solid var(--m15-border)",
                  }}>
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Contenu */}
        <div className="space-y-2">
          <label className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
            Contenu <span style={{ color: "#FF4D6D" }}>*</span>
          </label>
          <Textarea
            value={contenu}
            onChange={e => setContenu(e.target.value)}
            placeholder="Rédigez votre annonce…"
            rows={8}
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--m15-border)", resize: "vertical" }}
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
              Date de publication
            </label>
            <Input
              type="datetime-local"
              value={datePublication}
              onChange={e => setDatePub(e.target.value)}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--m15-border)" }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
              Date d'expiration
            </label>
            <Input
              type="datetime-local"
              value={dateExpiration}
              onChange={e => setDateExp(e.target.value)}
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--m15-border)" }}
            />
          </div>
        </div>

        {/* Options */}
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2.5 cursor-pointer">
            <div
              onClick={() => setEpingle(!epingle)}
              className="w-10 h-5.5 rounded-full relative transition-colors cursor-pointer"
              style={{
                background: epingle ? "#F5C842" : "rgba(255,255,255,0.1)",
                border: "1px solid " + (epingle ? "#F5C842" : "var(--m15-border)"),
              }}>
              <div className="absolute top-0.5 transition-all w-4 h-4 rounded-full bg-white"
                style={{ left: epingle ? "calc(100% - 1.1rem)" : "2px" }} />
            </div>
            <Pin className="w-4 h-4" style={{ color: epingle ? "#F5C842" : "var(--m15-muted)" }} />
            <span className="text-sm" style={{ color: "var(--m15-white)" }}>Épingler</span>
          </label>
        </div>

        {/* Pièce jointe (optionnel) */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
              Lien pièce jointe
            </label>
            <Input
              value={pieceJointeUrl}
              onChange={e => setPieceJointeUrl(e.target.value)}
              placeholder="https://…"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--m15-border)" }}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
              Nom du fichier
            </label>
            <Input
              value={pieceJointeNom}
              onChange={e => setPieceJointeNom(e.target.value)}
              placeholder="document.pdf"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--m15-border)" }}
            />
          </div>
        </div>
      </div>

      {/* Aperçu */}
      {titre && (
        <div className="p-5 rounded-2xl space-y-2"
          style={{
            background: "rgba(0,201,167,0.04)",
            border: "1px solid rgba(0,201,167,0.15)",
          }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00C9A7" }}>
            Aperçu
          </p>
          <div className="flex items-center gap-2 mb-1">
            {(() => { const Icon = typeMeta.icon; return <Icon className="w-4 h-4" style={{ color: typeMeta.color }} />; })()}
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: `${typeMeta.color}18`, color: typeMeta.color }}>
              {typeMeta.label}
            </span>
          </div>
          <h3 className="font-bold" style={{ color: "var(--m15-white)" }}>{titre}</h3>
          {contenu && (
            <p className="text-sm line-clamp-3" style={{ color: "var(--m15-muted)" }}>{contenu}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={() => setLocation("/annonces")} disabled={isLoading}>
          Annuler
        </Button>
        <Button
          variant="outline"
          onClick={() => handleSave(false)}
          disabled={isLoading}
          className="gap-2">
          {createMut.isPending || updateMut.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Save className="w-4 h-4" />}
          Enregistrer brouillon
        </Button>
        <Button
          onClick={() => handleSave(true)}
          disabled={isLoading}
          className="gap-2"
          style={{ background: "linear-gradient(135deg, #0080FF, #00C9A7)", border: "none" }}>
          {isLoading
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />}
          Publier
        </Button>
      </div>
    </div>
  );
}
