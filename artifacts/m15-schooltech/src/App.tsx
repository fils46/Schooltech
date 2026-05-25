import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SplashScreen } from "@/components/SplashScreen";
import InstallBanner from "@/components/pwa/InstallBanner";
import { useState } from "react";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import PremierLogin from "@/pages/premier-login";
import Dashboard from "@/pages/dashboard";
import Etablissements from "@/pages/etablissements";
import Utilisateurs from "@/pages/utilisateurs";
import Parents from "@/pages/parents";
import DetailParent from "@/pages/detail-parent";
import MonEtablissement from "@/pages/mon-etablissement";
import EleveListe from "@/pages/eleves";
import EleveForm from "@/pages/eleve-form";
import EleveDetail from "@/pages/eleve-detail";
import Censeurs from "@/pages/censeurs";
import Classes from "@/pages/classes";
import ClasseDetail from "@/pages/classe-detail";
import AnneesScolaires from "@/pages/annees-scolaires";
import Filieres from "@/pages/filieres";
import EnConstruction from "@/pages/en-construction";
import Professeurs from "@/pages/professeurs";
import EmploiDuTemps from "@/pages/emploi-du-temps";
import ProfesseurDashboard from "@/pages/professeur-dashboard";
import FaireAppel from "@/pages/faire-appel";
import CahierTextesProfPage from "@/pages/cahier-textes-prof";
import SaisieNotes from "@/pages/saisie-notes";
import NoteEleveDetail from "@/pages/note-eleve-detail";
import MatiereConfig from "@/pages/matiere-config";
import GestionMatieres from "@/pages/matieres/GestionMatieres";
import MatieresByClasse from "@/pages/matieres/MatieresByClasse";
import BulletinGestion from "@/pages/bulletin-gestion";
import BulletinDetail from "@/pages/bulletin-detail";
import MesBulletins from "@/pages/mes-bulletins";
import PublicationBulletins from "@/pages/publication-bulletins";
import BulletinsParent from "@/pages/bulletins-parent";
import ConseilClasse from "@/pages/conseil-classe";
import ConseilSalle from "@/pages/conseil-salle";
import ConseilResultats from "@/pages/conseil-resultats";
import AbsenceGestion from "@/pages/absence-gestion";
import AbsencesParent from "@/pages/absences-parent";
import MesAbsences from "@/pages/mes-absences";
import ConfigAbsences from "@/pages/config-absences";
import SaisieDemiJournee from "@/pages/saisie-demi-journee";
import AlertesAbsences from "@/pages/alertes-absences";
import NotificationsCentre from "@/pages/notifications-centre";
import ParentDashboard from "@/pages/parent-dashboard";
import SuiviScolaire from "@/pages/suivi-scolaire";
import Messagerie from "@/pages/messagerie";
import RendezVousParent from "@/pages/rendez-vous-parent";
import CommunicationDashboard from "@/pages/communication-dashboard";
import FormulaireAnnonce from "@/pages/formulaire-annonce";
import FilAnnonces from "@/pages/fil-annonces";
import ExamensDashboard from "@/pages/examens-dashboard";
import BibliothequeSujets from "@/pages/bibliotheque-sujets";
import EpreuvesBlanches from "@/pages/epreuves-blanches";
import PlanningRevision from "@/pages/planning-revision";
import ResultatsProgression from "@/pages/resultats-progression";
import CatalogueBibliotheque from "@/pages/catalogue-bibliotheque";
import DetailRessource from "@/pages/detail-ressource";
import MesRessources from "@/pages/mes-ressources";
import DepotRessource from "@/pages/depot-ressource";
import AdminBibliotheque from "@/pages/admin-bibliotheque";
import InfirmerieDashboard from "@/pages/infirmerie-dashboard";
import NouvelleConsultation from "@/pages/nouvelle-consultation";
import GestionConsultation from "@/pages/gestion-consultation";
import DossiersMedicaux from "@/pages/dossiers-medicaux";
import StocksInfirmerie from "@/pages/stocks-infirmerie";
import ConsultationParent from "@/pages/consultation-parent";
import ConsultationsInfirmerie from "@/pages/consultations-infirmerie";
import CatalogueClubs from "@/pages/catalogue-clubs";
import DetailClub from "@/pages/detail-club";
import MesClubs from "@/pages/mes-clubs";
import GestionActivite from "@/pages/gestion-activite";
import AdminClubs from "@/pages/admin-clubs";
import NouveauClub from "@/pages/nouveau-club";
import NouvelleActivite from "@/pages/nouvelle-activite";
import DashboardAnalytique from "@/pages/dashboard-analytique";
import AnalysePedagogique from "@/pages/analyse-pedagogique";
import AnalysePresences from "@/pages/analyse-presences";
import DashboardProfesseurAnalytique from "@/pages/dashboard-professeur-analytique";
import RapportsExports from "@/pages/rapports-exports";
import IncidentGestion from "@/pages/educateur/IncidentGestion";
import IncidentDetail from "@/pages/educateur/IncidentDetail";
import HistoriqueDisciplinaire from "@/pages/educateur/HistoriqueDisciplinaire";
import DisciplineStats from "@/pages/educateur/DisciplineStats";
import { SaasRoute } from "@/components/SaasRoute";
import SaasDashboard from "@/pages/saas/SaasDashboard";
import GestionEtablissements from "@/pages/saas/GestionEtablissements";
import FicheEtablissement from "@/pages/saas/FicheEtablissement";
import GestionLicences from "@/pages/saas/GestionLicences";
import LogsSaas from "@/pages/saas/LogsSaas";
import ScolariteDashboard from "@/pages/scolarite-dashboard";
import ScolariteClasse from "@/pages/scolarite-classe";
import ScolariteEleve from "@/pages/scolarite-eleve";
import PaiementForm from "@/pages/paiement-form";
import FraisConfig from "@/pages/frais-config";
import ScolariteParent from "@/pages/scolarite-parent";
import RecuPaiement from "@/pages/recu-paiement";
import DashboardFinancier from "@/pages/finances/DashboardFinancier";
import GestionHonoraires from "@/pages/finances/GestionHonoraires";
import MaFeuilleHeures from "@/pages/finances/MaFeuilleHeures";
import GestionPrestations from "@/pages/finances/GestionPrestations";
import FacturesParent from "@/pages/finances/FacturesParent";
import DashboardCloture from "@/pages/cloture/DashboardCloture";
import ConfigurationCriteres from "@/pages/cloture/ConfigurationCriteres";
import DecisionsClasse from "@/pages/cloture/DecisionsClasse";
import ValidationPromotion from "@/pages/cloture/ValidationPromotion";
import ResultatsAnnuels from "@/pages/cloture/ResultatsAnnuels";
import DashboardEleve from "@/pages/dashboard-eleve";
import MonProfil from "@/pages/mon-profil";
import GestionSalles from "@/pages/salles/GestionSalles";
import MonEdtProf from "@/pages/mon-edt-prof";
import MonEdtEleve from "@/pages/mon-edt-eleve";
import EdtParent from "@/pages/edt-parent";
import ConfigEvaluations from "@/pages/config-evaluations";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      
      {/* Protected Routes */}
      <Route path="/premier-login">
        <ProtectedRoute>
          <PremierLogin />
        </ProtectedRoute>
      </Route>

      <Route path="/dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/etablissements">
        <ProtectedRoute>
          <DashboardLayout>
            <Etablissements />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/utilisateurs">
        <ProtectedRoute>
          <DashboardLayout>
            <Utilisateurs />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/parents">
        <ProtectedRoute>
          <DashboardLayout>
            <Parents />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/parents/detail/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <DetailParent />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/mon-etablissement">
        <ProtectedRoute>
          <DashboardLayout>
            <MonEtablissement />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/eleves/inscrire">
        <ProtectedRoute>
          <DashboardLayout>
            <EleveForm />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/eleves/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <EleveDetail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/eleves">
        <ProtectedRoute>
          <DashboardLayout>
            <EleveListe />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/censeurs">
        <ProtectedRoute>
          <DashboardLayout>
            <Censeurs />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/professeurs">
        <ProtectedRoute>
          <DashboardLayout>
            <Professeurs />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/classes/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <ClasseDetail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/classes">
        <ProtectedRoute>
          <DashboardLayout>
            <Classes />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/annees-scolaires">
        <ProtectedRoute>
          <DashboardLayout>
            <AnneesScolaires />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/filieres">
        <ProtectedRoute>
          <DashboardLayout>
            <Filieres />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/emploi-du-temps">
        <ProtectedRoute>
          <DashboardLayout>
            <EmploiDuTemps />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/mon-edt">
        <ProtectedRoute>
          <DashboardLayout>
            <MonEdtProf />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/mon-edt-eleve">
        <ProtectedRoute>
          <DashboardLayout>
            <MonEdtEleve />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/edt-parent">
        <ProtectedRoute>
          <DashboardLayout>
            <EdtParent />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ── Module 06 : Espace Professeur ── */}
      <Route path="/mes-classes">
        <ProtectedRoute>
          <DashboardLayout>
            <ProfesseurDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/appel">
        <ProtectedRoute>
          <DashboardLayout>
            <FaireAppel />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/cahier-de-textes">
        <ProtectedRoute>
          <DashboardLayout>
            <CahierTextesProfPage />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/evaluations">
        <ProtectedRoute>
          <DashboardLayout>
            <SaisieNotes />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/notes/eleve/:eleveId">
        <ProtectedRoute>
          <DashboardLayout>
            <NoteEleveDetail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/notes/classe/:classeId">
        <ProtectedRoute>
          <DashboardLayout>
            <SaisieNotes />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ── Module 04-B : Matières & Coefficients ── */}
      <Route path="/matieres">
        <ProtectedRoute>
          <DashboardLayout>
            <GestionMatieres />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/matieres/classe">
        <ProtectedRoute>
          <DashboardLayout>
            <MatieresByClasse />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ── Module 07 : Notes & Bulletins ── */}
      <Route path="/matieres-config">
        <ProtectedRoute>
          <DashboardLayout>
            <MatiereConfig />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/config-evaluations">
        <ProtectedRoute>
          <DashboardLayout>
            <ConfigEvaluations />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/bulletins/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <BulletinDetail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/bulletins">
        <ProtectedRoute>
          <DashboardLayout>
            <BulletinGestion />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/mes-bulletins">
        <ProtectedRoute>
          <DashboardLayout>
            <MesBulletins />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/publication-bulletins">
        <ProtectedRoute>
          <DashboardLayout>
            <PublicationBulletins />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/bulletins-parent">
        <ProtectedRoute>
          <DashboardLayout>
            <BulletinsParent />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/conseils-classe">
        <ProtectedRoute>
          <DashboardLayout>
            <ConseilClasse />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/conseils-classe/salle/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <ConseilSalle />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/conseils-classe/resultats/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <ConseilResultats />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ── Module 08 : Présences & Absences ── */}
      <Route path="/absences">
        <ProtectedRoute>
          <DashboardLayout>
            <AbsenceGestion />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/config-absences">
        <ProtectedRoute>
          <DashboardLayout>
            <ConfigAbsences />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/saisie-demi-journee">
        <ProtectedRoute>
          <DashboardLayout>
            <SaisieDemiJournee />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/alertes-absences">
        <ProtectedRoute>
          <DashboardLayout>
            <AlertesAbsences />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/absences-parent">
        <ProtectedRoute>
          <DashboardLayout>
            <AbsencesParent />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/mes-absences">
        <ProtectedRoute>
          <DashboardLayout>
            <MesAbsences />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/notifications">
        <ProtectedRoute>
          <DashboardLayout>
            <NotificationsCentre />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ── Module 11 : Portail Parents ── */}
      <Route path="/parent-dashboard">
        <ProtectedRoute>
          <DashboardLayout>
            <ParentDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/suivi-scolaire">
        <ProtectedRoute>
          <DashboardLayout>
            <SuiviScolaire />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/messagerie">
        <ProtectedRoute>
          <DashboardLayout>
            <Messagerie />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/rendez-vous">
        <ProtectedRoute>
          <DashboardLayout>
            <RendezVousParent />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ── Module 12 : Communication & Annonces ── */}
      <Route path="/annonces/creer">
        <ProtectedRoute>
          <DashboardLayout>
            <FormulaireAnnonce />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/annonces/:id/editer">
        <ProtectedRoute>
          <DashboardLayout>
            <FormulaireAnnonce />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/annonces">
        <ProtectedRoute>
          <DashboardLayout>
            <CommunicationDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/fil-annonces">
        <ProtectedRoute>
          <DashboardLayout>
            <FilAnnonces />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/examens">
        <ProtectedRoute>
          <DashboardLayout>
            <ExamensDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/bibliotheque-sujets">
        <ProtectedRoute>
          <DashboardLayout>
            <BibliothequeSujets />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/epreuves-blanches">
        <ProtectedRoute>
          <DashboardLayout>
            <EpreuvesBlanches />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/planning-revision">
        <ProtectedRoute>
          <DashboardLayout>
            <PlanningRevision />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/resultats-progression">
        <ProtectedRoute>
          <DashboardLayout>
            <ResultatsProgression />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/bibliotheque">
        <ProtectedRoute>
          <DashboardLayout>
            <CatalogueBibliotheque />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/bibliotheque/ressource/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <DetailRessource />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/mes-ressources">
        <ProtectedRoute>
          <DashboardLayout>
            <MesRessources />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/depot-ressource">
        <ProtectedRoute>
          <DashboardLayout>
            <DepotRessource />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin-bibliotheque">
        <ProtectedRoute>
          <DashboardLayout>
            <AdminBibliotheque />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Infirmerie */}
      <Route path="/infirmerie/nouvelle-consultation">
        <ProtectedRoute>
          <DashboardLayout>
            <NouvelleConsultation />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/infirmerie/consultation/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <GestionConsultation />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/infirmerie/consultations">
        <ProtectedRoute>
          <DashboardLayout>
            <ConsultationsInfirmerie />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/infirmerie/dossier/:eleveId">
        <ProtectedRoute>
          <DashboardLayout>
            <DossiersMedicaux />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/infirmerie/dossiers">
        <ProtectedRoute>
          <DashboardLayout>
            <DossiersMedicaux />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/infirmerie/stocks">
        <ProtectedRoute>
          <DashboardLayout>
            <StocksInfirmerie />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/infirmerie/parent">
        <ProtectedRoute>
          <DashboardLayout>
            <ConsultationParent />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/infirmerie">
        <ProtectedRoute>
          <DashboardLayout>
            <InfirmerieDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ── Module 18 : Tableau de Bord Analytique ── */}
      <Route path="/analytics">
        <ProtectedRoute>
          <DashboardLayout>
            <DashboardAnalytique />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/analyse-pedagogique">
        <ProtectedRoute>
          <DashboardLayout>
            <AnalysePedagogique />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/analyse-presences">
        <ProtectedRoute>
          <DashboardLayout>
            <AnalysePresences />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/analytics-professeur">
        <ProtectedRoute>
          <DashboardLayout>
            <DashboardProfesseurAnalytique />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/rapports-exports">
        <ProtectedRoute>
          <DashboardLayout>
            <RapportsExports />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ── Module Discipline ── */}
      <Route path="/discipline/historique/:eleveId">
        <ProtectedRoute>
          <DashboardLayout>
            <HistoriqueDisciplinaire />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/discipline/stats">
        <ProtectedRoute>
          <DashboardLayout>
            <DisciplineStats />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/discipline/incidents/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <IncidentDetail />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/discipline/sanctions">
        <ProtectedRoute>
          <DashboardLayout>
            <IncidentGestion />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/discipline/incidents">
        <ProtectedRoute>
          <DashboardLayout>
            <IncidentGestion />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ── Module 17 : Clubs & Activités Parascolaires ── */}
      <Route path="/clubs/nouveau">
        <ProtectedRoute>
          <DashboardLayout>
            <NouveauClub />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clubs/:clubId/nouvelle-activite">
        <ProtectedRoute>
          <DashboardLayout>
            <NouvelleActivite />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clubs/activite/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <GestionActivite />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/admin-clubs">
        <ProtectedRoute>
          <DashboardLayout>
            <AdminClubs />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/mes-clubs">
        <ProtectedRoute>
          <DashboardLayout>
            <MesClubs />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clubs/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <DetailClub />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/clubs">
        <ProtectedRoute>
          <DashboardLayout>
            <CatalogueClubs />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* ─── Module 10 — Scolarité ──────────────────────────────── */}
      <Route path="/scolarite/recu/:id">
        <ProtectedRoute>
          <DashboardLayout>
            <RecuPaiement />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scolarite/eleve/:eleveId">
        <ProtectedRoute>
          <DashboardLayout>
            <ScolariteEleve />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scolarite/classe/:classeId">
        <ProtectedRoute>
          <DashboardLayout>
            <ScolariteClasse />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scolarite/classe">
        <ProtectedRoute>
          <DashboardLayout>
            <ScolariteClasse />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scolarite/paiement">
        <ProtectedRoute>
          <DashboardLayout>
            <PaiementForm />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scolarite/frais-config">
        <ProtectedRoute>
          <DashboardLayout>
            <FraisConfig />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scolarite/impayes">
        <ProtectedRoute>
          <DashboardLayout>
            <ScolariteClasse />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scolarite/caisse">
        <ProtectedRoute>
          <DashboardLayout>
            <ScolariteDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scolarite">
        <ProtectedRoute>
          <DashboardLayout>
            <ScolariteDashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/scolarite-parent">
        <ProtectedRoute>
          <DashboardLayout>
            <ScolariteParent />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Modules en construction — tous les liens de la sidebar */}
      {[
        "/licences", "/statistiques",
        "/rapports",
        "/notes", "/mon-enfant",
      ].map((path) => (
        <Route key={path} path={path}>
          <ProtectedRoute>
            <DashboardLayout>
              <EnConstruction />
            </DashboardLayout>
          </ProtectedRoute>
        </Route>
      ))}

      <Route path="/">
        <ProtectedRoute>
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Routes Module 10 — Finances */}
      <Route path="/finances/honoraires">
        <ProtectedRoute>
          <DashboardLayout><GestionHonoraires /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/finances/prestations">
        <ProtectedRoute>
          <DashboardLayout><GestionPrestations /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/finances/ma-feuille">
        <ProtectedRoute>
          <DashboardLayout><MaFeuilleHeures /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/finances/mes-factures">
        <ProtectedRoute>
          <DashboardLayout><FacturesParent /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/finances">
        <ProtectedRoute>
          <DashboardLayout><DashboardFinancier /></DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Routes Module 03-B — Clôture d'année */}
      <Route path="/cloture/criteres">
        <ProtectedRoute>
          <DashboardLayout><ConfigurationCriteres /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/cloture/decisions/:classeId">
        <ProtectedRoute>
          <DashboardLayout><DecisionsClasse /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/cloture/promotion">
        <ProtectedRoute>
          <DashboardLayout><ValidationPromotion /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/cloture/resultats">
        <ProtectedRoute>
          <DashboardLayout><ResultatsAnnuels /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/cloture/decisions">
        <ProtectedRoute>
          <DashboardLayout><DashboardCloture /></DashboardLayout>
        </ProtectedRoute>
      </Route>
      <Route path="/cloture">
        <ProtectedRoute>
          <DashboardLayout><DashboardCloture /></DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/eleve/dashboard">
        <ProtectedRoute>
          <DashboardLayout><DashboardEleve /></DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/profil">
        <ProtectedRoute>
          <DashboardLayout><MonProfil /></DashboardLayout>
        </ProtectedRoute>
      </Route>

      <Route path="/salles">
        <ProtectedRoute>
          <DashboardLayout><GestionSalles /></DashboardLayout>
        </ProtectedRoute>
      </Route>

      {/* Routes Admin SaaS — rôle dev uniquement */}
      <Route path="/saas/etablissements/:id">
        <SaasRoute><FicheEtablissement /></SaasRoute>
      </Route>
      <Route path="/saas/etablissements">
        <SaasRoute><GestionEtablissements /></SaasRoute>
      </Route>
      <Route path="/saas/licences">
        <SaasRoute><GestionLicences /></SaasRoute>
      </Route>
      <Route path="/saas/logs">
        <SaasRoute><LogsSaas /></SaasRoute>
      </Route>
      <Route path="/saas">
        <SaasRoute><SaasDashboard /></SaasRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="m15-theme">
        <TooltipProvider>
          <AuthProvider>
            {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
            <InstallBanner />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
