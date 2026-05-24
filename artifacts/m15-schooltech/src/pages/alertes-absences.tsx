import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListerClasses, useListerAnneesScolaires } from "@workspace/api-client-react";
import {
  AlertTriangle, Bell, CheckCircle, XCircle, RefreshCw,
  Filter, ExternalLink,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface Alerte {
  id: string;
  eleve_id: string;
  eleve_nom: string;
  eleve_prenoms: string;
  classe_nom: string;
  niveau_alerte: number;
  nb_absences_nj_atteint: number;
  date_declenchement: string;
  traitement_statut: "nouvelle" | "en_cours" | "traitee" | "ignoree";
  traitement_notes?: string | null;
  trimestre?: number | null;
}

interface Stats { niveau_1: number; niveau_2: number; niveau_3: number; }
interface Classe { id: string; nom: string; }
interface AnneeScolaire { id: string; annee: string; courante?: boolean; }

const NIVEAU_CONFIG: Record<number, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  1: { label: "Niveau 1", color: "#FFB300", bg: "rgba(255,179,0,0.12)", icon: AlertTriangle },
  2: { label: "Niveau 2", color: "#FF8C00", bg: "rgba(255,140,0,0.12)", icon: Bell },
  3: { label: "Niveau 3", color: "#FF4D6D", bg: "rgba(255,77,109,0.12)", icon: XCircle },
};

const STATUT_LABEL: Record<string, { label: string; color: string }> = {
  nouvelle: { label: "Nouvelle", color: "#FF4D6D" },
  en_cours: { label: "En cours", color: "#FFB300" },
  traitee: { label: "Traitée", color: "#00C9A7" },
  ignoree: { label: "Ignorée", color: "var(--m15-muted)" },
};

