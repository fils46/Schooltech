import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useGetNotificationsCount, getGetNotificationsCountQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { useTheme } from "@/components/theme-provider";
import {
  Building, Users, Key, BarChart3, LayoutDashboard, UsersRound, CreditCard,
  FileText, GraduationCap, UserSquare, Calendar, UserMinus, BookOpen,
  FileCheck, Book, ClipboardList, MessageSquare, Award, Library, UserCircle,
  Menu, Moon, Sun, LogOut, Bell, Search, ChevronRight, CalendarDays, Layers,
  BookMarked, FileSpreadsheet, CalendarCheck, Megaphone,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

/* ─── NAV CONFIG avec sections ─────────────────────────────── */
type NavLink = { label: string; href: string; icon: React.ElementType };
type Section = { title: string; links: NavLink[] };

const navConfig: Record<string, Section[]> = {
  dev: [
    {
      title: "PRINCIPAL",
      links: [
        { label: "Tableau de bord", href: "/dashboard",      icon: LayoutDashboard },
        { label: "Établissements",  href: "/etablissements", icon: Building },
        { label: "Utilisateurs",    href: "/utilisateurs",   icon: Users },
      ],
    },
    {
      title: "ACADÉMIQUE",
      links: [
        { label: "Élèves",           href: "/eleves",           icon: UserSquare },
        { label: "Classes",          href: "/classes",          icon: UsersRound },
        { label: "Années scolaires", href: "/annees-scolaires", icon: CalendarDays },
        { label: "Filières",         href: "/filieres",         icon: Layers },
        { label: "Emploi du temps",  href: "/emploi-du-temps",  icon: Calendar },
      ],
    },
    {
      title: "BULLETINS",
      links: [
        { label: "Config. matières", href: "/matieres-config",  icon: BookMarked },
        { label: "Bulletins",        href: "/bulletins",        icon: FileSpreadsheet },
        { label: "Conseils classe",  href: "/conseils-classe",  icon: UsersRound },
      ],
    },
    {
      title: "GESTION",
      links: [
        { label: "Licences",       href: "/licences",       icon: Key },
        { label: "Statistiques",   href: "/statistiques",   icon: BarChart3 },
      ],
    },
    {
      title: "COMMUNICATION",
      links: [
        { label: "Annonces",       href: "/annonces",       icon: Megaphone },
        { label: "Messagerie",     href: "/messagerie",     icon: MessageSquare },
        { label: "Notifications",  href: "/notifications",  icon: Bell },
      ],
    },
  ],
  directeur: [
    {
      title: "PRINCIPAL",
      links: [
        { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "ACADÉMIQUE",
      links: [
        { label: "Censeurs",         href: "/censeurs",         icon: Users },
        { label: "Classes",          href: "/classes",          icon: UsersRound },
        { label: "Élèves",           href: "/eleves",           icon: UserSquare },
        { label: "Années scolaires", href: "/annees-scolaires", icon: CalendarDays },
        { label: "Filières",         href: "/filieres",         icon: Layers },
        { label: "Emploi du temps",  href: "/emploi-du-temps",  icon: Calendar },
      ],
    },
    {
      title: "BULLETINS",
      links: [
        { label: "Config. matières", href: "/matieres-config",  icon: BookMarked },
        { label: "Bulletins",        href: "/bulletins",        icon: FileSpreadsheet },
        { label: "Conseils classe",  href: "/conseils-classe",  icon: UsersRound },
      ],
    },
    {
      title: "GESTION",
      links: [
        { label: "Paiements", href: "/paiements", icon: CreditCard },
        { label: "Rapports",  href: "/rapports",  icon: FileText },
      ],
    },
    {
      title: "COMMUNICATION",
      links: [
        { label: "Annonces",      href: "/annonces",      icon: Megaphone },
        { label: "Messagerie",    href: "/messagerie",    icon: MessageSquare },
        { label: "Notifications", href: "/notifications", icon: Bell },
      ],
    },
  ],
  censeur: [
    {
      title: "ACADÉMIQUE",
      links: [
        { label: "Classes",         href: "/classes",         icon: UsersRound },
        { label: "Professeurs",     href: "/professeurs",     icon: GraduationCap },
        { label: "Élèves",          href: "/eleves",          icon: UserSquare },
      ],
    },
    {
      title: "BULLETINS",
      links: [
        { label: "Config. matières", href: "/matieres-config",  icon: BookMarked },
        { label: "Bulletins",        href: "/bulletins",        icon: FileSpreadsheet },
        { label: "Conseils classe",  href: "/conseils-classe",  icon: UsersRound },
      ],
    },
    {
      title: "QUOTIDIEN",
      links: [
        { label: "Emploi du temps", href: "/emploi-du-temps", icon: Calendar },
        { label: "Absences",        href: "/absences",        icon: UserMinus },
      ],
    },
    {
      title: "COMMUNICATION",
      links: [
        { label: "Annonces",      href: "/annonces",      icon: Megaphone },
        { label: "Messagerie",    href: "/messagerie",    icon: MessageSquare },
        { label: "Notifications", href: "/notifications", icon: Bell },
      ],
    },
  ],
  professeur: [
    {
      title: "MES COURS",
      links: [
        { label: "Mes classes",      href: "/mes-classes",      icon: BookOpen },
        { label: "Évaluations",      href: "/evaluations",      icon: FileCheck },
        { label: "Cahier de textes", href: "/cahier-de-textes", icon: Book },
      ],
    },
    {
      title: "QUOTIDIEN",
      links: [
        { label: "Appel",    href: "/appel",    icon: ClipboardList },
      ],
    },
    {
      title: "COMMUNICATION",
      links: [
        { label: "Annonces",      href: "/fil-annonces", icon: Megaphone },
        { label: "Messagerie",    href: "/messagerie",   icon: MessageSquare },
        { label: "Notifications", href: "/notifications",icon: Bell },
      ],
    },
  ],
  eleve: [
    {
      title: "PRINCIPAL",
      links: [
        { label: "Tableau de bord", href: "/dashboard",     icon: LayoutDashboard },
        { label: "Mes bulletins",   href: "/mes-bulletins", icon: FileSpreadsheet },
        { label: "Notes",           href: "/notes",         icon: Award },
      ],
    },
    {
      title: "ÉCOLE",
      links: [
        { label: "Emploi du temps", href: "/emploi-du-temps", icon: Calendar },
        { label: "Mes absences",    href: "/mes-absences",    icon: UserMinus },
        { label: "Bibliothèque",    href: "/bibliotheque",    icon: Library },
      ],
    },
    {
      title: "COMMUNICATION",
      links: [
        { label: "Annonces",      href: "/fil-annonces",  icon: Megaphone },
        { label: "Messagerie",    href: "/messagerie",    icon: MessageSquare },
        { label: "Notifications", href: "/notifications", icon: Bell },
      ],
    },
  ],
  parent: [
    {
      title: "TABLEAU DE BORD",
      links: [
        { label: "Tableau de bord", href: "/parent-dashboard", icon: LayoutDashboard },
      ],
    },
    {
      title: "MON ENFANT",
      links: [
        { label: "Suivi scolaire",  href: "/suivi-scolaire",  icon: BookOpen },
        { label: "Bulletins",       href: "/mes-bulletins",   icon: FileSpreadsheet },
        { label: "Absences",        href: "/absences-parent", icon: UserMinus },
      ],
    },
    {
      title: "COMMUNICATION",
      links: [
        { label: "Annonces",      href: "/fil-annonces",  icon: Megaphone },
        { label: "Messagerie",    href: "/messagerie",    icon: MessageSquare },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Rendez-vous",   href: "/rendez-vous",   icon: CalendarCheck },
        { label: "Paiements",     href: "/paiements",     icon: CreditCard },
      ],
    },
  ],
};

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":        "Tableau de bord",
  "/etablissements":   "Établissements",
  "/utilisateurs":     "Utilisateurs",
  "/licences":         "Licences",
  "/statistiques":     "Statistiques",
  "/censeurs":         "Censeurs",
  "/classes":          "Classes",
  "/paiements":        "Paiements",
  "/rapports":         "Rapports",
  "/professeurs":      "Professeurs",
  "/eleves":           "Élèves",
  "/eleves/inscrire":  "Inscrire un élève",
  "/emploi-du-temps":  "Emploi du temps",
  "/absences":         "Gestion des Absences",
  "/mes-classes":      "Mes classes",
  "/evaluations":      "Évaluations",
  "/cahier-de-textes": "Cahier de textes",
  "/appel":            "Faire l'appel",
  "/messages":         "Messages",
  "/notes":            "Notes",
  "/notes/classe":     "Notes de la classe",
  "/notes/eleve":      "Relevé de notes",
  "/bibliotheque":     "Bibliothèque",
  "/mon-enfant":       "Mon enfant",
  "/annees-scolaires": "Années scolaires",
  "/filieres":         "Filières",
  "/matieres-config":  "Configuration des Matières",
  "/bulletins":        "Gestion des Bulletins",
  "/mes-bulletins":    "Mes Bulletins",
  "/conseils-classe":          "Conseils de Classe",
  "/conseils-classe/salle":    "Salle de Conseil",
  "/conseils-classe/resultats": "Résultats du Conseil",
  "/absences-parent":   "Absences de mon enfant",
  "/mes-absences":      "Mes Absences",
  "/notifications":     "Notifications",
  "/annonces":          "Annonces",
  "/annonces/creer":    "Nouvelle annonce",
  "/fil-annonces":      "Fil d'annonces",
  "/parent-dashboard":  "Tableau de bord",
  "/suivi-scolaire":    "Suivi scolaire",
  "/messagerie":        "Messagerie",
  "/rendez-vous":       "Rendez-vous",
};

const ROLE_LABELS: Record<string, string> = {
  dev:        "DÉVELOPPEUR",
  directeur:  "DIRECTEUR",
  censeur:    "CENSEUR",
  professeur: "PROFESSEUR",
  eleve:      "ÉLÈVE",
  parent:     "PARENT",
};

/* ─── Composant NavLinks ─────────────────────────────────── */
function NavLinks({ sections, location, onClose }: {
  sections: Section[];
  location: string;
  onClose: () => void;
}) {
  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title}>
          <p className="px-3 mb-2 text-xs font-semibold tracking-widest" style={{ color: "var(--m15-muted)", opacity: 0.7 }}>
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.links.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative"
                  style={{
                    color:       isActive ? "#00C9A7" : "var(--m15-muted)",
                    background:  isActive ? "rgba(0,201,167,0.08)" : "transparent",
                    borderLeft:  isActive ? "3px solid #00C9A7" : "3px solid transparent",
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = "var(--m15-white)";
                      (e.currentTarget as HTMLElement).style.background = "var(--elevate-2)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      (e.currentTarget as HTMLElement).style.color = "var(--m15-muted)";
                      (e.currentTarget as HTMLElement).style.background = "transparent";
                    }
                  }}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{link.label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto" style={{ color: "#00C9A7" }} />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Sidebar content ────────────────────────────────────── */
function SidebarContent({ location, onClose }: { location: string; onClose: () => void }) {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();

  const role = user?.role || "eleve";
  const sections = navConfig[role as keyof typeof navConfig] || [];
  const initials = `${user?.prenoms?.charAt(0) || ""}${user?.nom?.charAt(0) || ""}`.toUpperCase() || "U";

  const handleLogout = () => {
    onClose();
    logout();
    setLocation("/login");
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--m15-card)", borderRight: "1px solid var(--m15-border)" }}>
      {/* Logo */}
      <div className="p-6 pb-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(0,201,167,0.15)", border: "1px solid rgba(0,201,167,0.25)" }}>
            <GraduationCap className="w-5 h-5" style={{ color: "#00C9A7" }} />
          </div>
          <div>
            <span className="font-bold text-base" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              M15-SchoolTech
            </span>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>v1.0 — Collège & Lycée</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-4 pt-5">
        <NavLinks sections={sections} location={location} onClose={onClose} />
      </nav>

      {/* Avatar utilisateur */}
      <div className="p-4" style={{ borderTop: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-3 p-3 rounded-xl mb-3"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, #00C9A7, #0080FF)",
              color: "#fff",
              fontFamily: "'Syne', sans-serif",
            }}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" style={{ color: "var(--m15-white)" }}>
              {user?.prenoms} {user?.nom}
            </p>
            <p className="text-xs font-semibold" style={{ color: "#00C9A7", letterSpacing: "0.06em" }}>
              {ROLE_LABELS[role] || role.toUpperCase()}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{
            background: "rgba(255,77,109,0.06)",
            border: "1px solid rgba(255,77,109,0.2)",
            color: "#FF4D6D",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,77,109,0.12)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,77,109,0.06)"; }}
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

