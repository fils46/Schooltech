import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetExamensSujets,
  useGetExamensEpreuves,
  useGetExamensPlanningEleveIdCompletion,
  useGetExamensEleveEleveIdProgression,
  getGetExamensSujetsQueryKey,
  getGetExamensEpreuvesQueryKey,
  getGetExamensPlanningEleveIdCompletionQueryKey,
  getGetExamensEleveEleveIdProgressionQueryKey,
} from "@workspace/api-client-react";
import {
  BookOpen, FileText, ClipboardList, Calendar,
  TrendingUp, Award, AlertCircle, CheckCircle2,
  ChevronRight, Star, BarChart3, Target,
} from "lucide-react";

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div style={{ background: "#111E35" }} className="rounded-xl p-5 border border-white/5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-[#8B9DC3] mb-1">{label}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
          {sub && <p className="text-xs text-[#8B9DC3] mt-1">{sub}</p>}
        </div>
        <div style={{ background: `${color}20` }} className="p-3 rounded-lg">
          <Icon size={20} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function ModuleCard({
  titre, description, icon: Icon, color, path, badge,
}: {
  titre: string; description: string; icon: React.ElementType;
  color: string; path: string; badge?: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <button
      onClick={() => setLocation(path)}
      style={{ background: "#111E35" }}
      className="w-full rounded-xl p-5 border border-white/5 hover:border-white/20 transition-all text-left group"
    >
      <div className="flex items-center justify-between mb-4">
        <div style={{ background: `${color}20` }} className="p-3 rounded-lg">
          <Icon size={22} style={{ color }} />
        </div>
        {badge && (
          <span style={{ background: `${color}20`, color }} className="text-xs px-2 py-1 rounded-full font-medium">
            {badge}
          </span>
        )}
      </div>
      <h3 className="text-white font-semibold mb-1 group-hover:text-[#00C9A7] transition-colors">{titre}</h3>
      <p className="text-[#8B9DC3] text-sm leading-relaxed">{description}</p>
      <div className="flex items-center gap-1 mt-3 text-[#8B9DC3] text-xs group-hover:text-[#00C9A7] transition-colors">
        <span>Ouvrir</span><ChevronRight size={12} />
      </div>
    </button>
  );
}

