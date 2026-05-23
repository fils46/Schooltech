import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useTheme } from "@/components/theme-provider";
import { 
  Building, Users, Key, BarChart3, LayoutDashboard, UsersRound, CreditCard, 
  FileText, GraduationCap, UserSquare, Calendar, UserMinus, BookOpen, 
  FileCheck, Book, ClipboardList, MessageSquare, Award, Library, UserCircle,
  Menu, Moon, Sun, LogOut
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navConfig = {
  dev: [
    { label: "Établissements", href: "/etablissements", icon: Building },
    { label: "Utilisateurs", href: "/utilisateurs", icon: Users },
    { label: "Licences", href: "/licences", icon: Key },
    { label: "Statistiques", href: "/statistiques", icon: BarChart3 },
  ],
  directeur: [
    { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
    { label: "Censeurs", href: "/censeurs", icon: Users },
    { label: "Classes", href: "/classes", icon: UsersRound },
    { label: "Paiements", href: "/paiements", icon: CreditCard },
    { label: "Rapports", href: "/rapports", icon: FileText },
  ],
  censeur: [
    { label: "Classes", href: "/classes", icon: UsersRound },
    { label: "Professeurs", href: "/professeurs", icon: GraduationCap },
    { label: "Élèves", href: "/eleves", icon: UserSquare },
    { label: "Emploi du temps", href: "/emploi-du-temps", icon: Calendar },
    { label: "Absences", href: "/absences", icon: UserMinus },
  ],
  professeur: [
    { label: "Mes classes", href: "/mes-classes", icon: BookOpen },
    { label: "Évaluations", href: "/evaluations", icon: FileCheck },
    { label: "Cahier de textes", href: "/cahier-de-textes", icon: Book },
    { label: "Appel", href: "/appel", icon: ClipboardList },
    { label: "Messages", href: "/messages", icon: MessageSquare },
  ],
  eleve: [
    { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
    { label: "Notes", href: "/notes", icon: Award },
    { label: "Emploi du temps", href: "/emploi-du-temps", icon: Calendar },
    { label: "Absences", href: "/absences", icon: UserMinus },
    { label: "Bibliothèque", href: "/bibliotheque", icon: Library },
  ],
  parent: [
    { label: "Mon enfant", href: "/mon-enfant", icon: UserCircle },
    { label: "Notes", href: "/notes", icon: Award },
    { label: "Absences", href: "/absences", icon: UserMinus },
    { label: "Paiements", href: "/paiements", icon: CreditCard },
    { label: "Messages", href: "/messages", icon: MessageSquare },
  ],
};

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const role = user?.role || "eleve";
  const links = navConfig[role as keyof typeof navConfig] || [];

  const handleLogout = () => {
    logout();
    setLocation("/login");
  };

  const NavLinks = () => (
    <>
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = location === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={() => setIsMobileOpen(false)}
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-muted/40">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-r bg-card h-screen sticky top-0">
        <div className="p-6">
          <h2 className="text-2xl font-bold tracking-tight text-primary">
            M15-SchoolTech
          </h2>
        </div>
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <NavLinks />
        </nav>
        <div className="p-4 border-t">
          <div className="flex items-center gap-3 mb-4 px-2">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold">
              {user?.nom.charAt(0) || "U"}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium leading-none">{user?.nom} {user?.prenoms}</span>
              <span className="text-xs text-muted-foreground capitalize">{user?.role}</span>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        {/* Mobile Navbar & Top Navbar */}
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center md:hidden">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="w-5 h-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="p-6">
                  <h2 className="text-xl font-bold text-primary">M15-SchoolTech</h2>
                </div>
                <nav className="px-4 space-y-1">
                  <NavLinks />
                </nav>
              </SheetContent>
            </Sheet>
            <h2 className="ml-4 font-bold text-primary">M15</h2>
          </div>
          
          <div className="ml-auto flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
