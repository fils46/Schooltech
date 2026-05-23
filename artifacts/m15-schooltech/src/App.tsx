import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Pages
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import ForgotPassword from "@/pages/forgot-password";
import ResetPassword from "@/pages/reset-password";
import PremierLogin from "@/pages/premier-login";
import Dashboard from "@/pages/dashboard";
import Etablissements from "@/pages/etablissements";
import Utilisateurs from "@/pages/utilisateurs";
import EleveListe from "@/pages/eleves";
import EleveForm from "@/pages/eleve-form";
import EleveDetail from "@/pages/eleve-detail";
import Censeurs from "@/pages/censeurs";
import Classes from "@/pages/classes";
import ClasseDetail from "@/pages/classe-detail";
import AnneesScolaires from "@/pages/annees-scolaires";
import Filieres from "@/pages/filieres";
import EnConstruction from "@/pages/en-construction";
import EmploiDuTemps from "@/pages/emploi-du-temps";
import ProfesseurDashboard from "@/pages/professeur-dashboard";
import FaireAppel from "@/pages/faire-appel";
import CahierTextesProfPage from "@/pages/cahier-textes-prof";
import SaisieNotes from "@/pages/saisie-notes";
import NoteEleveDetail from "@/pages/note-eleve-detail";
import MatiereConfig from "@/pages/matiere-config";
import BulletinGestion from "@/pages/bulletin-gestion";
import BulletinDetail from "@/pages/bulletin-detail";
import MesBulletins from "@/pages/mes-bulletins";
import ConseilClasse from "@/pages/conseil-classe";
import ConseilSalle from "@/pages/conseil-salle";
import ConseilResultats from "@/pages/conseil-resultats";
import AbsenceGestion from "@/pages/absence-gestion";
import AbsencesParent from "@/pages/absences-parent";
import MesAbsences from "@/pages/mes-absences";
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

      {/* ── Module 07 : Notes & Bulletins ── */}
      <Route path="/matieres-config">
        <ProtectedRoute>
          <DashboardLayout>
            <MatiereConfig />
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

      {/* Modules en construction — tous les liens de la sidebar */}
      {[
        "/licences", "/statistiques",
        "/paiements", "/rapports",
        "/professeurs",
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

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="m15-theme">
        <TooltipProvider>
          <AuthProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <Router />
            </WouterRouter>
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
