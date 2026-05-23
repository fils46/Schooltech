import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useListerEleves,
  getListerElevesQueryKey,
  useRechercherEleves,
  getRechercherElevesQueryKey,
} from "@workspace/api-client-react";
import {
  UserSquare, Plus, Search, Filter, Download,
  RefreshCw, ChevronLeft, ChevronRight, Users,
  CheckCircle, ArrowRightLeft, XCircle, UserX,
} from "lucide-react";

/* ─── Badge statut ───────────────────────────────────────── */
const STATUT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  actif:    { bg: "rgba(0,201,167,0.12)",  color: "#00C9A7", label: "Actif" },
  inactif:  { bg: "rgba(139,157,195,0.12)", color: "var(--m15-muted)", label: "Inactif" },
  transfere:{ bg: "rgba(0,128,255,0.12)",  color: "#0080FF", label: "Transféré" },
  exclu:    { bg: "rgba(255,77,109,0.12)", color: "#FF4D6D", label: "Exclu" },
};

function BadgeStatut({ statut }: { statut: string }) {
  const s = STATUT_STYLES[statut] ?? STATUT_STYLES.inactif;
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function Avatar({ nom, prenoms, photoUrl }: { nom: string; prenoms: string; photoUrl?: string | null }) {
  if (photoUrl) return <img src={photoUrl} alt={nom} className="w-8 h-8 rounded-full object-cover" />;
  const initials = `${prenoms.charAt(0)}${nom.charAt(0)}`.toUpperCase();
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
      style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
      {initials}
    </div>
  );
}

