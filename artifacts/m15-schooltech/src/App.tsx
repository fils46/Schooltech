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

      {/* Modules en construction — tous les liens de la sidebar */}
      {[
        "/licences", "/statistiques",
        "/paiements", "/rapports",
        "/professeurs", "/absences",
        "/messages",
        "/notes", "/bibliotheque", "/mon-enfant",
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
