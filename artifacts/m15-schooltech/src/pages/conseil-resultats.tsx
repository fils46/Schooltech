import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetConseil,
  useGetDeliberationsClasse,
  useGetConseilParticipants,
  useGenererPV,
  useSignerPV,
  getGetConseilQueryKey,
  getGetDeliberationsClasseQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, FileText, Download, PenLine, Loader2, Trophy,
  AlertCircle, CheckCircle2, Users, BarChart2, Calendar,
} from "lucide-react";

type ConseilItem = {
  id: string; classe_nom: string; trimestre: string; date_conseil: string;
  heure_debut?: string | null; statut: string; president_nom: string | null;
  pv_genere: boolean; pv_url?: string | null; pv_signe_par?: string | null; pv_date_signature?: string | null;
  observations_generales?: string | null;
};
type Deliberation = {
  id: string; eleve_id: string; eleve_nom: string; eleve_prenoms: string;
  moyenne_generale?: string | null; rang?: number | null; nb_absences: number;
  nb_absences_justifiees: number; decision?: string | null; mention_honneur: boolean;
  appreciation_generale?: string | null; observations?: string | null;
};
type Participant = {
  id: string; utilisateur_nom: string; utilisateur_prenoms: string;
  role_conseil: string; present: boolean;
};

const DECISION_OPTIONS: Record<string, { label: string; color: string; bg: string }> = {
  passage:       { label: "Passage",       color: "#00C9A7", bg: "rgba(0,201,167,0.12)" },
  redoublement:  { label: "Redoublement",  color: "#FF4D6D", bg: "rgba(255,77,109,0.12)" },
  exclusion:     { label: "Exclusion",     color: "#FF4D6D", bg: "rgba(255,77,109,0.12)" },
  orientation:   { label: "Orientation",   color: "#F5C842", bg: "rgba(245,200,66,0.12)" },
  felicitations: { label: "Félicitations", color: "#00C9A7", bg: "rgba(0,201,167,0.12)" },
  encouragements:{ label: "Encouragements",color: "#00C9A7", bg: "rgba(0,201,167,0.08)" },
  avertissement: { label: "Avertissement", color: "#F5C842", bg: "rgba(245,200,66,0.12)" },
  blame:         { label: "Blâme",         color: "#FF4D6D", bg: "rgba(255,77,109,0.12)" },
};

const ROLE_LABELS: Record<string, string> = {
  president: "Président", professeur: "Professeur", delegue_eleves: "Délégué élèves",
  delegue_parents: "Délégué parents", censeur: "Censeur", directeur: "Directeur",
};

