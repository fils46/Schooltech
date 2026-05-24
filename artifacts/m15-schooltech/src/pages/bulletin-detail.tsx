import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetBulletin,
  useAjouterAppreciation,
  usePublierBulletin,
  getGetBulletinQueryKey,
  type AppreciationInputDecisionConseil,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Printer, CheckCircle, FileText, Loader2, Edit2, Award,
} from "lucide-react";

const MENTION_COLORS: Record<string, string> = {
  tres_bien:   "#00C9A7",
  bien:        "#0080FF",
  assez_bien:  "#F5C842",
  passable:    "#F97316",
  insuffisant: "#FF4D6D",
};
const MENTION_LABELS: Record<string, string> = {
  tres_bien:   "Très Bien",
  bien:        "Bien",
  assez_bien:  "Assez Bien",
  passable:    "Passable",
  insuffisant: "Insuffisant",
};
const DECISION_LABELS: Record<string, string> = {
  passage:      "Passage en classe supérieure",
  redoublement: "Redoublement",
  exclusion:    "Exclusion",
  orientation:  "Orientation",
};

type DetailItem = {
  id: string;
  matiere: string;
  coefficient: number;
  moyenne_matiere: number | null;
  note_min_classe: number | null;
  note_max_classe: number | null;
  moyenne_classe: number | null;
  appreciation_prof: string | null;
};

type BulletinDetail = {
  id: string;
  eleve_nom: string;
  eleve_prenoms: string;
  eleve_matricule: string;
  classe_nom: string;
  annee_scolaire_libelle: string;
  trimestre: string;
  moyenne_generale: number | null;
  rang: number | null;
  effectif_classe: number | null;
  mention: string | null;
  appreciation_conseil: string | null;
  decision_conseil: string | null;
  publie: boolean;
  date_publication: string | null;
  details: DetailItem[];
};

