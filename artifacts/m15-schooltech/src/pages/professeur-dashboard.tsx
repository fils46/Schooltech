import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useListerAnneesScolaires,
  useListerClasses,
  useGetEmploiClasse,
  getDevoirsAVenir,
  useGetHistoriqueAppels,
  useGetMoyennesClasse,
  getGetEmploiClasseQueryKey,
} from "@workspace/api-client-react";
import {
  BookOpen, ClipboardList, AlertTriangle,
  Users, ChevronRight, CalendarDays, CheckCircle2,
  Clock, Book, Award,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";

/* ─── Types locaux ─────────────────────────────────────────── */
type Classe = { id: string; nom: string; niveau?: string };
type Cours = {
  id: string; matiere: string; classe_nom?: string; classe_id?: string;
  creneau_debut?: string; creneau_fin?: string; creneau_libelle?: string;
  professeur_id?: string;
};
type AppelItem = {
  id: string; classe_id: string; matiere: string; date_appel: string;
  statut: string; resume?: { presents: number; absents: number; retards: number; excused: number };
};
type Seance = {
  id: string; classe_id?: string; matiere: string; titre_lecon: string;
  date_remise_devoir?: string; devoir_a_rendre?: boolean; classe_nom?: string;
};

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function todayJour(): string {
  return JOURS[new Date().getDay()];
}

function formatDate(d: string) {
  const [y, m, j] = d.split("-");
  return `${j}/${m}/${y}`;
}

/* ─── Widget Cours du Jour ─────────────────────────────────── */
function CoursDuJour({
  classes, anneeId, userId, onFaireAppel,
}: {
  classes: Classe[];
  anneeId: string;
  userId: string;
  onFaireAppel: (classeId: string, classeNom: string, matiere: string) => void;
}) {
  const [, setLocation] = useLocation();
  const jourAujourd_hui = todayJour();
  const [coursAujourdhui, setCoursAujourdhui] = useState<Cours[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Charger l'emploi du temps de chaque classe du prof
  const queries = classes.slice(0, 5).map(c => {
    return {
      classeId: c.id,
      classeNom: c.nom,
    };
  });

  // On utilise useGetEmploiClasse pour la première classe uniquement (demo)
  // En production, on ferait un endpoint dédié /api/emploi/aujourd-hui/:profId
  const { data: grille0 } = useGetEmploiClasse(
    queries[0]?.classeId ?? "",
    { annee_scolaire_id: anneeId },
    {
      query: {
        queryKey: getGetEmploiClasseQueryKey(queries[0]?.classeId ?? "", { annee_scolaire_id: anneeId }),
        enabled: !!queries[0] && !!anneeId,
      },
    }
  );

  // Extraire les cours du jour pour ce prof
  const grilleData = grille0 as unknown as { grille?: Record<string, Cours[]> };
  const coursClasse0: Cours[] = grilleData?.grille?.[jourAujourd_hui]?.filter(
    (c: Cours) => !c.professeur_id || c.professeur_id === userId
  ) ?? [];

  if (!loaded && coursClasse0.length > 0) {
    setCoursAujourdhui(coursClasse0.map(c => ({
      ...c,
      classe_nom: queries[0]?.classeNom,
      classe_id: queries[0]?.classeId,
    })));
    setLoaded(true);
  }

  const allCours = loaded ? coursAujourdhui : coursClasse0.map(c => ({
    ...c,
    classe_nom: queries[0]?.classeNom,
    classe_id: queries[0]?.classeId,
  }));

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5" style={{ color: "#00C9A7" }} />
          <span className="font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Cours aujourd'hui
          </span>
        </div>
        <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>
          {JOURS[new Date().getDay()].charAt(0).toUpperCase() + JOURS[new Date().getDay()].slice(1)}
        </span>
      </div>

      {allCours.length === 0 ? (
        <div className="text-center py-8">
          <CalendarDays className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: "var(--m15-muted)" }} />
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun cours aujourd'hui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allCours.map((cours, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
              <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}>
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--m15-white)" }}>
                  {cours.matiere}
                </p>
                <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                  {cours.classe_nom} · {cours.creneau_debut ?? ""}{cours.creneau_fin ? ` – ${cours.creneau_fin}` : ""}
                </p>
              </div>
              <button
                onClick={() => onFaireAppel(cours.classe_id ?? "", cours.classe_nom ?? "", cours.matiere)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                Appel
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => setLocation("/appel")}
        className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all"
        style={{ background: "rgba(0,201,167,0.06)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.15)" }}
      >
        <ClipboardList className="w-4 h-4" />
        Voir tous les appels
      </button>
    </div>
  );
}

