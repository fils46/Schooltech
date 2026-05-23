import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetBulletinsClasse,
  useGenererBulletinsClasse,
  useCalculerRangs,
  usePublierBulletinsClasse,
  useListerClasses,
  useListerAnneesScolaires,
  getGetBulletinsClasseQueryKey,
  type GenererClasseInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText, Loader2, RefreshCw, CheckCircle, TrendingUp,
  Users, Eye, ChevronRight, Award,
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

type BulletinItem = {
  id: string;
  eleve_id: string;
  eleve_nom: string;
  eleve_prenoms: string;
  eleve_matricule: string;
  trimestre: string;
  moyenne_generale: number | null;
  rang: number | null;
  effectif_classe: number | null;
  mention: string | null;
  publie: boolean;
  details: unknown[];
};
type Classe = { id: string; nom: string };
type AnneeScolaire = { id: string; libelle: string };

function MoyBadge({ moy }: { moy: number | null }) {
  if (moy === null) return <span style={{ color: "var(--m15-muted)" }}>—</span>;
  const color = moy >= 10 ? "#00C9A7" : "#FF4D6D";
  return <span className="font-bold" style={{ color }}>{moy.toFixed(2)}</span>;
}

export default function BulletinGestion() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [classeId, setClasseId] = useState("");
  const [anneeId, setAnneeId] = useState("");
  const [trimestre, setTrimestre] = useState("1");

  const { data: classesData } = useListerClasses();
  const { data: anneesData } = useListerAnneesScolaires();
  const classes: Classe[] = (classesData as { classes?: Classe[] })?.classes ?? [];
  const annees: AnneeScolaire[] = (anneesData as { annees?: AnneeScolaire[] })?.annees ?? [];

  const t = trimestre as GenererClasseInput["trimestre"];
  const bParams = { trimestre: t, annee_scolaire_id: anneeId };
  const qKey = getGetBulletinsClasseQueryKey(classeId, bParams);

  const { data: bData, isLoading } = useGetBulletinsClasse(
    classeId || "skip",
    bParams,
    { query: { queryKey: qKey, enabled: !!classeId && !!anneeId } }
  );

  const bulletins: BulletinItem[] = (bData as { bulletins?: BulletinItem[] })?.bulletins ?? [];
  const stats = (bData as { stats?: { moyenne_classe: number; meilleure_moyenne: number; plus_basse_moyenne: number; nb_au_dessus_10: number; nb_en_dessous_10: number; total: number } })?.stats;

  const generer = useGenererBulletinsClasse();
  const calcRangs = useCalculerRangs();
  const publierClasse = usePublierBulletinsClasse();

  const invalidate = () => qc.invalidateQueries({ queryKey: qKey });

  function handleGenerer() {
    if (!classeId || !anneeId) return;
    generer.mutate(
      { data: { classe_id: classeId, annee_scolaire_id: anneeId, trimestre: t } },
      {
        onSuccess: (res) => {
          const r = res as { generes: number; erreurs: unknown[] };
          toast({ title: `${r.generes} bulletin(s) généré(s).${r.erreurs.length ? ` ${r.erreurs.length} erreur(s).` : ""}` });
          invalidate();
        },
        onError: () => toast({ title: "Erreur lors de la génération.", variant: "destructive" }),
      }
    );
  }

  function handleCalculerRangs() {
    if (!classeId || !anneeId) return;
    calcRangs.mutate(
      { data: { classe_id: classeId, annee_scolaire_id: anneeId, trimestre: t } },
      {
        onSuccess: () => { toast({ title: "Rangs recalculés." }); invalidate(); },
        onError: () => toast({ title: "Erreur lors du calcul des rangs.", variant: "destructive" }),
      }
    );
  }

  function handlePublierClasse() {
    if (!classeId || !anneeId) return;
    publierClasse.mutate(
      { data: { classe_id: classeId, annee_scolaire_id: anneeId, trimestre: t } },
      {
        onSuccess: (res) => {
          const r = res as { publies: number; erreurs: unknown[] };
          toast({ title: `${r.publies} bulletin(s) publié(s).${r.erreurs.length ? ` ${r.erreurs.length} erreur(s).` : ""}` });
          invalidate();
        },
        onError: () => toast({ title: "Erreur lors de la publication.", variant: "destructive" }),
      }
    );
  }

  const nbPublies = bulletins.filter(b => b.publie).length;
  const canAction = ["dev", "directeur", "censeur"].includes(user?.role ?? "");

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,128,255,0.12)", border: "1px solid rgba(0,128,255,0.25)" }}>
            <FileText className="w-5 h-5" style={{ color: "#0080FF" }} />
          </div>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Gestion des Bulletins</h2>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Génération et publication des bulletins scolaires</p>
          </div>
        </div>
      </div>

      {/* Filtres */}
      <div className="rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-3 gap-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Classe</Label>
          <Select value={classeId} onValueChange={setClasseId}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Sélectionner une classe" />
            </SelectTrigger>
            <SelectContent>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Année scolaire</Label>
          <Select value={anneeId} onValueChange={setAnneeId}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Sélectionner une année" />
            </SelectTrigger>
            <SelectContent>
              {annees.map(a => <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Trimestre</Label>
          <Select value={trimestre} onValueChange={setTrimestre}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Trimestre 1</SelectItem>
              <SelectItem value="2">Trimestre 2</SelectItem>
              <SelectItem value="3">Trimestre 3</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Actions */}
      {canAction && classeId && anneeId && (
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleGenerer}
            disabled={generer.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={{ background: "rgba(0,128,255,0.12)", border: "1px solid rgba(0,128,255,0.25)", color: "#0080FF" }}
          >
            {generer.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Générer / Recalculer
          </button>
          <button
            onClick={handleCalculerRangs}
            disabled={calcRangs.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
            style={{ background: "rgba(245,200,66,0.12)", border: "1px solid rgba(245,200,66,0.25)", color: "#F5C842" }}
          >
            {calcRangs.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Recalculer les rangs
          </button>
          {user?.role === "directeur" || user?.role === "dev" ? (
            <button
              onClick={handlePublierClasse}
              disabled={publierClasse.isPending || bulletins.filter(b => !b.publie).length === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
              style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.25)", color: "#00C9A7" }}
            >
              {publierClasse.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Publier tous ({bulletins.filter(b => !b.publie).length})
            </button>
          ) : null}
        </div>
      )}

      {/* Stats */}
      {stats && bulletins.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Élèves", value: stats.total, color: "var(--m15-white)", icon: <Users className="w-4 h-4" /> },
            { label: "Moy. classe", value: stats.moyenne_classe ? stats.moyenne_classe.toFixed(2) : "—", color: "#00C9A7", icon: <Award className="w-4 h-4" style={{ color: "#00C9A7" }} /> },
            { label: "≥ 10/20", value: stats.nb_au_dessus_10, color: "#00C9A7", icon: null },
            { label: "Publiés", value: `${nbPublies}/${stats.total}`, color: nbPublies === stats.total ? "#00C9A7" : "#F5C842", icon: null },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <div className="flex items-center gap-1.5 mb-1">
                {s.icon}
                <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{s.label}</p>
              </div>
              <p className="text-xl font-bold" style={{ color: s.color, fontFamily: "'Syne', sans-serif" }}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {classeId && anneeId ? (
        <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          {/* Header table */}
          <div className="grid grid-cols-12 gap-2 px-5 py-3 text-xs font-semibold uppercase" style={{ color: "var(--m15-muted)", background: "var(--elevate-1)", borderBottom: "1px solid var(--m15-border)" }}>
            <div className="col-span-1 text-center">Rang</div>
            <div className="col-span-4">Élève</div>
            <div className="col-span-2 text-center">Moyenne</div>
            <div className="col-span-2 text-center">Mention</div>
            <div className="col-span-2 text-center">Statut</div>
            <div className="col-span-1"></div>
          </div>

          {isLoading ? (
            <div className="p-5 space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : bulletins.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--m15-muted)" }} />
              <p style={{ color: "var(--m15-muted)" }}>Aucun bulletin généré pour cette sélection</p>
              {canAction && (
                <p className="text-sm mt-1" style={{ color: "var(--m15-muted)", opacity: 0.7 }}>
                  Cliquez sur « Générer / Recalculer » pour créer les bulletins
                </p>
              )}
            </div>
          ) : (
            bulletins.map((b, idx) => (
              <div
                key={b.id}
                className="grid grid-cols-12 gap-2 items-center px-5 py-3 cursor-pointer transition-all"
                style={{ borderTop: idx > 0 ? "1px solid var(--m15-border)" : undefined }}
                onClick={() => navigate(`/bulletins/${b.id}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ""; }}
              >
                <div className="col-span-1 text-center">
                  {b.rang !== null ? (
                    <span className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold mx-auto"
                      style={{
                        background: b.rang === 1 ? "rgba(245,200,66,0.2)" : "var(--elevate-2)",
                        color: b.rang === 1 ? "#F5C842" : "var(--m15-white)",
                        border: b.rang === 1 ? "1px solid rgba(245,200,66,0.4)" : "none",
                      }}>{b.rang}</span>
                  ) : <span style={{ color: "var(--m15-muted)" }}>—</span>}
                </div>
                <div className="col-span-4">
                  <p className="font-medium" style={{ color: "var(--m15-white)" }}>{b.eleve_nom?.toUpperCase()} {b.eleve_prenoms}</p>
                  <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{b.eleve_matricule}</p>
                </div>
                <div className="col-span-2 text-center">
                  <MoyBadge moy={b.moyenne_generale} />
                  {b.effectif_classe && <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>/{b.effectif_classe}</p>}
                </div>
                <div className="col-span-2 text-center">
                  {b.mention ? (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ background: `${MENTION_COLORS[b.mention]}22`, color: MENTION_COLORS[b.mention] }}>
                      {MENTION_LABELS[b.mention]}
                    </span>
                  ) : <span style={{ color: "var(--m15-muted)" }}>—</span>}
                </div>
                <div className="col-span-2 text-center">
                  <span className="px-2 py-0.5 rounded-lg text-xs font-semibold" style={{
                    background: b.publie ? "rgba(0,201,167,0.12)" : "rgba(245,200,66,0.12)",
                    color: b.publie ? "#00C9A7" : "#F5C842",
                  }}>
                    {b.publie ? "Publié" : "Brouillon"}
                  </span>
                </div>
                <div className="col-span-1 flex justify-end">
                  <Eye className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="rounded-2xl p-10 text-center" style={{ background: "var(--m15-card)", border: "1px dashed var(--m15-border)" }}>
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
          <p style={{ color: "var(--m15-muted)" }}>Sélectionnez une classe, une année scolaire et un trimestre</p>
        </div>
      )}
    </div>
  );
}