export default function ExamensDashboard() {
  const { user } = useAuth();
  const role = user?.role ?? "";
  const eleveId = user?.id ?? "";

  const sujetsParams = { publie: (role === "eleve" || role === "parent") ? true : undefined };
  const epreuvesParams = {};
  const sujetsQk     = getGetExamensSujetsQueryKey(sujetsParams);
  const epreuvesQk   = getGetExamensEpreuvesQueryKey(epreuvesParams);
  const completionQk = getGetExamensPlanningEleveIdCompletionQueryKey(eleveId);
  const progressionQk= getGetExamensEleveEleveIdProgressionQueryKey(eleveId);

  const { data: sujetsData } = useGetExamensSujets(
    sujetsParams,
    { query: { queryKey: sujetsQk } }
  );
  const { data: epreuvesData } = useGetExamensEpreuves(
    epreuvesParams,
    { query: { queryKey: epreuvesQk } }
  );
  const { data: completionData } = useGetExamensPlanningEleveIdCompletion(
    eleveId,
    { query: { queryKey: completionQk, enabled: role === "eleve" && !!eleveId } }
  );
  const { data: progressionData } = useGetExamensEleveEleveIdProgression(
    eleveId,
    { query: { queryKey: progressionQk, enabled: role === "eleve" && !!eleveId } }
  );

  const nbSujets = (sujetsData as { total?: number })?.total ?? 0;
  const nbEpreuves = (epreuvesData as { total?: number })?.total ?? 0;
  const taux = (completionData as { taux_completion?: number })?.taux_completion ?? 0;
  const ptsFaibles = (progressionData as { points_faibles?: string[] })?.points_faibles ?? [];
  const ptsForts = (progressionData as { points_forts?: string[] })?.points_forts ?? [];

  const epreuvesList = (epreuvesData as { epreuves?: { statut: string }[] })?.epreuves ?? [];
  const nbPlanifiees = epreuvesList.filter((e) => e.statut === "planifiee").length;
  const nbTerminees  = epreuvesList.filter((e) => e.statut === "corrigee").length;

  const isGestionnaire = ["dev", "directeur", "censeur", "professeur"].includes(role);
  const isEleve = role === "eleve";
  const isParent = role === "parent";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-1">Préparation aux Examens</h1>
        <p className="text-[#8B9DC3] text-sm">
          {isGestionnaire
            ? "Gérez la bibliothèque de sujets, les épreuves blanches et suivez la progression des élèves."
            : "Accédez aux sujets BEPC/BAC, vos épreuves blanches et votre planning de révision."}
        </p>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Sujets disponibles"
          value={nbSujets}
          sub="BEPC · BAC · Blanc"
          icon={BookOpen}
          color="#00C9A7"
        />
        {isGestionnaire ? (
          <>
            <StatCard
              label="Épreuves planifiées"
              value={nbPlanifiees}
              sub="À venir"
              icon={ClipboardList}
              color="#F5C842"
            />
            <StatCard
              label="Épreuves corrigées"
              value={nbTerminees}
              sub="Résultats disponibles"
              icon={CheckCircle2}
              color="#0080FF"
            />
            <StatCard
              label="Total épreuves"
              value={nbEpreuves}
              sub="Cette année"
              icon={BarChart3}
              color="#FF4D6D"
            />
          </>
        ) : (
          <>
            <StatCard
              label="Épreuves blanches"
              value={nbEpreuves}
              sub="Passées / à venir"
              icon={ClipboardList}
              color="#F5C842"
            />
            <StatCard
              label="Planning révision"
              value={isEleve ? `${taux}%` : "—"}
              sub="Taux de complétion"
              icon={Calendar}
              color="#0080FF"
            />
            <StatCard
              label="Points forts"
              value={isEleve ? ptsForts.length : "—"}
              sub="Matières ≥ 14/20"
              icon={Star}
              color="#00C9A7"
            />
          </>
        )}
      </div>

      {/* Points faibles élève */}
      {isEleve && ptsFaibles.length > 0 && (
        <div style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }}
          className="rounded-xl p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-[#FF4D6D] mt-0.5 shrink-0" />
          <div>
            <p className="text-white font-medium text-sm">Points à améliorer</p>
            <p className="text-[#8B9DC3] text-xs mt-1">
              Matières sous la moyenne : {ptsFaibles.join(", ")}. Travaille-les en priorité dans ton planning.
            </p>
          </div>
        </div>
      )}

      {/* Modules */}
      <div>
        <h2 className="text-sm font-semibold text-[#8B9DC3] uppercase tracking-wider mb-4">Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ModuleCard
            titre="Bibliothèque de Sujets"
            description="Consultez et téléchargez les sujets BEPC/BAC par matière, série et année."
            icon={BookOpen}
            color="#00C9A7"
            path="/bibliotheque-sujets"
            badge={`${nbSujets} sujets`}
          />
          <ModuleCard
            titre="Épreuves Blanches"
            description={isGestionnaire
              ? "Planifiez et corrigez des épreuves blanches pour vos classes."
              : "Consultez vos résultats aux épreuves blanches passées."}
            icon={ClipboardList}
            color="#F5C842"
            path="/epreuves-blanches"
            badge={nbPlanifiees > 0 ? `${nbPlanifiees} à venir` : undefined}
          />
          {(isEleve || isGestionnaire) && (
            <ModuleCard
              titre="Planning de Révision"
              description={isEleve
                ? "Générez et suivez votre planning de révision personnalisé jusqu'aux examens."
                : "Visualisez et gérez le planning de révision des élèves."}
              icon={Calendar}
              color="#0080FF"
              path="/planning-revision"
            />
          )}
          <ModuleCard
            titre="Résultats & Progression"
            description={isGestionnaire
              ? "Analysez les performances des élèves aux épreuves blanches par matière."
              : "Suivez votre progression et identifiez vos points forts et faibles."}
            icon={TrendingUp}
            color="#FF4D6D"
            path="/resultats-progression"
          />
        </div>
      </div>
    </div>
  );
}
