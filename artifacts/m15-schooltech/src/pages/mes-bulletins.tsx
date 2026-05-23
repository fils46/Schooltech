import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetBulletinsEleve,
  useListerAnneesScolaires,
  getGetBulletinsEleveQueryKey,
  type GetBulletinsEleveParams,
} from "@workspace/api-client-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, Award, TrendingUp, Printer, Eye, ChevronRight } from "lucide-react";

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
  trimestre: string;
  classe_nom: string;
  annee_scolaire_libelle: string;
  moyenne_generale: number | null;
  rang: number | null;
  effectif_classe: number | null;
  mention: string | null;
  publie: boolean;
  date_publication: string | null;
  details: unknown[];
};

type AnneeScolaire = { id: string; libelle: string };

export default function MesBulletins() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const [anneeId, setAnneeId] = useState("");

  const { data: anneesData } = useListerAnneesScolaires();
  const annees: AnneeScolaire[] = (anneesData as { annees?: AnneeScolaire[] })?.annees ?? [];

  const eleveId = user?.id ?? "";

  const eleveParams: GetBulletinsEleveParams = anneeId ? { annee_scolaire_id: anneeId } : {};
  const { data: bData, isLoading } = useGetBulletinsEleve(
    eleveId || "skip",
    eleveParams,
    { query: { queryKey: getGetBulletinsEleveQueryKey(eleveId, eleveParams), enabled: !!eleveId } }
  );

  const bulletins: BulletinItem[] = ((bData as { bulletins?: BulletinItem[] })?.bulletins ?? []).sort(
    (a, b) => Number(a.trimestre) - Number(b.trimestre)
  );

  function handleImprimer(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.open(`${baseUrl}/api/bulletins/${id}/pdf`, "_blank");
  }

  const nbPublies = bulletins.filter(b => b.publie).length;
  const meilleureNote = bulletins.reduce<number | null>((best, b) => {
    if (b.moyenne_generale === null) return best;
    return best === null ? b.moyenne_generale : Math.max(best, b.moyenne_generale);
  }, null);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.25)" }}>
          <FileText className="w-5 h-5" style={{ color: "#00C9A7" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>Mes Bulletins</h2>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Consultez vos bulletins scolaires</p>
        </div>
      </div>

      {/* Filtre année */}
      <div className="rounded-2xl p-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="max-w-xs">
          <Label className="text-xs mb-1 block" style={{ color: "var(--m15-muted)" }}>Année scolaire</Label>
          <Select value={anneeId || "__all__"} onValueChange={v => setAnneeId(v === "__all__" ? "" : v)}>
            <SelectTrigger style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Toutes les années" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Toutes les années</SelectItem>
              {annees.map(a => <SelectItem key={a.id} value={a.id}>{a.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      {bulletins.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl p-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>Bulletins publiés</p>
            <p className="text-2xl font-bold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>{nbPublies}</p>
          </div>
          <div className="rounded-xl p-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>Meilleure moyenne</p>
            <p className="text-2xl font-bold" style={{ color: "#00C9A7", fontFamily: "'Syne', sans-serif" }}>
              {meilleureNote !== null ? `${meilleureNote.toFixed(2)}/20` : "—"}
            </p>
          </div>
          <div className="rounded-xl p-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>Trimestres</p>
            <p className="text-2xl font-bold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>{bulletins.length}</p>
          </div>
        </div>
      )}

      {/* Liste bulletins */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
        </div>
      ) : bulletins.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--m15-card)", border: "1px dashed var(--m15-border)" }}>
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
          <p style={{ color: "var(--m15-muted)" }}>Aucun bulletin disponible</p>
          {!nbPublies && <p className="text-sm mt-1" style={{ color: "var(--m15-muted)", opacity: 0.7 }}>Vos bulletins apparaîtront ici une fois publiés par la direction</p>}
        </div>
      ) : (
        <div className="space-y-4">
          {bulletins.map(b => {
            const mention = b.mention ? MENTION_LABELS[b.mention] : null;
            const mentionColor = b.mention ? MENTION_COLORS[b.mention] : "#8B9DC3";
            return (
              <div
                key={b.id}
                className="rounded-2xl p-5 cursor-pointer transition-all"
                style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}
                onClick={() => navigate(`/bulletins/${b.id}`)}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(0,201,167,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--m15-border)"; }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg" style={{
                        background: "rgba(0,128,255,0.12)",
                        border: "1px solid rgba(0,128,255,0.25)",
                        color: "#0080FF",
                        fontFamily: "'Syne', sans-serif",
                      }}>T{b.trimestre}</div>
                      <div>
                        <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Trimestre {b.trimestre}</p>
                        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{b.classe_nom} • {b.annee_scolaire_libelle}</p>
                      </div>
                      <span className="ml-auto px-2 py-0.5 rounded-lg text-xs font-semibold" style={{
                        background: b.publie ? "rgba(0,201,167,0.12)" : "rgba(245,200,66,0.12)",
                        color: b.publie ? "#00C9A7" : "#F5C842",
                      }}>
                        {b.publie ? "Publié" : "En attente"}
                      </span>
                    </div>

                    {b.publie ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-xl p-3 text-center" style={{ background: "var(--elevate-1)" }}>
                          <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>Moyenne</p>
                          <p className="text-xl font-bold" style={{
                            color: b.moyenne_generale !== null ? (b.moyenne_generale >= 10 ? "#00C9A7" : "#FF4D6D") : "var(--m15-muted)",
                            fontFamily: "'Syne', sans-serif",
                          }}>
                            {b.moyenne_generale !== null ? `${b.moyenne_generale.toFixed(2)}/20` : "—"}
                          </p>
                        </div>
                        <div className="rounded-xl p-3 text-center" style={{ background: "var(--elevate-1)" }}>
                          <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>Rang</p>
                          <p className="text-xl font-bold" style={{ color: "#F5C842", fontFamily: "'Syne', sans-serif" }}>
                            {b.rang !== null ? `${b.rang}${b.rang === 1 ? "er" : "ème"}` : "—"}
                            {b.effectif_classe && <span className="text-sm font-normal" style={{ color: "var(--m15-muted)" }}>/{b.effectif_classe}</span>}
                          </p>
                        </div>
                        <div className="rounded-xl p-3 text-center" style={{ background: "var(--elevate-1)" }}>
                          <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>Mention</p>
                          {mention ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: `${mentionColor}22`, color: mentionColor }}>
                              {mention}
                            </span>
                          ) : <p className="text-xl font-bold" style={{ color: "var(--m15-muted)" }}>—</p>}
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
                        Ce bulletin n'est pas encore publié par la direction.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 ml-2">
                    {b.publie && (
                      <button
                        onClick={e => handleImprimer(b.id, e)}
                        className="w-9 h-9 flex items-center justify-center rounded-xl"
                        style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}
                        title="Imprimer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    )}
                    <button className="w-9 h-9 flex items-center justify-center rounded-xl" style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