/* ─── Export CSV ─────────────────────────────────────────── */
function exportCsv(eleves: Array<Record<string, unknown>>) {
  const header = ["Matricule", "Nom", "Prénoms", "Sexe", "Année inscription", "Statut"];
  const rows = eleves.map((e) => [
    e.matricule, e.nom, e.prenoms, e.sexe === "M" ? "Masculin" : "Féminin", e.annee_inscription, e.statut,
  ]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "eleves.csv"; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Page principale ────────────────────────────────────── */
export default function EleveListe() {
  const { user } = useAuth();
  const canManage = ["dev", "directeur", "censeur"].includes(user?.role ?? "");

  const [page, setPage] = useState(1);
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreAnnee, setFiltreAnnee] = useState("");
  const [filtreSexe, setFiltreSexe] = useState("");
  const [recherche, setRecherche] = useState("");
  const [rechercheDebounced, setRechercheDebounced] = useState("");

  const LIMIT = 20;
  const anneeActuelle = new Date().getFullYear();

  const isSearching = rechercheDebounced.trim().length > 0;

  const { data: listeData, isLoading: listeLoading, refetch } = useListerEleves(
    {
      statut: filtreStatut || undefined,
      annee_inscription: filtreAnnee ? parseInt(filtreAnnee) : undefined,
      sexe: filtreSexe || undefined,
      page,
      limit: LIMIT,
    },
    { query: { queryKey: getListerElevesQueryKey(), enabled: !isSearching } }
  );

  const { data: searchData, isLoading: searchLoading } = useRechercherEleves(
    {
      q: rechercheDebounced || undefined,
      statut: filtreStatut || undefined,
      sexe: filtreSexe || undefined,
    },
    { query: { queryKey: getRechercherElevesQueryKey(), enabled: isSearching } }
  );

  const eleves = isSearching ? (searchData ?? []) : (listeData?.eleves ?? []);
  const total = isSearching ? eleves.length : (listeData?.total ?? 0);
  const totalPages = Math.ceil(total / LIMIT);
  const isLoading = isSearching ? searchLoading : listeLoading;

  const totalActifs  = eleves.filter((e) => e.statut === "actif").length;
  const totalTrans   = eleves.filter((e) => e.statut === "transfere").length;
  const totalExclus  = eleves.filter((e) => e.statut === "exclu").length;

  const handleRecherche = (v: string) => {
    setRecherche(v);
    setPage(1);
    setTimeout(() => setRechercheDebounced(v), 300);
  };

  const resetFiltres = () => {
    setFiltreStatut(""); setFiltreAnnee(""); setFiltreSexe("");
    setRecherche(""); setRechercheDebounced(""); setPage(1);
  };

  const annees = Array.from({ length: 5 }, (_, i) => anneeActuelle - i);

  return (
    <div className="space-y-6 page-fade-in">

      {/* ── En-tête ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.2)" }}>
            <UserSquare className="w-5 h-5" style={{ color: "#00C9A7" }} />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Élèves
            </h1>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
              {total} élève{total !== 1 ? "s" : ""} au total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCsv(eleves as unknown as Array<Record<string, unknown>>)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
            <Download className="w-4 h-4" /> Export CSV
          </button>
          <button onClick={() => refetch()}
            className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          {canManage && (
            <Link href="/eleves/inscrire">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
                <Plus className="w-4 h-4" /> Inscrire un élève
              </button>
            </Link>
          )}
        </div>
      </div>

      {/* ── Compteurs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", value: total, icon: Users, color: "var(--m15-muted)" },
          { label: "Actifs", value: totalActifs, icon: CheckCircle, color: "#00C9A7" },
          { label: "Transférés", value: totalTrans, icon: ArrowRightLeft, color: "#0080FF" },
          { label: "Exclus", value: totalExclus, icon: XCircle, color: "#FF4D6D" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl p-3 flex items-center gap-3"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}18` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-lg font-bold leading-none" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                {value}
              </p>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filtres ── */}
      <div className="rounded-xl p-4 flex flex-wrap gap-3"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-2 flex-1 min-w-[180px] px-3 py-2 rounded-lg"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
          <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--m15-muted)" }} />
          <input
            value={recherche}
            onChange={(e) => handleRecherche(e.target.value)}
            placeholder="Nom, prénom, matricule…"
            className="bg-transparent text-sm outline-none w-full"
            style={{ color: "var(--m15-white)", fontFamily: "'DM Sans', sans-serif" }}
          />
        </div>

        <select
          value={filtreStatut}
          onChange={(e) => { setFiltreStatut(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)", fontFamily: "'DM Sans', sans-serif" }}>
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
          <option value="transfere">Transféré</option>
          <option value="exclu">Exclu</option>
        </select>

        <select
          value={filtreAnnee}
          onChange={(e) => { setFiltreAnnee(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)", fontFamily: "'DM Sans', sans-serif" }}>
          <option value="">Toutes les années</option>
          {annees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>

        <select
          value={filtreSexe}
          onChange={(e) => { setFiltreSexe(e.target.value); setPage(1); }}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)", fontFamily: "'DM Sans', sans-serif" }}>
          <option value="">Tous les sexes</option>
          <option value="M">Masculin</option>
          <option value="F">Féminin</option>
        </select>

        {(filtreStatut || filtreAnnee || filtreSexe || recherche) && (
          <button onClick={resetFiltres} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
            style={{ color: "#FF4D6D", background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }}>
            <Filter className="w-3.5 h-3.5" /> Réinitialiser
          </button>
        )}
      </div>

      {/* ── Tableau ── */}
      <div className="rounded-xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: "var(--m15-card2)", borderBottom: "1px solid var(--m15-border)" }}>
              {["Élève", "Matricule", "Sexe", "Année", "Statut", ""].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest"
                  style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={6} className="px-4 py-3">
                  <div className="h-8 rounded-lg animate-pulse" style={{ background: "var(--elevate-1)" }} />
                </td></tr>
              ))
            ) : eleves.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center">
                <UserX className="w-10 h-10 mx-auto mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
                <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun élève trouvé</p>
              </td></tr>
            ) : (
              eleves.map((e) => (
                <tr key={e.id}
                  style={{ borderBottom: "1px solid var(--m15-border)" }}
                  onMouseEnter={el => { (el.currentTarget as HTMLElement).style.background = "var(--elevate-1)"; }}
                  onMouseLeave={el => { (el.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nom={e.nom} prenoms={e.prenoms} photoUrl={e.photo_url} />
                      <div>
                        <p className="font-medium text-sm" style={{ color: "var(--m15-white)" }}>
                          {e.prenoms} {e.nom}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ background: "var(--elevate-2)", color: "#00C9A7" }}>
                      {e.matricule}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--m15-muted)" }}>
                    {e.sexe === "M" ? "♂ Masculin" : "♀ Féminin"}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--m15-muted)" }}>
                    {e.annee_inscription}
                  </td>
                  <td className="px-4 py-3"><BadgeStatut statut={e.statut} /></td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/eleves/${e.id}`}>
                      <button className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                        style={{ background: "rgba(0,201,167,0.08)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
                        Dossier →
                      </button>
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {!isSearching && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--m15-border)" }}>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
              Page {page} / {totalPages} — {total} résultats
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-40"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg transition-all disabled:opacity-40"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
