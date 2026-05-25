import { useState } from "react";
import { useParams, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetClasseDetail, getGetClasseDetailQueryKey,
  useAffecterEleve, useRetirerEleve,
  useAffecterProfesseur, useRetirerProfesseur,
  useListerEleves, getListerElevesQueryKey,
  useListerUtilisateurs, getListerUtilisateursQueryKey,
  useListerAnneesScolaires, getListerAnneesScolairesQueryKey,
  useGetStatistiquesClasse, getGetStatistiquesClasseQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronLeft, GraduationCap, UserSquare, BarChart3,
  Plus, Trash2, Users, BookOpen, TrendingUp,
} from "lucide-react";

/* ─── Helpers ─────────────────────────────────────────────── */
const NIVEAU_COLORS: Record<string, string> = {
  "6ème": "#00C9A7", "5ème": "#0080FF", "4ème": "#A78BFA",
  "3ème": "#F472B6", "2nde": "#F5C842", "1ère": "#FF8C42", "Terminale": "#FF4D6D",
};

function TabButton({
  active, onClick, icon: Icon, label, count,
}: {
  active: boolean; onClick: () => void; icon: React.ElementType; label: string; count?: number;
}) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150"
      style={{
        background: active ? "rgba(0,201,167,0.15)" : "transparent",
        color: active ? "#00C9A7" : "var(--m15-muted)",
        border: active ? "1px solid rgba(0,201,167,0.3)" : "1px solid transparent",
      }}>
      <Icon className="w-4 h-4" />
      {label}
      {count != null && (
        <span className="px-2 py-0.5 rounded-full text-xs"
          style={{ background: active ? "rgba(0,201,167,0.2)" : "var(--elevate-1)", color: active ? "#00C9A7" : "var(--m15-muted)" }}>
          {count}
        </span>
      )}
    </button>
  );
}

