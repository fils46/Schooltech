import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useCreerAppel, useGetAppel, useMettreAJourPresence, useTerminerAppel,
  useGetHistoriqueAppels,
  useListerClasses, useListerAnneesScolaires,
  useListerCreneaux,
} from "@workspace/api-client-react";
import {
  ClipboardList, CheckCircle2, XCircle, Clock,
  UserCheck, ChevronLeft, Check, AlertTriangle,
  Search, RotateCcw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/* ─── Types ─────────────────────────────────────────────────── */
type Detail = {
  id: string; eleve_id: string; statut: string; motif?: string;
  eleve_nom?: string; eleve_prenoms?: string; eleve_matricule?: string;
  eleve_photo_url?: string;
};
type Appel = {
  id: string; classe_id: string; matiere: string; date_appel: string;
  statut: string; classe_nom?: string;
  resume?: { presents: number; absents: number; retards: number; excused: number };
  details?: Detail[];
};
type AppelHistorique = {
  id: string; classe_id: string; matiere: string; date_appel: string;
  statut: string; classe_nom?: string;
  resume?: { presents: number; absents: number; retards: number; excused: number };
};
type Classe = { id: string; nom: string };
type Creneau = { id: string; libelle: string; heure_debut: string; heure_fin: string };

const STATUT_CONFIG = {
  present: { label: "Présent", color: "#00C9A7", bg: "rgba(0,201,167,0.12)", icon: CheckCircle2 },
  absent:  { label: "Absent",  color: "#FF4D6D", bg: "rgba(255,77,109,0.12)", icon: XCircle },
  retard:  { label: "Retard",  color: "#F5C842", bg: "rgba(245,200,66,0.12)", icon: Clock },
  excused: { label: "Excusé",  color: "#0080FF", bg: "rgba(0,128,255,0.12)", icon: UserCheck },
};

/* ─── Formulaire Créer Appel ──────────────────────────────── */
function CreerAppelForm({
  defaultClasseId,
  defaultMatiere,
  defaultAnneeId,
  onCreated,
}: {
  defaultClasseId?: string;
  defaultMatiere?: string;
  defaultAnneeId?: string;
  onCreated: (appelId: string) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const creerMut = useCreerAppel();

  const { data: classesData } = useListerClasses();
  const { data: anneesData } = useListerAnneesScolaires();
  const classes = (Array.isArray(classesData) ? classesData : []) as Classe[];
  const annees = (anneesData as unknown as { annees?: { id: string; libelle: string; est_active?: boolean }[] })?.annees ?? [];
  const anneeActive = annees.find(a => a.est_active) ?? annees[0];

  const { data: creneauxData } = useListerCreneaux({ etablissement_id: user?.etablissement_id ?? undefined });
  const creneaux = (creneauxData as unknown as { creneaux?: Creneau[] })?.creneaux ?? [];

  const [form, setForm] = useState({
    classe_id: defaultClasseId ?? "",
    matiere: defaultMatiere ?? "",
    annee_scolaire_id: defaultAnneeId ?? anneeActive?.id ?? "",
    date_appel: new Date().toISOString().slice(0, 10),
    creneau_id: "",
  });

  useEffect(() => {
    if (anneeActive?.id && !form.annee_scolaire_id) {
      setForm(f => ({ ...f, annee_scolaire_id: anneeActive.id }));
    }
  }, [anneeActive]);

  const handleSubmit = () => {
    if (!form.classe_id || !form.matiere || !form.annee_scolaire_id) {
      toast({ title: "Champs manquants", description: "Classe, matière et année sont obligatoires.", variant: "destructive" });
      return;
    }
    creerMut.mutate(
      { data: { ...form, creneau_id: form.creneau_id || undefined } as Parameters<typeof creerMut.mutate>[0]["data"] },
      {
        onSuccess: (data) => {
          const appel = (data as unknown as { appel?: Appel })?.appel;
          if (appel?.id) onCreated(appel.id);
          else toast({ title: "Appel créé !" });
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
          toast({ title: "Erreur", description: msg, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="rounded-2xl p-6" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <h2 className="text-lg font-bold mb-6" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
        Démarrer un nouvel appel
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Classe */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
            Classe *
          </label>
          <select
            value={form.classe_id}
            onChange={e => setForm(f => ({ ...f, classe_id: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
          >
            <option value="">Sélectionner une classe</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        </div>

        {/* Matière */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
            Matière *
          </label>
          <input
            type="text"
            value={form.matiere}
            onChange={e => setForm(f => ({ ...f, matiere: e.target.value }))}
            placeholder="Ex: Mathématiques"
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
          />
        </div>

        {/* Année scolaire */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
            Année scolaire *
          </label>
          <select
            value={form.annee_scolaire_id}
            onChange={e => setForm(f => ({ ...f, annee_scolaire_id: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
          >
            <option value="">Sélectionner</option>
            {annees.map(a => (
              <option key={a.id} value={a.id}>{a.libelle}{a.est_active ? " (active)" : ""}</option>
            ))}
          </select>
        </div>

        {/* Date */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
            Date
          </label>
          <input
            type="date"
            value={form.date_appel}
            onChange={e => setForm(f => ({ ...f, date_appel: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
          />
        </div>

        {/* Créneau */}
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
            Créneau horaire
          </label>
          <select
            value={form.creneau_id}
            onChange={e => setForm(f => ({ ...f, creneau_id: e.target.value }))}
            className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
          >
            <option value="">Aucun créneau</option>
            {creneaux.map(c => (
              <option key={c.id} value={c.id}>{c.libelle} ({c.heure_debut}–{c.heure_fin})</option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={creerMut.isPending}
        className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all"
        style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}
      >
        <ClipboardList className="w-4 h-4" />
        {creerMut.isPending ? "Création..." : "Démarrer l'appel"}
      </button>
    </div>
  );
}

/* ─── Interface d'appel en cours ─────────────────────────── */
function AppelEnCours({ appelId, onTermine }: { appelId: string; onTermine: () => void }) {
  const { toast } = useToast();
  const { data: raw, refetch } = useGetAppel(appelId);
  const mettreAJourMut = useMettreAJourPresence();
  const terminerMut = useTerminerAppel();

  const appel = (raw as unknown as { appel?: Appel })?.appel;
  const details: Detail[] = appel?.details ?? [];

  const [search, setSearch] = useState("");
  const [localStatuts, setLocalStatuts] = useState<Record<string, string>>({});
  const [localMotifs, setLocalMotifs] = useState<Record<string, string>>({});
  const [showConfirmTerminer, setShowConfirmTerminer] = useState(false);
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());

  const filteredDetails = details.filter(d =>
    !search ||
    `${d.eleve_prenoms} ${d.eleve_nom}`.toLowerCase().includes(search.toLowerCase()) ||
    (d.eleve_matricule ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const getStatut = (d: Detail) => localStatuts[d.eleve_id] ?? d.statut;
  const getMotif = (d: Detail) => localMotifs[d.eleve_id] ?? d.motif ?? "";

  const handleStatutChange = (eleveId: string, statut: string) => {
    setLocalStatuts(s => ({ ...s, [eleveId]: statut }));
    if (statut === "present" || statut === "excused") {
      setLocalMotifs(m => { const n = { ...m }; delete n[eleveId]; return n; });
    }
    setPendingUpdates(prev => new Set(prev).add(eleveId));

    mettreAJourMut.mutate(
      {
        id: appelId,
        data: {
          eleve_id: eleveId,
          statut: statut as Parameters<typeof mettreAJourMut.mutate>[0]["data"]["statut"],
          motif: localMotifs[eleveId] ?? undefined,
        },
      },
      {
        onSuccess: () => {
          setPendingUpdates(prev => { const n = new Set(prev); n.delete(eleveId); return n; });
        },
        onError: () => {
          setPendingUpdates(prev => { const n = new Set(prev); n.delete(eleveId); return n; });
          toast({ title: "Erreur de mise à jour", variant: "destructive" });
        },
      }
    );
  };

  const handleTousPresents = () => {
    details.forEach(d => {
      setLocalStatuts(s => ({ ...s, [d.eleve_id]: "present" }));
      mettreAJourMut.mutate({
        id: appelId,
        data: { eleve_id: d.eleve_id, statut: "present" as Parameters<typeof mettreAJourMut.mutate>[0]["data"]["statut"] },
      });
    });
  };

  const handleTerminer = () => {
    terminerMut.mutate(
      { id: appelId },
      {
        onSuccess: () => {
          toast({ title: "Appel terminé !" });
          onTermine();
        },
        onError: (e: unknown) => {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
          toast({ title: "Erreur", description: msg, variant: "destructive" });
        },
      }
    );
  };

  // Compteur en temps réel
  const resume = {
    presents: filteredDetails.filter(d => getStatut(d) === "present").length,
    absents: filteredDetails.filter(d => getStatut(d) === "absent").length,
    retards: filteredDetails.filter(d => getStatut(d) === "retard").length,
    excused: filteredDetails.filter(d => getStatut(d) === "excused").length,
  };

  if (!appel) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <RotateCcw className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: "#00C9A7" }} />
          <p style={{ color: "var(--m15-muted)" }}>Chargement de l'appel...</p>
        </div>
      </div>
    );
  }

  const isTermine = appel.statut === "termine";

  return (
    <div className="space-y-4">
      {/* En-tête appel */}
      <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList className="w-5 h-5" style={{ color: "#00C9A7" }} />
              <span className="font-bold text-lg" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                {appel.matiere}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isTermine ? "" : "animate-pulse"}`}
                style={{
                  background: isTermine ? "rgba(0,201,167,0.15)" : "rgba(245,200,66,0.15)",
                  color: isTermine ? "#00C9A7" : "#F5C842",
                }}>
                {isTermine ? "Terminé" : "En cours"}
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
              {appel.classe_nom} · {appel.date_appel}
            </p>
          </div>

          {!isTermine && (
            <div className="flex gap-2">
              <button
                onClick={handleTousPresents}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                style={{ background: "rgba(0,201,167,0.08)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}
              >
                <Check className="w-3.5 h-3.5" />
                Tous présents
              </button>
              <button
                onClick={() => setShowConfirmTerminer(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}
              >
                Terminer l'appel
              </button>
            </div>
          )}
        </div>

        {/* Compteurs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {Object.entries(STATUT_CONFIG).map(([key, cfg]) => {
            const n = key === "present" ? resume.presents : key === "absent" ? resume.absents : key === "retard" ? resume.retards : resume.excused;
            return (
              <div key={key} className="text-center p-2.5 rounded-xl"
                style={{ background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
                <p className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: cfg.color }}>{n}</p>
                <p className="text-xs" style={{ color: cfg.color }}>{cfg.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <Search className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />
        <input
          type="search"
          placeholder="Rechercher un élève..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-transparent outline-none flex-1 text-sm"
          style={{ color: "var(--m15-white)" }}
        />
      </div>

      {/* Liste élèves */}
      <div className="space-y-2">
        {filteredDetails.map(d => {
          const statut = getStatut(d);
          const cfg = STATUT_CONFIG[statut as keyof typeof STATUT_CONFIG] ?? STATUT_CONFIG.present;
          const needsMotif = statut === "absent" || statut === "retard";

          return (
            <div key={d.eleve_id} className="rounded-xl p-4"
              style={{ background: "var(--m15-card)", border: `1px solid ${pendingUpdates.has(d.eleve_id) ? "#F5C842" : "var(--m15-border)"}` }}>
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: `${cfg.color}22`, color: cfg.color, fontFamily: "'Syne', sans-serif" }}>
                  {d.eleve_prenoms?.charAt(0)}{d.eleve_nom?.charAt(0)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
                    {d.eleve_prenoms} {d.eleve_nom}
                  </p>
                  <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                    {d.eleve_matricule}
                  </p>
                </div>

                {/* Boutons statut */}
                {!isTermine && (
                  <div className="flex gap-1.5 flex-wrap justify-end">
                    {Object.entries(STATUT_CONFIG).map(([key, c]) => (
                      <button
                        key={key}
                        onClick={() => handleStatutChange(d.eleve_id, key)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: statut === key ? c.bg : "var(--elevate-1)",
                          color: statut === key ? c.color : "var(--m15-muted)",
                          border: statut === key ? `1px solid ${c.color}66` : "1px solid var(--m15-border)",
                          fontWeight: statut === key ? 700 : 400,
                        }}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                )}

                {isTermine && (
                  <span className="text-xs px-2 py-1 rounded-lg font-medium"
                    style={{ background: cfg.bg, color: cfg.color }}>
                    {cfg.label}
                  </span>
                )}
              </div>

              {/* Champ motif */}
              {needsMotif && !isTermine && (
                <input
                  type="text"
                  value={getMotif(d)}
                  onChange={e => setLocalMotifs(m => ({ ...m, [d.eleve_id]: e.target.value }))}
                  onBlur={() => {
                    mettreAJourMut.mutate({
                      id: appelId,
                      data: {
                        eleve_id: d.eleve_id,
                        statut: statut as Parameters<typeof mettreAJourMut.mutate>[0]["data"]["statut"],
                        motif: getMotif(d) || undefined,
                      },
                    });
                  }}
                  placeholder="Motif (optionnel)"
                  className="mt-2 w-full px-3 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Modal confirmation terminer */}
      {showConfirmTerminer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="rounded-2xl p-6 w-full max-w-sm"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <AlertTriangle className="w-10 h-10 mx-auto mb-3" style={{ color: "#F5C842" }} />
            <h3 className="text-lg font-bold text-center mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Terminer l'appel ?
            </h3>
            <p className="text-sm text-center mb-5" style={{ color: "var(--m15-muted)" }}>
              Cette action est irréversible. Résumé : {resume.presents}P · {resume.absents}A · {resume.retards}R · {resume.excused}E
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirmTerminer(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "var(--elevate-1)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
                Annuler
              </button>
              <button onClick={handleTerminer} disabled={terminerMut.isPending}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
                {terminerMut.isPending ? "..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Historique des appels ───────────────────────────────── */
function HistoriqueAppels({ onOpen }: { onOpen: (id: string) => void }) {
  const { user } = useAuth();
  const { data: raw } = useGetHistoriqueAppels();
  const appels = (raw as unknown as { appels?: AppelHistorique[] })?.appels ?? [];

  return (
    <div className="space-y-2 mt-4">
      <p className="text-sm font-semibold" style={{ color: "var(--m15-muted)" }}>Appels récents</p>
      {appels.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--m15-muted)" }}>
          Aucun appel enregistré
        </p>
      ) : (
        appels.slice(0, 10).map(a => (
          <div key={a.id}
            className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}
            onClick={() => onOpen(a.id)}>
            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: a.statut === "termine" ? "rgba(0,201,167,0.1)" : "rgba(245,200,66,0.1)" }}>
              <ClipboardList className="w-4 h-4" style={{ color: a.statut === "termine" ? "#00C9A7" : "#F5C842" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
                {a.matiere} · {a.classe_nom}
              </p>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                {a.date_appel} · {a.resume ? `${a.resume.presents}P ${a.resume.absents}A ${a.resume.retards}R` : "—"}
              </p>
            </div>
            <span className="text-xs px-2 py-0.5 rounded-full"
              style={{
                background: a.statut === "termine" ? "rgba(0,201,167,0.1)" : "rgba(245,200,66,0.1)",
                color: a.statut === "termine" ? "#00C9A7" : "#F5C842",
              }}>
              {a.statut === "termine" ? "Terminé" : "En cours"}
            </span>
          </div>
        ))
      )}
    </div>
  );
}

/* ─── Page principale ──────────────────────────────────────── */
export default function FaireAppel() {
  const [, setLocation] = useLocation();
  const [search] = useState(() => {
    if (typeof window !== "undefined") return new URLSearchParams(window.location.search);
    return new URLSearchParams();
  });

  const defaultClasseId = search.get("classe") ?? "";
  const defaultMatiere = search.get("matiere") ?? "";
  const defaultAnneeId = search.get("annee") ?? "";

  const [appelId, setAppelId] = useState<string | null>(null);
  const [mode, setMode] = useState<"creer" | "en-cours" | "historique">("creer");

  const handleCreated = (id: string) => {
    setAppelId(id);
    setMode("en-cours");
  };

  const handleTermine = () => {
    setMode("historique");
    setAppelId(null);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setLocation("/dashboard")}
          className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Faire l'appel
          </h1>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            {new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        {/* Onglets */}
        <div className="ml-auto flex rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--m15-border)" }}>
          {[
            { key: "creer", label: "Nouvel appel" },
            { key: "historique", label: "Historique" },
          ].map(t => (
            <button key={t.key}
              onClick={() => { setMode(t.key as "creer" | "en-cours" | "historique"); if (t.key !== "en-cours") setAppelId(null); }}
              className="px-4 py-2 text-sm font-medium transition-all"
              style={{
                background: mode === t.key ? "rgba(0,201,167,0.1)" : "var(--m15-card)",
                color: mode === t.key ? "#00C9A7" : "var(--m15-muted)",
              }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenu */}
      {mode === "creer" && (
        <CreerAppelForm
          defaultClasseId={defaultClasseId}
          defaultMatiere={defaultMatiere}
          defaultAnneeId={defaultAnneeId}
          onCreated={handleCreated}
        />
      )}

      {mode === "en-cours" && appelId && (
        <AppelEnCours appelId={appelId} onTermine={handleTermine} />
      )}

      {(mode === "historique" || (mode === "creer" && !appelId)) && (
        <HistoriqueAppels
          onOpen={id => { setAppelId(id); setMode("en-cours"); }}
        />
      )}
    </div>
  );
}