export default function AlertesAbsences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [niveau, setNiveau] = useState("");
  const [statut, setStatut] = useState("nouvelle");
  const [classeId, setClasseId] = useState("");
  const [trimestre, setTrimestre] = useState("");
  const [modal, setModal] = useState<{ alerte: Alerte } | null>(null);
  const [traitementStatut, setTraitementStatut] = useState<"en_cours" | "traitee" | "ignoree">("traitee");
  const [notes, setNotes] = useState("");

  if (!["dev", "directeur", "censeur"].includes(user?.role ?? "")) {
    return <div className="p-6" style={{ color: "var(--m15-muted)" }}>Accès refusé.</div>;
  }

  const { data: classesData } = useListerClasses();
  const classes: Classe[] = (classesData as { classes?: Classe[] })?.classes ?? [];

  const buildUrl = () => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const params = new URLSearchParams();
    if (niveau) params.set("niveau_alerte", niveau);
    if (statut) params.set("statut", statut);
    if (classeId) params.set("classe_id", classeId);
    if (trimestre) params.set("trimestre", trimestre);
    return `${base}/api/absences/alertes?${params.toString()}`;
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["alertes-absences", niveau, statut, classeId, trimestre],
    queryFn: async () => {
      const token = localStorage.getItem("m15_token") ?? "";
      const r = await fetch(buildUrl(), { headers: { Authorization: `Bearer ${token}` } });
      return r.json() as Promise<{ alertes: Alerte[]; stats: Stats }>;
    },
  });

  const alertes: Alerte[] = data?.alertes ?? [];
  const stats: Stats = data?.stats ?? { niveau_1: 0, niveau_2: 0, niveau_3: 0 };

  const traiter = useMutation({
    mutationFn: async ({ id, statut: s, notes: n }: { id: string; statut: string; notes: string }) => {
      const token = localStorage.getItem("m15_token") ?? "";
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/absences/alertes/${id}/traiter`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ traitement_statut: s, traitement_notes: n || undefined }),
      });
      if (!r.ok) throw new Error("Erreur traitement");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Alerte mise à jour." });
      setModal(null);
      setNotes("");
      void qc.invalidateQueries({ queryKey: ["alertes-absences"] });
    },
    onError: () => toast({ title: "Erreur lors du traitement.", variant: "destructive" }),
  });

  const resetFiltres = () => { setNiveau(""); setStatut("nouvelle"); setClasseId(""); setTrimestre(""); };

  return (
    <div className="space-y-6 page-fade-in">

      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(255,77,109,0.12)", border: "1px solid rgba(255,77,109,0.2)" }}>
            <AlertTriangle className="w-5 h-5" style={{ color: "#FF4D6D" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Alertes d'absences
            </h1>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
              Élèves ayant atteint un seuil d'absences non justifiées
            </p>
          </div>
        </div>
        <button onClick={() => refetch()}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-3">
        {([
          { key: "niveau_1", label: "Niveau 1", color: "#FFB300", val: stats.niveau_1 },
          { key: "niveau_2", label: "Niveau 2", color: "#FF8C00", val: stats.niveau_2 },
          { key: "niveau_3", label: "Niveau 3", color: "#FF4D6D", val: stats.niveau_3 },
        ] as const).map(({ key, label, color, val }) => (
          <div key={key} className="rounded-2xl p-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>{label} — non traitées</p>
            <p className="text-3xl font-bold" style={{ color, fontFamily: "'Syne', sans-serif" }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div className="rounded-xl p-4 flex flex-wrap gap-3"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <select value={niveau} onChange={e => setNiveau(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          <option value="">Tous niveaux</option>
          <option value="1">Niveau 1</option>
          <option value="2">Niveau 2</option>
          <option value="3">Niveau 3</option>
        </select>

        <select value={statut} onChange={e => setStatut(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          <option value="">Tous statuts</option>
          <option value="nouvelle">Nouvelles</option>
          <option value="en_cours">En cours</option>
          <option value="traitee">Traitées</option>
          <option value="ignoree">Ignorées</option>
        </select>

        <select value={classeId} onChange={e => setClasseId(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          <option value="">Toutes classes</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </select>

        <select value={trimestre} onChange={e => setTrimestre(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          <option value="">Tous trimestres</option>
          <option value="1">Trimestre 1</option>
          <option value="2">Trimestre 2</option>
          <option value="3">Trimestre 3</option>
        </select>

        {(niveau || statut !== "nouvelle" || classeId || trimestre) && (
          <button onClick={resetFiltres}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
            style={{ color: "#FF4D6D", background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }}>
            <Filter className="w-3.5 h-3.5" /> Réinitialiser
          </button>
        )}
      </div>

      {/* Tableau */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--m15-card2)", borderBottom: "1px solid var(--m15-border)" }}>
              {["Élève", "Classe", "Niveau", "Abs. NJ", "Date déclenchement", "Statut", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3">
                  <div className="h-8 rounded-lg animate-pulse" style={{ background: "var(--elevate-1)" }} />
                </td></tr>
              ))
            ) : alertes.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center">
                <CheckCircle className="w-10 h-10 mx-auto mb-3" style={{ color: "#00C9A7", opacity: 0.4 }} />
                <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucune alerte pour cette sélection.</p>
              </td></tr>
            ) : (
              alertes.map(a => {
                const nv = NIVEAU_CONFIG[a.niveau_alerte] ?? NIVEAU_CONFIG[1]!;
                const NvIcon = nv.icon;
                const s = STATUT_LABEL[a.traitement_statut] ?? STATUT_LABEL.nouvelle!;
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--m15-border)" }}
                    onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                    onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--m15-white)" }}>
                      {a.eleve_prenoms} {a.eleve_nom}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: "var(--m15-muted)" }}>{a.classe_nom}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                        style={{ background: nv.bg, color: nv.color }}>
                        <NvIcon className="w-3 h-3" />
                        {nv.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold" style={{ color: nv.color }}>
                        {a.nb_absences_nj_atteint}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--m15-muted)" }}>
                      {new Date(a.date_declenchement).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ background: `${s.color}18`, color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {a.traitement_statut !== "traitee" && a.traitement_statut !== "ignoree" && (
                          <button
                            onClick={() => { setModal({ alerte: a }); setTraitementStatut("traitee"); setNotes(""); }}
                            className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all"
                            style={{ background: "rgba(0,201,167,0.08)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
                            Traiter
                          </button>
                        )}
                        <Link href={`/eleves/${a.eleve_id}`}>
                          <button className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all"
                            style={{ background: "var(--elevate-1)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal traitement */}
      <Dialog open={!!modal} onOpenChange={() => setModal(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Traiter l'alerte</DialogTitle>
          </DialogHeader>
          {modal && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-xl" style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
                <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
                  {modal.alerte.eleve_prenoms} {modal.alerte.eleve_nom}
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--m15-muted)" }}>
                  {modal.alerte.nb_absences_nj_atteint} absences NJ — Niveau {modal.alerte.niveau_alerte} — {modal.alerte.classe_nom}
                </p>
              </div>
              <div>
                <Label className="mb-2 block">Statut du traitement</Label>
                <div className="flex gap-2">
                  {(["en_cours", "traitee", "ignoree"] as const).map(s => (
                    <button key={s} type="button" onClick={() => setTraitementStatut(s)}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: traitementStatut === s ? "rgba(0,201,167,0.12)" : "var(--elevate-1)",
                        border: `1px solid ${traitementStatut === s ? "rgba(0,201,167,0.3)" : "var(--m15-border)"}`,
                        color: traitementStatut === s ? "#00C9A7" : "var(--m15-muted)",
                      }}>
                      {s === "en_cours" ? "En cours" : s === "traitee" ? "Traitée" : "Ignorée"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="mb-2 block">Notes (optionnel)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="Notes sur le traitement..."
                  className="min-h-[80px]" />
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setModal(null)}
                  className="px-4 py-2 rounded-xl text-sm"
                  style={{ background: "var(--m15-card)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
                  Annuler
                </button>
                <button
                  onClick={() => traiter.mutate({ id: modal.alerte.id, statut: traitementStatut, notes })}
                  disabled={traiter.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff", opacity: traiter.isPending ? 0.7 : 1 }}>
                  {traiter.isPending && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  Confirmer
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
