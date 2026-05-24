import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetParentDashboard, getGetParentDashboardQueryKey,
  useGetBulletinsEleve, getGetBulletinsEleveQueryKey,
  useListerAnneesScolaires, getListerAnneesScolairesQueryKey,
} from "@workspace/api-client-react";
import {
  FileText, Award, TrendingUp, ChevronRight,
  Printer, Users, Star,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── Types ──────────────────────────────────────────────── */
type Enfant = {
  eleve_id: string;
  nom: string;
  prenoms: string;
  classe_nom?: string;
  moyenne_generale?: number | null;
  bulletins_disponibles?: number;
};
type BulletinItem = {
  id: string;
  trimestre: string;
  classe_nom?: string;
  annee_scolaire_libelle?: string;
  moyenne_generale: number | null;
  rang: number | null;
  effectif_classe: number | null;
  mention: string | null;
  publie: boolean;
  date_publication: string | null;
};
type AnneeScolaire = { id: string; libelle: string; est_active?: boolean };

/* ─── Config ─────────────────────────────────────────────── */
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
const TRIMESTRE_LABELS: Record<string, string> = {
  "1": "1er Trimestre",
  "2": "2ème Trimestre",
  "3": "3ème Trimestre",
};

/* ─── Composant bulletin card ────────────────────────────── */
function BulletinCard({ b, onDetail, onPrint }: { b: BulletinItem; onDetail: () => void; onPrint: () => void }) {
  const moy = b.moyenne_generale;
  const moyColor = moy === null ? "var(--m15-muted)" : moy >= 14 ? "#00C9A7" : moy >= 10 ? "#F5C842" : "#FF4D6D";
  const mention = b.mention ? MENTION_COLORS[b.mention] : "var(--m15-muted)";

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-4 transition-all cursor-pointer"
      style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}
      onClick={onDetail}>

      {/* Header : trimestre + date */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,128,255,0.1)", border: "1px solid rgba(0,128,255,0.2)" }}>
            <FileText className="w-4 h-4" style={{ color: "#0080FF" }} />
          </div>
          <div>
            <p className="font-extrabold text-sm" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              {TRIMESTRE_LABELS[b.trimestre] ?? `Trimestre ${b.trimestre}`}
            </p>
            {b.annee_scolaire_libelle && (
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{b.annee_scolaire_libelle}</p>
            )}
          </div>
        </div>
        {b.date_publication && (
          <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
            Publié le {new Date(b.date_publication).toLocaleDateString("fr-FR")}
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {/* Moyenne */}
        <div className="rounded-xl p-3 text-center"
          style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)" }}>
          <p className="text-xl font-extrabold" style={{ color: moyColor, fontFamily: "'Syne', sans-serif" }}>
            {moy !== null ? moy.toFixed(2) : "—"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>Moyenne</p>
        </div>

        {/* Rang */}
        <div className="rounded-xl p-3 text-center"
          style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)" }}>
          <p className="text-xl font-extrabold" style={{ color: b.rang === 1 ? "#F5C842" : "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            {b.rang !== null ? `${b.rang}` : "—"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>
            {b.effectif_classe ? `Rang /${b.effectif_classe}` : "Rang"}
          </p>
        </div>

        {/* Mention */}
        <div className="rounded-xl p-3 text-center"
          style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)" }}>
          {b.mention ? (
            <>
              <Star className="w-5 h-5 mx-auto" style={{ color: mention }} />
              <p className="text-xs mt-0.5 font-semibold" style={{ color: mention }}>
                {MENTION_LABELS[b.mention]}
              </p>
            </>
          ) : (
            <p className="text-xl font-extrabold" style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>—</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2" style={{ borderTop: "1px solid var(--m15-border)", paddingTop: "0.75rem" }}>
        <button
          onClick={e => { e.stopPropagation(); onDetail(); }}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold"
          style={{ background: "rgba(0,128,255,0.08)", color: "#0080FF", border: "1px solid rgba(0,128,255,0.2)" }}>
          <ChevronRight className="w-3.5 h-3.5" />Voir le détail
        </button>
        <button
          onClick={e => { e.stopPropagation(); onPrint(); }}
          className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
          style={{ background: "rgba(0,201,167,0.08)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
          <Printer className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/* ─── Onglet enfant — bulletins ──────────────────────────── */
function EnfantBulletins({ enfant, anneeId }: { enfant: Enfant; anneeId: string }) {
  const [, navigate] = useLocation();
  const eleveId = enfant.eleve_id;
  const params = anneeId ? { annee_scolaire_id: anneeId } : {};

  const { data, isLoading } = useGetBulletinsEleve(
    eleveId,
    params,
    { query: { queryKey: getGetBulletinsEleveQueryKey(eleveId, params), enabled: !!eleveId } }
  );

  const bulletins: BulletinItem[] =
    ((data?.bulletins ?? []) as BulletinItem[])
      .filter(b => b.publie)
      .sort((a, b) => Number(a.trimestre) - Number(b.trimestre));

  function handleDetail(id: string) {
    navigate(`/bulletins/${id}`);
  }
  function handlePrint(id: string) {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    window.open(`${base}/api/bulletins/${id}/pdf`, "_blank");
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
      </div>
    );
  }

  if (bulletins.length === 0) {
    return (
      <div className="rounded-2xl p-12 text-center" style={{ background: "var(--m15-card)", border: "2px dashed var(--m15-border)" }}>
        <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: "var(--m15-muted)" }} />
        <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Aucun bulletin publié</p>
        <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
          Les résultats seront disponibles ici dès leur publication par l'établissement.
        </p>
      </div>
    );
  }

  // KPIs
  const meilleureNote = bulletins.reduce<number | null>(
    (best, b) => b.moyenne_generale === null ? best : best === null ? b.moyenne_generale : Math.max(best, b.moyenne_generale),
    null
  );
  const moyColor = meilleureNote === null ? "var(--m15-muted)" : meilleureNote >= 14 ? "#00C9A7" : meilleureNote >= 10 ? "#F5C842" : "#FF4D6D";

  return (
    <div className="space-y-5">
      {/* Mini KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Bulletins publiés", value: bulletins.length, color: "#0080FF" },
          { label: "Meilleure moyenne", value: meilleureNote !== null ? `${meilleureNote.toFixed(2)}/20` : "—", color: moyColor },
          { label: "Classe", value: enfant.classe_nom ?? "—", color: "var(--m15-white)" },
        ].map(k => (
          <div key={k.label} className="rounded-xl p-3" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <p className="text-lg font-extrabold truncate" style={{ color: k.color, fontFamily: "'Syne', sans-serif" }}>{k.value}</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Grille bulletins */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bulletins.map(b => (
          <BulletinCard
            key={b.id}
            b={b}
            onDetail={() => handleDetail(b.id)}
            onPrint={() => handlePrint(b.id)}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────── */
export default function BulletinsParent() {
  const [activeEnfant, setActiveEnfant] = useState(0);
  const [anneeId, setAnneeId] = useState("");

  const qk = getGetParentDashboardQueryKey();
  const { data, isLoading } = useGetParentDashboard({ query: { queryKey: qk, staleTime: 60_000 } });
  const enfants: Enfant[] = ((data as unknown as { enfants?: Enfant[] })?.enfants) ?? [];

  const { data: anneesData } = useListerAnneesScolaires({
    query: { queryKey: getListerAnneesScolairesQueryKey() },
  });
  const annees: AnneeScolaire[] = (anneesData?.annees as AnneeScolaire[] | undefined) ?? [];
  const anneeActive = annees.find(a => a.est_active) ?? annees[0];
  const effectiveAnneeId = anneeId || anneeActive?.id || "";

  const enfant = enfants[activeEnfant];

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-5">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!enfants.length) {
    return (
      <div className="max-w-5xl mx-auto rounded-2xl p-12 text-center"
        style={{ background: "var(--m15-card)", border: "2px dashed var(--m15-border)" }}>
        <Users className="w-12 h-12 mx-auto mb-4 opacity-40" style={{ color: "var(--m15-muted)" }} />
        <p className="font-bold text-lg" style={{ color: "var(--m15-white)" }}>Aucun enfant lié à votre compte</p>
        <p className="text-sm mt-2" style={{ color: "var(--m15-muted)" }}>
          Contactez l'établissement pour associer votre compte à vos enfants.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 page-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            Bulletins scolaires
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Consultez les résultats publiés de vos enfants
          </p>
        </div>
        {/* Filtre année */}
        <select
          value={effectiveAnneeId}
          onChange={e => setAnneeId(e.target.value)}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
          {annees.map(a => (
            <option key={a.id} value={a.id}>{a.libelle}</option>
          ))}
        </select>
      </div>

      {/* Sélecteur enfants */}
      {enfants.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {enfants.map((e, i) => {
            const selected = i === activeEnfant;
            const moy = e.moyenne_generale;
            const moyColor = moy == null ? "var(--m15-muted)" : moy >= 14 ? "#00C9A7" : moy >= 10 ? "#F5C842" : "#FF4D6D";
            return (
              <button
                key={e.eleve_id}
                onClick={() => setActiveEnfant(i)}
                className="flex items-center gap-3 px-4 py-3 rounded-2xl flex-shrink-0 transition-all"
                style={{
                  background: selected ? "linear-gradient(135deg, #0080FF22, #00C9A722)" : "var(--m15-card)",
                  border: `1px solid ${selected ? "#0080FF" : "var(--m15-border)"}`,
                }}>
                {/* Avatar */}
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                  style={{ background: selected ? "linear-gradient(135deg, #0080FF, #00C9A7)" : "var(--m15-navy)", color: selected ? "#fff" : "#00C9A7" }}>
                  {e.prenoms?.[0]}{e.nom?.[0]}
                </div>
                <div className="text-left">
                  <p className="font-semibold text-sm leading-tight" style={{ color: "var(--m15-white)" }}>
                    {e.prenoms} {e.nom}
                  </p>
                  {moy != null && (
                    <p className="text-xs font-bold" style={{ color: moyColor }}>
                      Moy. {Number(moy).toFixed(2)}/20
                    </p>
                  )}
                </div>
                {e.bulletins_disponibles != null && e.bulletins_disponibles > 0 && (
                  <span className="w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
                    style={{ background: "#0080FF", color: "#fff" }}>
                    {e.bulletins_disponibles}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Enfant sélectionné — nom + classe */}
      {enfant && (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold"
            style={{ background: "linear-gradient(135deg, #0080FF, #00C9A7)", color: "#fff" }}>
            {enfant.prenoms?.[0]}{enfant.nom?.[0]}
          </div>
          <div>
            <p className="font-extrabold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              {enfant.prenoms} {enfant.nom}
            </p>
            {enfant.classe_nom && (
              <p className="text-xs flex items-center gap-1" style={{ color: "var(--m15-muted)" }}>
                <Award className="w-3 h-3" />{enfant.classe_nom}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bulletins de l'enfant actif */}
      {enfant && (
        <EnfantBulletins enfant={enfant} anneeId={effectiveAnneeId} />
      )}

      {/* Mention légale */}
      <p className="text-xs text-center pb-2" style={{ color: "var(--m15-muted)", opacity: 0.6 }}>
        <TrendingUp className="w-3 h-3 inline mr-1" />
        Seuls les bulletins validés et publiés par l'établissement sont affichés.
      </p>
    </div>
  );
}
