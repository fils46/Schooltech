import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useListerClasses, useListerAnneesScolaires, useListerEleves,
  type AnneeScolaire, type Classe,
} from "@workspace/api-client-react";
import {
  Sun, Sunset, Calendar, Users, CheckSquare, Square,
  Save, RefreshCw, AlertTriangle, Clock,
} from "lucide-react";

interface Eleve { id: string; nom: string; prenoms: string; photo_url?: string | null; }

const PERIODES = [
  { val: "matin",         label: "Matin",           icon: Sun,    color: "#FFB300" },
  { val: "apres_midi",    label: "Après-midi",       icon: Sunset, color: "#0080FF" },
  { val: "journee_entiere", label: "Journée entière", icon: Calendar, color: "#FF4D6D" },
] as const;

function Avatar({ nom, prenoms, photo }: { nom: string; prenoms: string; photo?: string | null }) {
  if (photo) return <img src={photo} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />;
  const i = `${prenoms.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>{i}</div>
  );
}

export default function SaisieDemiJournee() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [anneeId, setAnneeId] = useState("");
  const [classeId, setClasseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0] ?? "");
  const [periode, setPeriode] = useState<"matin" | "apres_midi" | "journee_entiere">("matin");
  const [selectionnes, setSelectionnes] = useState<Set<string>>(new Set());
  const [motif, setMotif] = useState("");
  const [confirming, setConfirming] = useState(false);

  if (!["dev", "directeur", "censeur"].includes(user?.role ?? "")) {
    return <div className="p-6" style={{ color: "var(--m15-muted)" }}>Accès refusé.</div>;
  }

  const { data: anneesData } = useListerAnneesScolaires();
  const { data: classesData } = useListerClasses();
  const annees: AnneeScolaire[] = (anneesData as { annees?: AnneeScolaire[] } | undefined)?.annees ?? [];
  const classes: Classe[] = (classesData as { classes?: Classe[] } | undefined)?.classes ?? [];

  const { data: elevesData, isLoading: loadEleves } = useListerEleves(
    { statut: "actif", page: 1, limit: 100 },
    { query: { queryKey: ["eleves-liste-demi", classeId], enabled: !!classeId } }
  );
  const elevesRaw: Eleve[] = (elevesData as { eleves?: Eleve[] })?.eleves ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      if (!anneeId || !classeId || selectionnes.size === 0) throw new Error("Données incomplètes");
      const token = localStorage.getItem("m15_token") ?? "";
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/absences/demi-journee`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          eleve_ids: Array.from(selectionnes),
          date_absence: date,
          periode,
          motif_absence: motif || undefined,
          annee_scolaire_id: anneeId,
          classe_id: classeId,
        }),
      });
      if (!r.ok) {
        const err = await r.json() as { message?: string };
        throw new Error(err.message ?? "Erreur");
      }
      return r.json() as Promise<{ nb_creees: number }>;
    },
    onSuccess: (data) => {
      toast({ title: `${data.nb_creees} absence(s) enregistrée(s).` });
      setSelectionnes(new Set());
      setMotif("");
      setConfirming(false);
      void qc.invalidateQueries({ queryKey: ["eleves-liste-demi", classeId] });
    },
    onError: (e) => toast({ title: String((e as Error).message), variant: "destructive" }),
  });

  const toggle = (id: string) => {
    setSelectionnes(s => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selectionnes.size === elevesRaw.length) setSelectionnes(new Set());
    else setSelectionnes(new Set(elevesRaw.map(e => e.id)));
  };

  const periodeConfig = PERIODES.find(p => p.val === periode)!;
  const PIcon = periodeConfig.icon;

  return (
    <div className="space-y-6 page-fade-in max-w-3xl">

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(255,179,0,0.12)", border: "1px solid rgba(255,179,0,0.2)" }}>
          <Clock className="w-5 h-5" style={{ color: "#FFB300" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Absences demi-journée
          </h1>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Saisie administrative — matin, après-midi ou journée entière
          </p>
        </div>
      </div>

      {/* Sélection contexte */}
      <div className="rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>

        <div className="space-y-1.5">
          <label className="text-xs" style={{ color: "var(--m15-muted)" }}>Année scolaire</label>
          <select value={anneeId} onChange={e => setAnneeId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            <option value="">— Sélectionner —</option>
            {annees.map(a => <option key={a.id} value={a.id}>{a.libelle}{a.est_active ? " ★" : ""}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs" style={{ color: "var(--m15-muted)" }}>Classe</label>
          <select value={classeId} onChange={e => { setClasseId(e.target.value); setSelectionnes(new Set()); }}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            <option value="">— Sélectionner —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs" style={{ color: "var(--m15-muted)" }}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs" style={{ color: "var(--m15-muted)" }}>Motif (optionnel)</label>
          <input value={motif} onChange={e => setMotif(e.target.value)} placeholder="Ex : journée pédagogique..."
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
        </div>
      </div>

      {/* Sélection période */}
      <div className="grid grid-cols-3 gap-3">
        {PERIODES.map(({ val, label, icon: Icon, color }) => {
          const active = periode === val;
          return (
            <button key={val} type="button" onClick={() => setPeriode(val)}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all"
              style={{
                background: active ? `${color}12` : "var(--m15-card)",
                border: `1px solid ${active ? `${color}40` : "var(--m15-border)"}`,
              }}>
              <Icon className="w-5 h-5" style={{ color: active ? color : "var(--m15-muted)" }} />
              <span className="text-xs font-semibold" style={{ color: active ? color : "var(--m15-muted)" }}>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Liste élèves */}
      {classeId && (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: "1px solid var(--m15-border)", background: "var(--m15-card2)" }}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />
              <span className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
                {elevesRaw.length} élève{elevesRaw.length !== 1 ? "s" : ""}
              </span>
              {selectionnes.size > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                  style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D" }}>
                  {selectionnes.size} sélectionné{selectionnes.size > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <button type="button" onClick={toggleAll}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{ background: "var(--elevate-1)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
              {selectionnes.size === elevesRaw.length ? "Tout décocher" : "Tout cocher"}
            </button>
          </div>

          {loadEleves ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "var(--elevate-1)" }} />
              ))}
            </div>
          ) : elevesRaw.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun élève actif dans cette classe.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
              {elevesRaw.map(e => {
                const checked = selectionnes.has(e.id);
                return (
                  <label key={e.id}
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-all"
                    style={{ background: checked ? "rgba(255,77,109,0.04)" : "transparent" }}
                    onMouseEnter={el => { if (!checked) (el.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                    onMouseLeave={el => { if (!checked) (el.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(e.id)} />
                    {checked
                      ? <CheckSquare className="w-5 h-5 flex-shrink-0" style={{ color: "#FF4D6D" }} />
                      : <Square className="w-5 h-5 flex-shrink-0" style={{ color: "var(--m15-muted)" }} />
                    }
                    <Avatar nom={e.nom} prenoms={e.prenoms} photo={e.photo_url} />
                    <span className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>
                      {e.prenoms} {e.nom}
                    </span>
                    {checked && (
                      <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
                        style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D" }}>
                        Absent
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Confirmation + enregistrement */}
      {selectionnes.size > 0 && (
        <div className="rounded-2xl p-4 space-y-3"
          style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.2)" }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#FF4D6D" }} />
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
              <strong style={{ color: "#FF4D6D" }}>{selectionnes.size} élève{selectionnes.size > 1 ? "s" : ""}</strong> marqué{selectionnes.size > 1 ? "s" : ""} absent{selectionnes.size > 1 ? "s" : ""} pour le{" "}
              <strong style={{ color: "var(--m15-white)" }}>
                {periodeConfig.label.toLowerCase()}
              </strong>{" "}
              du <strong style={{ color: "var(--m15-white)" }}>{date}</strong>. Les parents seront notifiés.
            </p>
          </div>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !anneeId}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: "#FF4D6D",
              color: "#fff",
              opacity: mutation.isPending || !anneeId ? 0.6 : 1,
            }}>
            {mutation.isPending
              ? <RefreshCw className="w-4 h-4 animate-spin" />
              : <Save className="w-4 h-4" />
            }
            Enregistrer les absences
          </button>
        </div>
      )}
    </div>
  );
}