export default function ConseilResultats() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: conseilData, isLoading: loadingConseil } = useGetConseil(id ?? "");
  const { data: deliberationsData, isLoading: loadingDelibs } = useGetDeliberationsClasse(id ?? "");
  const { data: participantsData } = useGetConseilParticipants(id ?? "");

  const genererPV = useGenererPV();
  const signerPV  = useSignerPV();

  const conseil: ConseilItem | null = (conseilData as { conseil?: ConseilItem })?.conseil ?? null;
  const deliberations: Deliberation[] = (deliberationsData as { deliberations?: Deliberation[] })?.deliberations ?? [];
  const participants: Participant[]   = (participantsData as { participants?: Participant[] })?.participants ?? [];

  const invalidateConseil = () => qc.invalidateQueries({ queryKey: getGetConseilQueryKey(id ?? "") });
  const invalidateDelibs  = () => qc.invalidateQueries({ queryKey: getGetDeliberationsClasseQueryKey(id ?? "") });

  function handleGenererPV() {
    if (!id) return;
    genererPV.mutate({ id }, {
      onSuccess: (data) => {
        const d = data as { pv_url?: string };
        toast({ title: "PV généré avec succès." });
        invalidateConseil();
      },
      onError: () => toast({ title: "Erreur lors de la génération du PV.", variant: "destructive" }),
    });
  }

  function handleSignerPV() {
    if (!id) return;
    signerPV.mutate({ id }, {
      onSuccess: () => {
        toast({ title: "PV signé." });
        invalidateConseil();
      },
      onError: () => toast({ title: "Erreur lors de la signature.", variant: "destructive" }),
    });
  }

  const canAdmin = ["dev","directeur","censeur"].includes(user?.role ?? "");
  const sortedDelibs = [...deliberations].sort((a, b) => (a.rang ?? 999) - (b.rang ?? 999));

  /* Stats décisions */
  const statsDecisions: Record<string, number> = {};
  deliberations.forEach(d => { if (d.decision) statsDecisions[d.decision] = (statsDecisions[d.decision] ?? 0) + 1; });
  const mentionHonneurCount = deliberations.filter(d => d.mention_honneur).length;

  if (loadingConseil || loadingDelibs) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (!conseil) {
    return (
      <div className="max-w-xl mx-auto text-center p-12 rounded-2xl" style={{ background: "var(--m15-card)", border: "1px dashed var(--m15-border)" }}>
        <AlertCircle className="w-10 h-10 mx-auto mb-3 text-red-400" />
        <p style={{ color: "var(--m15-muted)" }}>Conseil introuvable.</p>
        <button onClick={() => setLocation("/conseils-classe")} className="mt-4 px-4 py-2 rounded-xl text-sm"
          style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>Retour</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/conseils-classe")}
            className="w-9 h-9 flex items-center justify-center rounded-xl"
            style={{ background: "var(--elevate-2)", color: "var(--m15-muted)" }}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Résultats — {conseil.classe_nom} · T{conseil.trimestre}
            </h2>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
              <Calendar className="w-3 h-3 inline mr-1" />{conseil.date_conseil}
              {conseil.heure_debut && ` · ${conseil.heure_debut}`} · Président : {conseil.president_nom ?? "—"}
            </p>
          </div>
        </div>

        {/* Actions PV */}
        {canAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            {conseil.statut === "termine" && !conseil.pv_genere && (
              <button onClick={handleGenererPV} disabled={genererPV.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(0,128,255,0.15)", border: "1px solid rgba(0,128,255,0.3)", color: "#0080FF" }}>
                {genererPV.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Générer le PV
              </button>
            )}
            {conseil.pv_genere && conseil.pv_url && (
              <a href={conseil.pv_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(0,201,167,0.15)", border: "1px solid rgba(0,201,167,0.3)", color: "#00C9A7" }}>
                <Download className="w-4 h-4" /> Télécharger le PV
              </a>
            )}
            {conseil.pv_genere && !conseil.pv_signe_par && (
              <button onClick={handleSignerPV} disabled={signerPV.isPending}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "rgba(245,200,66,0.15)", border: "1px solid rgba(245,200,66,0.3)", color: "#F5C842" }}>
                {signerPV.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <PenLine className="w-4 h-4" />}
                Signer le PV
              </button>
            )}
            {conseil.pv_signe_par && (
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm"
                style={{ background: "rgba(0,201,167,0.08)", border: "1px solid rgba(0,201,167,0.2)" }}>
                <CheckCircle2 className="w-4 h-4" style={{ color: "#00C9A7" }} />
                <span style={{ color: "#00C9A7" }}>Signé le {conseil.pv_date_signature}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <p className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>Élèves délibérés</p>
          <p className="text-2xl font-bold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>{deliberations.length}</p>
        </div>
        {mentionHonneurCount > 0 && (
          <div className="rounded-xl p-4" style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.2)" }}>
            <p className="text-xs mb-1" style={{ color: "#F5C842" }}>Mentions d'honneur</p>
            <p className="text-2xl font-bold" style={{ color: "#F5C842", fontFamily: "'Syne', sans-serif" }}>{mentionHonneurCount}</p>
          </div>
        )}
        {Object.entries(statsDecisions).slice(0, 2).map(([dec, count]) => {
          const conf = DECISION_OPTIONS[dec];
          return (
            <div key={dec} className="rounded-xl p-4" style={{ background: conf?.bg ?? "var(--m15-card)", border: `1px solid ${conf?.color ?? "var(--m15-border)"}30` }}>
              <p className="text-xs mb-1" style={{ color: conf?.color ?? "var(--m15-muted)" }}>{conf?.label ?? dec}</p>
              <p className="text-2xl font-bold" style={{ color: conf?.color ?? "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>{count}</p>
            </div>
          );
        })}
      </div>

      {/* Récap décisions */}
      {Object.keys(statsDecisions).length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 className="w-4 h-4" style={{ color: "#00C9A7" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>Récapitulatif des décisions</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(statsDecisions).map(([dec, count]) => {
              const conf = DECISION_OPTIONS[dec];
              return (
                <div key={dec} className="flex items-center gap-2 px-4 py-2 rounded-xl"
                  style={{ background: conf?.bg ?? "var(--elevate-2)", border: `1px solid ${conf?.color ?? "var(--m15-border)"}40` }}>
                  <span className="text-2xl font-bold" style={{ color: conf?.color ?? "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>{count}</span>
                  <span className="text-sm" style={{ color: conf?.color ?? "var(--m15-muted)" }}>{conf?.label ?? dec}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tableau des délibérations */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-2 p-4 border-b" style={{ borderColor: "var(--m15-border)" }}>
          <Trophy className="w-4 h-4" style={{ color: "#F5C842" }} />
          <span className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>Délibérations ({sortedDelibs.length})</span>
        </div>
        {sortedDelibs.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
            <p style={{ color: "var(--m15-muted)" }}>Aucune délibération enregistrée.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--elevate-1)" }}>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>Rg</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>Élève</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>Moy.</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>Abs.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>Décision</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>Appréciation</th>
                </tr>
              </thead>
              <tbody>
                {sortedDelibs.map((d, i) => {
                  const decConf = d.decision ? DECISION_OPTIONS[d.decision] : null;
                  return (
                    <tr key={d.eleve_id} className="border-t" style={{ borderColor: "var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                      <td className="px-4 py-3 font-bold text-sm" style={{ color: d.rang != null ? "#F5C842" : "var(--m15-muted)" }}>
                        {d.rang != null ? `#${d.rang}` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: "var(--m15-white)" }}>
                          {d.eleve_prenoms} {d.eleve_nom}
                          {d.mention_honneur && <span className="ml-1.5 text-xs" style={{ color: "#F5C842" }}>★ Mention d'honneur</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium" style={{ color: "var(--m15-white)" }}>
                        {d.moyenne_generale != null ? Number(d.moyenne_generale).toFixed(2) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right" style={{ color: d.nb_absences > 0 ? "#FF4D6D" : "var(--m15-muted)" }}>
                        {d.nb_absences}
                      </td>
                      <td className="px-4 py-3">
                        {decConf ? (
                          <span className="px-2 py-1 rounded-lg text-xs font-semibold" style={{ background: decConf.bg, color: decConf.color }}>
                            {decConf.label}
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "var(--m15-muted)", opacity: 0.5 }}>Non saisi</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-xs truncate" style={{ color: "var(--m15-muted)" }}>
                          {d.appreciation_generale ?? d.observations ?? "—"}
                        </p>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Observations générales */}
      {conseil.observations_generales && (
        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <p className="text-xs font-semibold mb-2" style={{ color: "var(--m15-muted)" }}>OBSERVATIONS GÉNÉRALES</p>
          <p className="text-sm italic" style={{ color: "var(--m15-white)" }}>{conseil.observations_generales}</p>
        </div>
      )}

      {/* Présences */}
      {participants.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />
            <span className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>
              Participants ({participants.filter(p => p.present).length} présents / {participants.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: p.present ? "rgba(0,201,167,0.08)" : "var(--elevate-2)", border: `1px solid ${p.present ? "rgba(0,201,167,0.2)" : "var(--m15-border)"}` }}>
                {p.present
                  ? <CheckCircle2 className="w-3.5 h-3.5" style={{ color: "#00C9A7" }} />
                  : <div className="w-3.5 h-3.5 rounded-full border" style={{ borderColor: "var(--m15-muted)" }} />}
                <span className="text-xs font-medium" style={{ color: p.present ? "var(--m15-white)" : "var(--m15-muted)" }}>
                  {p.utilisateur_prenoms} {p.utilisateur_nom}
                </span>
                <span className="text-xs" style={{ color: "var(--m15-muted)", opacity: 0.7 }}>
                  {ROLE_LABELS[p.role_conseil] ?? p.role_conseil}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
