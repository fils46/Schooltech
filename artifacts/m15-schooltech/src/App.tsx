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
import EnConstruction from "@/pages/en-construction";

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

      {/* Modules en construction — tous les liens de la sidebar */}
      {[
        "/licences", "/statistiques",
        "/censeurs", "/classes", "/paiements", "/rapports",
        "/professeurs", "/eleves", "/emploi-du-temps", "/absences",
        "/mes-classes", "/evaluations", "/cahier-de-textes", "/appel", "/messages",
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
