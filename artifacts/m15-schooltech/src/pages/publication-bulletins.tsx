import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  useListerClasses, getListerClassesQueryKey,
  useListerAnneesScolaires, getListerAnneesScolairesQueryKey,
  useGetBulletinsClasse, getGetBulletinsClasseQueryKey,
  usePublierBulletinsClasse,
  type AnneeScolaire as AnneeScolaireType,
  type Classe as ClasseType,
} from "@workspace/api-client-react";
import { useState } from "react";
import {
  CheckCircle2, Loader2, BookOpen, Users,
  Send, AlertCircle, CheckCheck, FileText,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────── */
type Classe = ClasseType & { niveau?: string };
type AnneeScolaire = AnneeScolaireType & { statut?: string };
type BulletinStats = {
  stats?: { total: number; nb_au_dessus_10: number; moyenne_classe: number | null };
  bulletins?: Array<{ publie: boolean }>;
};

/* ─── Carte classe avec statut ───────────────────────────── */
function ClasseCard({
  classe, anneeId, trimestre,
}: {
  classe: Classe;
  anneeId: string;
  trimestre: string;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const publierMut = usePublierBulletinsClasse();

  const bParams = { trimestre: trimestre as "1" | "2" | "3", annee_scolaire_id: anneeId };
  const qKey = getGetBulletinsClasseQueryKey(classe.id, bParams);

  const { data, isLoading } = useGetBulletinsClasse(classe.id, bParams, {
    query: { queryKey: qKey, enabled: !!anneeId && !!trimestre },
  });

  const d = data as BulletinStats | undefined;
  const bulletins = d?.bulletins ?? [];
  const stats = d?.stats;
  const total = stats?.total ?? bulletins.length;
  const nbPublies = bulletins.filter(b => b.publie).length;
  const nbNonPublies = total - nbPublies;
  const allPublished = total > 0 && nbPublies === total;
  const noneGenerated = total === 0 && !isLoading;
  const pct = total > 0 ? Math.round((nbPublies / total) * 100) : 0;

  function handlePublier() {
    publierMut.mutate(
      { data: { classe_id: classe.id, annee_scolaire_id: anneeId, trimestre: trimestre as "1" | "2" | "3" } },
      {
        onSuccess: (res) => {
          const r = res as { publies: number; erreurs: unknown[] };
          if (r.publies > 0) {
            toast({ title: `${r.publies} bulletin(s) publié(s) — ${classe.nom}` });
          }
          if (r.erreurs.length > 0) {
            toast({
              title: `${r.erreurs.length} bulletin(s) incomplet(s) dans ${classe.nom}`,
              description: "Vérifiez les moyennes et rangs.",
              variant: "destructive",
            });
          }
          void qc.invalidateQueries({ queryKey: qKey });
        },
        onError: () => toast({ title: "Erreur de publication.", variant: "destructive" }),
      }
    );
  }

  const borderColor = allPublished ? "#00C9A7" : noneGenerated ? "var(--m15-border)" : "#F5C842";
  const statusColor = allPublished ? "#00C9A7" : noneGenerated ? "var(--m15-muted)" : "#F5C842";

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4 transition-all"
      style={{ background: "var(--m15-card)", border: `1px solid ${borderColor}` }}>

      {/* Nom classe */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(0,128,255,0.1)", border: "1px solid rgba(0,128,255,0.2)" }}>
            <BookOpen className="w-4 h-4" style={{ color: "#0080FF" }} />
          </div>
          <div>
            <p className="font-extrabold text-sm" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              {classe.nom}
            </p>
            {classe.niveau && (
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{classe.niveau}</p>
            )}
          </div>
        </div>

        {/* Badge statut */}
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" style={{ color: "var(--m15-muted)" }} />
        ) : allPublished ? (
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
            style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
            <CheckCheck className="w-3 h-3" />Tout publié
          </span>
        ) : noneGenerated ? (
          <span className="text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
            style={{ background: "var(--m15-navy)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
            Non généré
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold flex-shrink-0"
            style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.2)" }}>
            <AlertCircle className="w-3 h-3" />{nbNonPublies} en attente
          </span>
        )}
      </div>

      {/* Stats & barre progression */}
      {!noneGenerated && !isLoading && total > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--m15-muted)" }}>
            <span className="flex items-center gap-1.5">
              <Users className="w-3 h-3" />{total} élève{total > 1 ? "s" : ""}
            </span>
            <span style={{ color: statusColor }}>{nbPublies}/{total} publiés</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--m15-border)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: allPublished ? "#00C9A7" : "#F5C842" }} />
          </div>
          {stats?.moyenne_classe != null && (
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
              Moy. classe : <span style={{ color: stats.moyenne_classe >= 10 ? "#00C9A7" : "#FF4D6D", fontWeight: 700 }}>
                {stats.moyenne_classe.toFixed(2)}/20
              </span>
            </p>
          )}
        </div>
      )}

      {/* Bouton publier */}
      {!allPublished && !noneGenerated && nbNonPublies > 0 && (
        <button
          onClick={handlePublier}
          disabled={publierMut.isPending}
          className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all w-full"
          style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
          {publierMut.isPending
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <Send className="w-4 h-4" />}
          Publier {nbNonPublies} bulletin{nbNonPublies > 1 ? "s" : ""}
        </button>
      )}

      {allPublished && (
        <div className="flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(0,201,167,0.08)", color: "#00C9A7" }}>
          <CheckCircle2 className="w-4 h-4" />Résultats visibles par les élèves
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────── */
export default function PublicationBulletins() {
  const { user } = useAuth();
  const etablissementId = user?.etablissement_id ?? "";

  const [anneeId, setAnneeId] = useState("");
  const [trimestre, setTrimestre] = useState("1");

  const { data: anneesData } = useListerAnneesScolaires({
    query: { queryKey: getListerAnneesScolairesQueryKey() },
  });
  const annees: AnneeScolaire[] = (anneesData?.annees as AnneeScolaire[] | undefined) ?? [];

  const { data: classesData, isLoading: classesLoading } = useListerClasses(
    {},
    { query: { queryKey: getListerClassesQueryKey() } }
  );
  const classes: Classe[] = (classesData?.classes as Classe[] | undefined) ?? [];

  // Initialiser l'année active automatiquement
  const anneeActive = annees.find(a => a.statut === "en_cours") ?? annees[0];
  const effectiveAnneeId = anneeId || anneeActive?.id || "";

  return (
    <div className="max-w-6xl mx-auto space-y-6 page-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            Publication des résultats
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Publiez les bulletins trimestriels — ils deviennent visibles aux élèves et parents
          </p>
        </div>
      </div>

      {/* Sélecteurs */}
      <div className="rounded-2xl p-5 grid grid-cols-1 sm:grid-cols-2 gap-4"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>
            Année scolaire
          </label>
          <select
            value={effectiveAnneeId}
            onChange={e => setAnneeId(e.target.value)}
            className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
            style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            {annees.map(a => (
              <option key={a.id} value={a.id}>{a.libelle}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>
            Trimestre
          </label>
          <div className="flex gap-2">
            {[
              { val: "1", label: "Trimestre 1" },
              { val: "2", label: "Trimestre 2" },
              { val: "3", label: "Trimestre 3" },
            ].map(t => (
              <button
                key={t.val}
                onClick={() => setTrimestre(t.val)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: trimestre === t.val ? "linear-gradient(135deg, #00C9A7, #0080FF)" : "var(--m15-navy)",
                  color: trimestre === t.val ? "#fff" : "var(--m15-muted)",
                  border: trimestre === t.val ? "none" : "1px solid var(--m15-border)",
                }}>
                T{t.val}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Note d'information */}
      <div className="rounded-2xl p-4 flex items-start gap-3"
        style={{ background: "rgba(245,200,66,0.06)", border: "1px solid rgba(245,200,66,0.2)" }}>
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#F5C842" }} />
        <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
          <span style={{ color: "#F5C842", fontWeight: 600 }}>Avant de publier</span> : assurez-vous que les bulletins ont été générés et que les rangs ont été calculés dans la page Bulletins. Une fois publiés, les résultats sont immédiatement visibles par les élèves et leurs parents.
        </p>
      </div>

      {/* Grille des classes */}
      {classesLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#00C9A7" }} />
        </div>
      ) : classes.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--m15-card)", border: "2px dashed var(--m15-border)" }}>
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: "var(--m15-muted)" }} />
          <p style={{ color: "var(--m15-white)", fontWeight: 600 }}>Aucune classe trouvée</p>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>Créez des classes dans la section Académique.</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>
              {classes.length} classe{classes.length > 1 ? "s" : ""} — Trimestre {trimestre}
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map(c => (
              <ClasseCard
                key={c.id}
                classe={c}
                anneeId={effectiveAnneeId}
                trimestre={trimestre}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