export default function BulletinDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [showAppreciation, setShowAppreciation] = useState(false);
  const [appForm, setAppForm] = useState<{ appreciation_conseil: string; decision_conseil: string }>({
    appreciation_conseil: "",
    decision_conseil: "",
  });

  const { data, isLoading } = useGetBulletin(id);
  const bulletin: BulletinDetail | null = (data as { bulletin?: BulletinDetail })?.bulletin ?? null;

  const ajouterApp = useAjouterAppreciation();
  const publier = usePublierBulletin();

  const invalidate = () => qc.invalidateQueries({ queryKey: getGetBulletinQueryKey(id) });

  function openAppreciation() {
    setAppForm({
      appreciation_conseil: bulletin?.appreciation_conseil ?? "",
      decision_conseil: bulletin?.decision_conseil ?? "",
    });
    setShowAppreciation(true);
  }

  function handleSauvegarderAppreciation() {
    ajouterApp.mutate(
      { id, data: { appreciation_conseil: appForm.appreciation_conseil || null, decision_conseil: (appForm.decision_conseil || null) as AppreciationInputDecisionConseil } },
      {
        onSuccess: () => {
          toast({ title: "Appréciation sauvegardée." });
          setShowAppreciation(false);
          invalidate();
        },
        onError: () => toast({ title: "Erreur lors de la sauvegarde.", variant: "destructive" }),
      }
    );
  }

  function handlePublier() {
    publier.mutate(
      { id },
      {
        onSuccess: () => { toast({ title: "Bulletin publié !" }); invalidate(); },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur lors de la publication.";
          toast({ title: msg, variant: "destructive" });
        },
      }
    );
  }

  function handleImpression() {
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.open(`${baseUrl}/api/bulletins/${id}/pdf`, "_blank");
  }

  const canEdit = ["dev", "directeur", "censeur"].includes(user?.role ?? "");
  const canPublish = user?.role === "directeur" || user?.role === "dev";

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!bulletin) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <FileText className="w-10 h-10 mx-auto mb-4" style={{ color: "var(--m15-muted)" }} />
        <p style={{ color: "var(--m15-muted)" }}>Bulletin introuvable.</p>
      </div>
    );
  }

  const mention = bulletin.mention ? MENTION_LABELS[bulletin.mention] : null;
  const mentionColor = bulletin.mention ? MENTION_COLORS[bulletin.mention] : "#8B9DC3";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/bulletins")} className="w-9 h-9 flex items-center justify-center rounded-xl transition-all" style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Bulletin — {bulletin.eleve_prenoms} {bulletin.eleve_nom?.toUpperCase()}
            </h2>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>{bulletin.classe_nom} • T{bulletin.trimestre} • {bulletin.annee_scolaire_libelle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={handleImpression} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "var(--elevate-2)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
            <Printer className="w-4 h-4" /> Imprimer
          </button>
          {canEdit && !bulletin.publie && (
            <button onClick={openAppreciation} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "rgba(0,128,255,0.12)", border: "1px solid rgba(0,128,255,0.25)", color: "#0080FF" }}>
              <Edit2 className="w-4 h-4" /> Appréciation
            </button>
          )}
          {canPublish && !bulletin.publie && (
            <button onClick={handlePublier} disabled={publier.isPending} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ background: "#00C9A7", color: "var(--m15-navy)" }}>
              {publier.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Publier
            </button>
          )}
        </div>
      </div>

      {/* Statut */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{
        background: bulletin.publie ? "rgba(0,201,167,0.08)" : "rgba(245,200,66,0.08)",
        border: `1px solid ${bulletin.publie ? "rgba(0,201,167,0.25)" : "rgba(245,200,66,0.25)"}`,
      }}>
        <div className="w-2 h-2 rounded-full" style={{ background: bulletin.publie ? "#00C9A7" : "#F5C842" }} />
        <span className="text-sm font-semibold" style={{ color: bulletin.publie ? "#00C9A7" : "#F5C842" }}>
          {bulletin.publie ? `Publié le ${bulletin.date_publication ?? ""}` : "Brouillon — non publié"}
        </span>
      </div>

      {/* Résumé */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl p-5 text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--m15-muted)" }}>Moyenne Générale</p>
          <p className="text-3xl font-bold" style={{ color: bulletin.moyenne_generale !== null ? (bulletin.moyenne_generale >= 10 ? "#00C9A7" : "#FF4D6D") : "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>
            {bulletin.moyenne_generale !== null ? bulletin.moyenne_generale.toFixed(2) : "—"}
            <span className="text-sm font-normal" style={{ color: "var(--m15-muted)" }}>/20</span>
          </p>
        </div>
        <div className="rounded-xl p-5 text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--m15-muted)" }}>Rang</p>
          <p className="text-3xl font-bold" style={{ color: "#F5C842", fontFamily: "'Syne', sans-serif" }}>
            {bulletin.rang !== null ? `${bulletin.rang}${bulletin.rang === 1 ? "er" : "ème"}` : "—"}
            <span className="text-sm font-normal" style={{ color: "var(--m15-muted)" }}> /{bulletin.effectif_classe ?? "?"}</span>
          </p>
        </div>
        <div className="rounded-xl p-5 text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <p className="text-xs mb-2" style={{ color: "var(--m15-muted)" }}>Mention</p>
          {mention ? (
            <span className="px-3 py-1 rounded-full text-sm font-bold" style={{ background: `${mentionColor}22`, color: mentionColor }}>
              {mention}
            </span>
          ) : <p className="text-xl font-bold" style={{ color: "var(--m15-muted)" }}>—</p>}
        </div>
      </div>

      {/* Tableau détails */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="px-5 py-3" style={{ borderBottom: "1px solid var(--m15-border)", background: "var(--elevate-1)" }}>
          <h3 className="font-semibold" style={{ color: "var(--m15-white)" }}>Détail par matière</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ background: "var(--elevate-1)", borderBottom: "1px solid var(--m15-border)" }}>
                {["Matière", "Coeff.", "Moy/20", "Moy Classe", "Min", "Max", "Appréciation Prof"].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase text-left" style={{ color: "var(--m15-muted)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bulletin.details.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8" style={{ color: "var(--m15-muted)" }}>Aucune matière enregistrée</td></tr>
              ) : bulletin.details.map((d, idx) => {
                const moy = d.moyenne_matiere;
                const moyColor = moy === null ? "var(--m15-muted)" : moy >= 10 ? "#00C9A7" : "#FF4D6D";
                const rowBg = idx % 2 === 0 ? undefined : "var(--elevate-1)";
                return (
                  <tr key={d.id} style={{ background: rowBg, borderTop: "1px solid var(--m15-border)" }}>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--m15-white)" }}>{d.matiere}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="px-2 py-0.5 rounded-lg text-xs font-bold" style={{ background: "rgba(0,128,255,0.12)", color: "#0080FF" }}>{d.coefficient}</span>
                    </td>
                    <td className="px-4 py-3 text-center font-bold" style={{ color: moyColor }}>
                      {moy !== null ? moy.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3 text-center text-sm" style={{ color: "var(--m15-muted)" }}>{d.moyenne_classe !== null ? d.moyenne_classe.toFixed(2) : "—"}</td>
                    <td className="px-4 py-3 text-center text-sm" style={{ color: "var(--m15-muted)" }}>{d.note_min_classe !== null ? d.note_min_classe.toFixed(2) : "—"}</td>
                    <td className="px-4 py-3 text-center text-sm" style={{ color: "var(--m15-muted)" }}>{d.note_max_classe !== null ? d.note_max_classe.toFixed(2) : "—"}</td>
                    <td className="px-4 py-3 text-sm italic" style={{ color: "var(--m15-muted)" }}>{d.appreciation_prof ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Conseil de classe */}
      {(bulletin.appreciation_conseil || bulletin.decision_conseil) && (
        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-5 h-5" style={{ color: "#0080FF" }} />
            <h3 className="font-semibold" style={{ color: "var(--m15-white)" }}>Conseil de classe</h3>
          </div>
          {bulletin.appreciation_conseil && (
            <div className="mb-2">
              <span className="text-xs font-semibold uppercase" style={{ color: "var(--m15-muted)" }}>Appréciation : </span>
              <span className="text-sm" style={{ color: "var(--m15-white)" }}>{bulletin.appreciation_conseil}</span>
            </div>
          )}
          {bulletin.decision_conseil && (
            <div>
              <span className="text-xs font-semibold uppercase" style={{ color: "var(--m15-muted)" }}>Décision : </span>
              <span className="px-2 py-0.5 rounded-lg text-sm font-semibold" style={{
                background: bulletin.decision_conseil === "passage" ? "rgba(0,201,167,0.12)" : "rgba(255,77,109,0.12)",
                color: bulletin.decision_conseil === "passage" ? "#00C9A7" : "#FF4D6D",
              }}>
                {DECISION_LABELS[bulletin.decision_conseil] ?? bulletin.decision_conseil}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Modal appréciation */}
      <Dialog open={showAppreciation} onOpenChange={setShowAppreciation}>
        <DialogContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)" }}>Appréciation du Conseil de Classe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Appréciation</Label>
              <textarea
                rows={3}
                value={appForm.appreciation_conseil}
                onChange={e => setAppForm(p => ({ ...p, appreciation_conseil: e.target.value }))}
                placeholder="Ex: Bon trimestre, efforts à maintenir..."
                className="w-full px-3 py-2 rounded-xl text-sm outline-none resize-none"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Décision</Label>
              <Select value={appForm.decision_conseil || "__none__"} onValueChange={v => setAppForm(p => ({ ...p, decision_conseil: v === "__none__" ? "" : v }))}>
                <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <SelectValue placeholder="Choisir une décision" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucune</SelectItem>
                  <SelectItem value="passage">Passage en classe supérieure</SelectItem>
                  <SelectItem value="redoublement">Redoublement</SelectItem>
                  <SelectItem value="exclusion">Exclusion</SelectItem>
                  <SelectItem value="orientation">Orientation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSauvegarderAppreciation}
                disabled={ajouterApp.isPending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold"
                style={{ background: "#00C9A7", color: "var(--m15-navy)" }}
              >
                {ajouterApp.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Enregistrer
              </button>
              <button onClick={() => setShowAppreciation(false)} className="flex-1 py-2.5 rounded-xl font-semibold" style={{ background: "var(--elevate-2)", color: "var(--m15-white)" }}>
                Annuler
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