/* ─── Widget Devoirs à rendre ──────────────────────────────── */
function DevoirsWidget({ etablissementId }: { etablissementId: string }) {
  const { data: raw } = useQuery({
    queryKey: ["devoirs-a-venir", etablissementId],
    queryFn: () => getDevoirsAVenir({}),
    enabled: !!etablissementId,
  });

  const devoirs = (raw as unknown as { devoirs?: Seance[] })?.devoirs ?? [];

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Book className="w-5 h-5" style={{ color: "#F5C842" }} />
        <span className="font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Devoirs à rendre
        </span>
        {devoirs.length > 0 && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842" }}>
            {devoirs.length}
          </span>
        )}
      </div>

      {devoirs.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" style={{ color: "#00C9A7" }} />
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun devoir à venir</p>
        </div>
      ) : (
        <div className="space-y-2">
          {devoirs.slice(0, 4).map(d => (
            <div key={d.id} className="flex items-start gap-3 p-2.5 rounded-lg"
              style={{ background: "rgba(245,200,66,0.05)", border: "1px solid rgba(245,200,66,0.12)" }}>
              <Clock className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#F5C842" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--m15-white)" }}>
                  {d.titre_lecon}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>
                  {d.matiere} · {d.classe_nom} · Rendu le {d.date_remise_devoir ? formatDate(d.date_remise_devoir) : "—"}
                </p>
              </div>
            </div>
          ))}
          {devoirs.length > 4 && (
            <p className="text-xs text-center pt-1" style={{ color: "var(--m15-muted)" }}>
              + {devoirs.length - 4} autres devoirs
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Widget Mes Classes ───────────────────────────────────── */
function MesClassesWidget({
  classes, onSelectClasse,
}: {
  classes: Classe[];
  onSelectClasse: (id: string, nom: string) => void;
}) {
  const [, setLocation] = useLocation();

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <Users className="w-5 h-5" style={{ color: "#0080FF" }} />
        <span className="font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Mes classes
        </span>
        <span className="ml-auto text-xs px-2 py-0.5 rounded-full"
          style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}>
          {classes.length}
        </span>
      </div>

      {classes.length === 0 ? (
        <div className="text-center py-6">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: "var(--m15-muted)" }} />
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucune classe assignée</p>
        </div>
      ) : (
        <div className="space-y-2">
          {classes.map(c => (
            <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}
              onClick={() => onSelectClasse(c.id, c.nom)}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}>
                <Users className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>{c.nom}</p>
                {c.niveau && (
                  <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{c.niveau}</p>
                )}
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={e => { e.stopPropagation(); setLocation("/evaluations?classe=" + c.id); }}
                  className="px-2 py-1 rounded-lg text-xs"
                  style={{ background: "rgba(245,200,66,0.1)", color: "#F5C842" }}
                  title="Saisir notes"
                >
                  <Award className="w-3.5 h-3.5" />
                </button>
                <ChevronRight className="w-4 h-4 self-center" style={{ color: "var(--m15-muted)" }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Widget Alertes ───────────────────────────────────────── */
function AlertesWidget({ classes, anneeId }: { classes: Classe[]; anneeId: string }) {
  const classeId = classes[0]?.id ?? "";
  const { data: rawMoy } = useGetMoyennesClasse(
    classeId,
    { trimestre: "1", annee_scolaire_id: anneeId },
    { query: { queryKey: ["moy", classeId, anneeId], enabled: !!classeId && !!anneeId } }
  );

  const classement = (rawMoy as unknown as { classement?: { eleve_id: string; eleve_nom: string; eleve_prenoms: string; moyenne_generale: number }[] })?.classement ?? [];
  const alertesMoyenne = classement.filter(e => e.moyenne_generale < 8 && e.moyenne_generale > 0);

  return (
    <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5" style={{ color: "#FF4D6D" }} />
        <span className="font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Alertes
        </span>
        {alertesMoyenne.length > 0 && (
          <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D" }}>
            {alertesMoyenne.length}
          </span>
        )}
      </div>

      {alertesMoyenne.length === 0 ? (
        <div className="text-center py-6">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" style={{ color: "#00C9A7" }} />
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucune alerte</p>
          {classes.length === 0 && (
            <p className="text-xs mt-1" style={{ color: "var(--m15-muted)" }}>Assignez-vous à des classes pour voir les alertes</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {alertesMoyenne.slice(0, 5).map(e => (
            <div key={e.eleve_id} className="flex items-center gap-3 p-2.5 rounded-lg"
              style={{ background: "rgba(255,77,109,0.05)", border: "1px solid rgba(255,77,109,0.15)" }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "#FF4D6D" }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--m15-white)" }}>
                  {e.eleve_prenoms} {e.eleve_nom}
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D" }}>
                {e.moyenne_generale.toFixed(2)}/20
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ──────────────────────────────────────── */
export default function ProfesseurDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as unknown as { annees?: { id: string; libelle: string; est_active?: boolean }[] })?.annees ?? [];
  const anneeActive = annees.find(a => a.est_active) ?? annees[0];
  const anneeId = anneeActive?.id ?? "";

  const { data: classesData } = useListerClasses();
  const toutesClasses = ((classesData as unknown as { classes?: Classe[] })?.classes ?? []) as Classe[];
  const classes = toutesClasses; // Filtrage par prof côté API si route dédiée

  const prenom = user?.prenoms ?? "Professeur";
  const dateAujourd_hui = new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const handleFaireAppel = (classeId: string, _classeNom: string, matiere: string) => {
    if (!classeId || !anneeId) {
      toast({ title: "Erreur", description: "Année scolaire non sélectionnée.", variant: "destructive" });
      return;
    }
    setLocation(`/appel?classe=${classeId}&matiere=${encodeURIComponent(matiere)}&annee=${anneeId}`);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* En-tête */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Bonjour, {prenom} 👋
          </h1>
          <p className="mt-1 text-sm capitalize" style={{ color: "var(--m15-muted)" }}>
            {dateAujourd_hui}
          </p>
        </div>
        {anneeActive && (
          <div className="text-right">
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Année scolaire</p>
            <p className="text-sm font-semibold" style={{ color: "#00C9A7" }}>
              {anneeActive.libelle}
            </p>
          </div>
        )}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Mes classes", value: classes.length, color: "#0080FF", icon: Users },
          { label: "Devoirs cette semaine", value: "—", color: "#F5C842", icon: Book },
          { label: "Appels ce mois", value: "—", color: "#00C9A7", icon: ClipboardList },
          { label: "Notes saisies", value: "—", color: "#9B59B6", icon: Award },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-4 text-center"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="w-9 h-9 rounded-xl mx-auto mb-2 flex items-center justify-center"
              style={{ background: `${color}1A` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <p className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              {value}
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Widgets principaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CoursDuJour
          classes={classes}
          anneeId={anneeId}
          userId={user?.id ?? ""}
          onFaireAppel={handleFaireAppel}
        />
        <DevoirsWidget etablissementId={user?.etablissement_id ?? ""} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <MesClassesWidget
          classes={classes}
          onSelectClasse={(id) => setLocation("/notes/classe/" + id)}
        />
        <AlertesWidget classes={classes} anneeId={anneeId} />
      </div>

      {/* Actions rapides */}
      <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <p className="text-sm font-semibold mb-4" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Actions rapides
        </p>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Faire l'appel", icon: ClipboardList, color: "#00C9A7", href: "/appel" },
            { label: "Saisir des notes", icon: Award, color: "#F5C842", href: "/evaluations" },
            { label: "Cahier de textes", icon: Book, color: "#0080FF", href: "/cahier-de-textes" },
          ].map(({ label, icon: Icon, color, href }) => (
            <button key={href}
              onClick={() => setLocation(href)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