/* ─── Modal affecter élève ────────────────────────────────── */
function ModalAffecterEleve({
  classeId, onClose,
}: { classeId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const affecterMut = useAffecterEleve();

  const { data: elevesData } = useListerEleves(
    { limit: 200, page: 1 },
    { query: { queryKey: getListerElevesQueryKey({ limit: 200, page: 1 }) } }
  );

  const [eleveId, setEleveId] = useState("");

  const submit = async () => {
    if (!eleveId) {
      toast({ title: "Sélectionnez un élève.", variant: "destructive" }); return;
    }
    try {
      await affecterMut.mutateAsync({ id: classeId, data: { eleve_id: eleveId } });
      await qc.invalidateQueries({ queryKey: getGetClasseDetailQueryKey(classeId) });
      await qc.invalidateQueries({ queryKey: getListerElevesQueryKey() });
      toast({ title: "Élève affecté avec succès." });
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : "Erreur lors de l'affectation.");
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Affecter un élève
        </h2>
        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
          L'élève sera affecté à l'année scolaire actuellement active.
        </p>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Élève</label>
          <select value={eleveId} onChange={e => setEleveId(e.target.value)}
            className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            <option value="">Sélectionner un élève...</option>
            {(elevesData?.eleves ?? []).map(el => (
              <option key={el.id} value={el.id}>{el.prenoms} {el.nom}{el.matricule ? ` — ${el.matricule}` : ""}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)" }}>Annuler</button>
          <button onClick={submit} disabled={affecterMut.isPending || !eleveId}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: eleveId ? "#00C9A7" : "rgba(0,201,167,0.3)", color: "#fff" }}>
            {affecterMut.isPending ? "Affectation..." : "Affecter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Modal affecter professeur ───────────────────────────── */
function ModalAffecterProfesseur({
  classeId, onClose,
}: { classeId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const affecterMut = useAffecterProfesseur();

  const { data: annees } = useListerAnneesScolaires({
    query: { queryKey: getListerAnneesScolairesQueryKey() },
  });
  const { data: profsListe } = useListerUtilisateurs(
    { role: "professeur" },
    { query: { queryKey: getListerUtilisateursQueryKey({ role: "professeur" }) } }
  );

  const [profId, setProfId]             = useState("");
  const [matiere, setMatiere]           = useState("");
  const [anneeScolaireId, setAnneeId]   = useState(
    annees?.annees?.find(a => a.est_active)?.id ?? ""
  );

  const submit = async () => {
    if (!profId || !matiere.trim() || !anneeScolaireId) {
      toast({ title: "Remplissez tous les champs.", variant: "destructive" }); return;
    }
    try {
      await affecterMut.mutateAsync({
        id: classeId,
        data: { professeur_id: profId, matiere: matiere.trim(), annee_scolaire_id: anneeScolaireId },
      });
      await qc.invalidateQueries({ queryKey: getGetClasseDetailQueryKey(classeId) });
      toast({ title: "Professeur affecté" });
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'affectation.";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <h2 className="text-lg font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Affecter un professeur
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Année scolaire</label>
            <select value={anneeScolaireId} onChange={e => setAnneeId(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <option value="">Sélectionner...</option>
              {(annees?.annees ?? []).map(a => (
                <option key={a.id} value={a.id}>{a.libelle}{a.est_active ? " (en cours)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Professeur</label>
            <select value={profId} onChange={e => setProfId(e.target.value)}
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <option value="">Sélectionner...</option>
              {(profsListe ?? []).map(p => (
                <option key={p.id} value={p.id}>{p.prenoms} {p.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Matière</label>
            <input value={matiere} onChange={e => setMatiere(e.target.value)}
              placeholder="ex : Mathématiques"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
            style={{ background: "var(--m15-card2)", color: "var(--m15-muted)" }}>Annuler</button>
          <button onClick={submit} disabled={affecterMut.isPending}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#0080FF", color: "#fff" }}>
            {affecterMut.isPending ? "Affectation..." : "Affecter"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Onglet Statistiques ─────────────────────────────────── */
function OngletStats({ classeId }: { classeId: string }) {
  const { data: stats, isLoading } = useGetStatistiquesClasse(classeId, {
    query: { queryKey: getGetStatistiquesClasseQueryKey(classeId) },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--m15-card)" }} />)}
      </div>
    );
  }

  if (!stats) return null;

  const tauxColor = stats.taux_remplissage >= 100 ? "#FF4D6D" : stats.taux_remplissage >= 80 ? "#F5C842" : "#00C9A7";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total élèves",  value: stats.nb_eleves,    color: "#00C9A7", icon: Users },
          { label: "Garçons",       value: stats.nb_garcons,   color: "#0080FF", icon: UserSquare },
          { label: "Filles",        value: stats.nb_filles,    color: "#F472B6", icon: UserSquare },
          { label: "Capacité max",  value: stats.capacite_max, color: "#A78BFA", icon: BookOpen },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-5 flex flex-col gap-2"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", borderTop: `3px solid ${color}` }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>{label}</span>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
            </div>
            <span className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Taux de remplissage */}
      <div className="rounded-2xl p-6" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" style={{ color: tauxColor }} />
            <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Taux de remplissage
            </h3>
          </div>
          <span className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: tauxColor }}>
            {stats.taux_remplissage}%
          </span>
        </div>
        <div className="w-full h-4 rounded-full overflow-hidden" style={{ background: "var(--m15-card2)" }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(stats.taux_remplissage, 100)}%`, background: tauxColor }} />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs" style={{ color: "var(--m15-muted)" }}>{stats.nb_eleves} élèves</span>
          <span className="text-xs" style={{ color: "var(--m15-muted)" }}>/ {stats.capacite_max} places</span>
        </div>
      </div>

      {/* Répartition garçons / filles */}
      {stats.nb_eleves > 0 && (
        <div className="rounded-2xl p-6" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <h3 className="font-bold mb-4" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Répartition par genre
          </h3>
          <div className="flex h-5 rounded-full overflow-hidden gap-0.5">
            <div style={{ width: `${Math.round((stats.nb_garcons / stats.nb_eleves) * 100)}%`, background: "#0080FF" }} className="rounded-l-full transition-all duration-700" />
            <div style={{ width: `${Math.round((stats.nb_filles / stats.nb_eleves) * 100)}%`, background: "#F472B6" }} className="rounded-r-full transition-all duration-700" />
          </div>
          <div className="flex gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: "#0080FF" }} />
              <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
                Garçons : {stats.nb_garcons} ({Math.round((stats.nb_garcons / stats.nb_eleves) * 100)}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ background: "#F472B6" }} />
              <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
                Filles : {stats.nb_filles} ({Math.round((stats.nb_filles / stats.nb_eleves) * 100)}%)
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ─────────────────────────────────────── */
export default function ClasseDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab]                       = useState<"eleves" | "professeurs" | "stats">("eleves");
  const [showAffecterEleve, setShowAE]      = useState(false);
  const [showAffecterProf, setShowAP]       = useState(false);
  const [confirmRetirerEleve, setRetEleve]  = useState<string | null>(null);
  const [confirmRetirerProf, setRetProf]    = useState<string | null>(null);

  const classeId = id ?? "";

  const { data: classe, isLoading } = useGetClasseDetail(classeId, {
    query: { queryKey: getGetClasseDetailQueryKey(classeId), enabled: !!classeId },
  });

  const retirerEleveMut  = useRetirerEleve();
  const retirerProfMut   = useRetirerProfesseur();

  const canManage = user?.role === "dev" || user?.role === "directeur" || user?.role === "censeur";

  const handleRetirerEleve = async (eleveId: string) => {
    try {
      await retirerEleveMut.mutateAsync({ id: classeId, eleveId });
      await qc.invalidateQueries({ queryKey: getGetClasseDetailQueryKey(classeId) });
      toast({ title: "Élève retiré" });
      setRetEleve(null);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  const handleRetirerProf = async (profEntryId: string) => {
    try {
      await retirerProfMut.mutateAsync({ id: classeId, profId: profEntryId });
      await qc.invalidateQueries({ queryKey: getGetClasseDetailQueryKey(classeId) });
      toast({ title: "Professeur retiré" });
      setRetProf(null);
    } catch {
      toast({ title: "Erreur", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 page-fade-in">
        <div className="h-32 rounded-2xl animate-pulse" style={{ background: "var(--m15-card)" }} />
        <div className="h-64 rounded-2xl animate-pulse" style={{ background: "var(--m15-card)" }} />
      </div>
    );
  }

  if (!classe) {
    return (
      <div className="py-20 text-center">
        <p style={{ color: "var(--m15-muted)" }}>Classe introuvable.</p>
        <Link href="/classes">
          <span className="text-sm font-semibold mt-2 inline-block" style={{ color: "#00C9A7" }}>← Retour aux classes</span>
        </Link>
      </div>
    );
  }

  const color = NIVEAU_COLORS[classe.niveau] ?? "#00C9A7";
  const capaciteMax = classe.capacite_max ?? 60;
  const taux = capaciteMax > 0 ? Math.round(((classe.nb_eleves ?? 0) / capaciteMax) * 100) : 0;
  const tauxColor = taux >= 100 ? "#FF4D6D" : taux >= 80 ? "#F5C842" : "#00C9A7";

  return (
    <div className="space-y-6 page-fade-in">

      {/* ── Breadcrumb ── */}
      <Link href="/classes">
        <div className="flex items-center gap-2 text-sm cursor-pointer w-fit"
          style={{ color: "var(--m15-muted)" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#00C9A7"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-muted)"; }}>
          <ChevronLeft className="w-4 h-4" />
          Retour aux classes
        </div>
      </Link>

      {/* ── Header classe ── */}
      <div className="relative rounded-2xl p-6 overflow-hidden"
        style={{
          background: `linear-gradient(135deg, var(--m15-card2) 0%, ${color}0A 100%)`,
          border: `1px solid ${color}25`,
        }}>
        <div className="absolute right-0 top-0 w-64 h-64 pointer-events-none"
          style={{ background: `radial-gradient(circle at top right, ${color}10 0%, transparent 60%)` }} />
        <div className="relative z-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase"
                style={{ background: `${color}20`, color }}>
                {classe.niveau}
              </span>
              {classe.filiere_code && (
                <span className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842" }}>
                  Série {classe.filiere_code}
                </span>
              )}
              {!classe.actif && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold"
                  style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D" }}>
                  Inactive
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>
              {classe.nom}
            </h1>
            {classe.titulaire_nom && (
              <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
                Titulaire : <strong style={{ color: "var(--m15-white)" }}>{classe.titulaire_nom}</strong>
              </p>
            )}
          </div>

          {/* Jauge remplissage */}
          <div className="flex-shrink-0 text-right">
            <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: "var(--m15-muted)" }}>
              Remplissage
            </p>
            <div className="flex items-center gap-3">
              <div className="w-32 h-3 rounded-full overflow-hidden" style={{ background: "var(--m15-card2)" }}>
                <div className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(taux, 100)}%`, background: tauxColor }} />
              </div>
              <span className="text-lg font-bold tabular-nums" style={{ color: tauxColor }}>
                {classe.nb_eleves ?? 0}/{capaciteMax}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Onglets ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <TabButton active={tab === "eleves"}     onClick={() => setTab("eleves")}     icon={GraduationCap} label="Élèves"      count={classe.eleves?.length ?? 0} />
        <TabButton active={tab === "professeurs"} onClick={() => setTab("professeurs")} icon={UserSquare}    label="Professeurs" count={classe.professeurs?.length ?? 0} />
        <TabButton active={tab === "stats"}      onClick={() => setTab("stats")}      icon={BarChart3}     label="Statistiques" />
      </div>

      {/* ── Onglet Élèves ── */}
      {tab === "eleves" && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--m15-border)" }}>
            <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Élèves de la classe
            </h3>
            {canManage && (
              <button onClick={() => setShowAE(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: "#00C9A7", color: "#fff" }}>
                <Plus className="w-3.5 h-3.5" /> Affecter
              </button>
            )}
          </div>

          {(classe.eleves ?? []).length === 0 ? (
            <div className="py-12 text-center">
              <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-20" style={{ color: "var(--m15-muted)" }} />
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun élève dans cette classe.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--m15-card2)" }}>
                  {["Élève", "Matricule", "Sexe", "Statut", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--m15-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(classe.eleves ?? []).map((e) => (
                  <tr key={e.id} style={{ borderBottom: "1px solid var(--m15-border)" }}
                    onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                    onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(0,201,167,0.15)", color: "#00C9A7" }}>
                          {e.eleve_prenoms?.charAt(0) ?? "?"}
                        </div>
                        <Link href={`/eleves/${e.eleve_id}`}>
                          <span className="font-medium hover:underline cursor-pointer" style={{ color: "var(--m15-white)" }}>
                            {e.eleve_prenoms} {e.eleve_nom}
                          </span>
                        </Link>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs" style={{ color: "var(--m15-muted)" }}>{e.eleve_matricule}</td>
                    <td className="px-5 py-3.5" style={{ color: "var(--m15-muted)" }}>
                      {e.eleve_sexe === "M" ? "Masculin" : "Féminin"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="px-2 py-1 rounded-full text-xs font-semibold"
                        style={{ background: "rgba(0,201,167,0.12)", color: "#00C9A7" }}>
                        {e.statut}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {canManage && (
                        <button onClick={() => setRetEleve(e.eleve_id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "#FF4D6D" }}
                          onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = "rgba(255,77,109,0.15)"; }}
                          onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Onglet Professeurs ── */}
      {tab === "professeurs" && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid var(--m15-border)" }}>
            <h3 className="font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Professeurs assignés
            </h3>
            {canManage && (
              <button onClick={() => setShowAP(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold"
                style={{ background: "#0080FF", color: "#fff" }}>
                <Plus className="w-3.5 h-3.5" /> Affecter
              </button>
            )}
          </div>

          {(classe.professeurs ?? []).length === 0 ? (
            <div className="py-12 text-center">
              <UserSquare className="w-10 h-10 mx-auto mb-2 opacity-20" style={{ color: "var(--m15-muted)" }} />
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun professeur assigné.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--m15-card2)" }}>
                  {["Professeur", "Email", "Matière", ""].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-widest"
                      style={{ color: "var(--m15-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(classe.professeurs ?? []).map((p) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid var(--m15-border)" }}
                    onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                    onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = "transparent"; }}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ background: "rgba(0,128,255,0.15)", color: "#0080FF" }}>
                          {p.prof_prenoms?.charAt(0) ?? "?"}
                        </div>
                        <span className="font-medium" style={{ color: "var(--m15-white)" }}>
                          {p.prof_prenoms} {p.prof_nom}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs" style={{ color: "var(--m15-muted)" }}>{p.prof_email}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ background: "rgba(0,128,255,0.12)", color: "#0080FF" }}>
                        {p.matiere}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {canManage && (
                        <button onClick={() => setRetProf(p.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: "#FF4D6D" }}
                          onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = "rgba(255,77,109,0.15)"; }}
                          onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = "transparent"; }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Onglet Stats ── */}
      {tab === "stats" && <OngletStats classeId={classeId} />}

      {/* ── Modals affectation ── */}
      {showAffecterEleve && <ModalAffecterEleve classeId={classeId} onClose={() => setShowAE(false)} />}
      {showAffecterProf  && <ModalAffecterProfesseur classeId={classeId} onClose={() => setShowAP(false)} />}

      {/* ── Confirm retirer élève ── */}
      {confirmRetirerEleve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) setRetEleve(null); }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "var(--m15-card)", border: "1px solid rgba(255,77,109,0.3)" }}>
            <p className="font-bold" style={{ color: "var(--m15-white)" }}>Retirer cet élève ?</p>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>L'historique sera conservé.</p>
            <div className="flex gap-3">
              <button onClick={() => setRetEleve(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--m15-card2)", color: "var(--m15-muted)" }}>Annuler</button>
              <button onClick={() => handleRetirerEleve(confirmRetirerEleve)}
                disabled={retirerEleveMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "#FF4D6D", color: "#fff" }}>
                {retirerEleveMut.isPending ? "..." : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm retirer prof ── */}
      {confirmRetirerProf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.6)" }}
          onClick={e => { if (e.target === e.currentTarget) setRetProf(null); }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ background: "var(--m15-card)", border: "1px solid rgba(255,77,109,0.3)" }}>
            <p className="font-bold" style={{ color: "var(--m15-white)" }}>Retirer ce professeur ?</p>
            <div className="flex gap-3">
              <button onClick={() => setRetProf(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "var(--m15-card2)", color: "var(--m15-muted)" }}>Annuler</button>
              <button onClick={() => handleRetirerProf(confirmRetirerProf)}
                disabled={retirerProfMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                style={{ background: "#FF4D6D", color: "#fff" }}>
                {retirerProfMut.isPending ? "..." : "Retirer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