/* ─── DashboardLayout principal ─────────────────────────── */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const socketRef = useRef<Socket | null>(null);

  const countQKey = getGetNotificationsCountQueryKey();
  const { data: countData } = useGetNotificationsCount({
    query: { queryKey: countQKey, enabled: !!user, refetchInterval: 30000 },
  });
  const notifCount: number = (countData as { count?: number })?.count ?? 0;

  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("m15_token");
    if (!token) return;

    const socket = io(window.location.origin, {
      path: "/api/socket.io",
      auth: { token },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("notification", () => {
      void qc.invalidateQueries({ queryKey: countQKey });
    });

    socket.on("badge_count", (n: number) => {
      qc.setQueryData(countQKey, { count: n });
    });

    return () => { socket.disconnect(); };
  }, [user?.id]);

  const pageTitle = PAGE_TITLES[location] || "M15-SchoolTech";

  return (
    <div className="flex min-h-screen w-full" style={{ background: "var(--m15-navy)" }}>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:block w-64 flex-shrink-0 h-screen sticky top-0">
        <SidebarContent location={location} onClose={() => {}} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Topbar ── */}
        <header className="sticky top-0 z-20 flex items-center justify-between px-4 md:px-6 h-16"
          style={{
            background: "var(--m15-navy2)",
            borderBottom: "1px solid var(--m15-border)",
          }}>
          {/* Gauche : hamburger mobile + titre */}
          <div className="flex items-center gap-4">
            <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
              <SheetTrigger asChild>
                <button className="md:hidden w-9 h-9 flex items-center justify-center rounded-xl transition-all"
                  style={{ background: "var(--elevate-2)", color: "var(--m15-white)" }}>
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 border-0">
                <SidebarContent location={location} onClose={() => setIsMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <h1 className="text-lg font-bold hidden sm:block" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              {pageTitle}
            </h1>
          </div>

          {/* Droite : recherche + notifs + toggle */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Barre de recherche */}
            <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl"
              style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", minWidth: "200px" }}>
              <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--m15-muted)" }} />
              <input
                type="search"
                placeholder="Rechercher..."
                className="bg-transparent text-sm outline-none w-full"
                style={{ color: "var(--m15-white)", fontFamily: "'DM Sans', sans-serif" }}
              />
            </div>

            {/* Cloche notifications */}
            <button
              onClick={() => setLocation("/notifications")}
              className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-all"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-white)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-muted)"; }}>
              <Bell className="w-4 h-4" />
              {notifCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                  style={{ background: "#FF4D6D", color: "#fff", fontSize: "10px" }}>
                  {notifCount > 9 ? "9+" : notifCount}
                </span>
              )}
            </button>

            {/* Toggle dark/light */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-white)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-muted)"; }}>
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* ── Contenu principal ── */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden page-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
}
