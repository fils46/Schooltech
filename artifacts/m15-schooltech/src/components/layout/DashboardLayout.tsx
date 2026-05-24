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
  Target, ClipboardCheck, TrendingUp, Star, Clock, Upload,
  Heart, Stethoscope, Package,
  Trophy, Activity, Star as StarIcon,
  ShieldAlert, DollarSign, Banknote, Receipt,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/* ─── NAV CONFIG avec sections ─────────────────────────────── */
type NavLink = { label: string; href: string; icon: React.ElementType };
type Section = { title: string; links: NavLink[] };

const navConfig: Record<string, Section[]> = {
  directeur: [
    {
      title: "PRINCIPAL",
      links: [
        { label: "Tableau de bord",     href: "/dashboard",          icon: LayoutDashboard },
        { label: "Mon établissement",   href: "/mon-etablissement",  icon: Building },
        { label: "Équipe pédagogique",  href: "/utilisateurs",       icon: Users },
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
      title: "ANALYTIQUE",
      links: [
        { label: "Dashboard analytique",  href: "/analytics",            icon: BarChart3 },
        { label: "Analyse pédagogique",   href: "/analyse-pedagogique",  icon: TrendingUp },
        { label: "Analyse présences",     href: "/analyse-presences",    icon: UserMinus },
        { label: "Rapports & Exports",    href: "/rapports-exports",     icon: FileSpreadsheet },
      ],
    },
    {
      title: "SCOLARITÉ",
      links: [
        { label: "Tableau de bord",   href: "/scolarite",              icon: DollarSign },
        { label: "Suivi par classe",  href: "/scolarite/classe",       icon: Banknote },
        { label: "Enreg. paiement",   href: "/scolarite/paiement",     icon: CreditCard },
        { label: "Config. frais",     href: "/scolarite/frais-config", icon: Receipt },
        { label: "Rapport de caisse", href: "/scolarite/caisse",       icon: FileText },
      ],
    },
    {
      title: "EXAMENS",
      links: [
        { label: "Préparation examens", href: "/examens",              icon: Target },
        { label: "Sujets BEPC/BAC",     href: "/bibliotheque-sujets",  icon: BookOpen },
        { label: "Épreuves blanches",   href: "/epreuves-blanches",    icon: ClipboardCheck },
        { label: "Résultats",           href: "/resultats-progression",icon: TrendingUp },
      ],
    },
    {
      title: "INFIRMERIE",
      links: [
        { label: "Tableau de bord",   href: "/infirmerie",                    icon: Heart },
        { label: "Consultations",     href: "/infirmerie/consultations",      icon: Stethoscope },
        { label: "Dossiers médicaux", href: "/infirmerie/dossiers",           icon: FileText },
        { label: "Stocks médicaux",   href: "/infirmerie/stocks",             icon: Package },
      ],
    },
    {
      title: "CLUBS & ACTIVITÉS",
      links: [
        { label: "Catalogue clubs", href: "/clubs",       icon: Trophy },
        { label: "Administration",  href: "/admin-clubs", icon: Activity },
      ],
    },
    {
      title: "BIBLIOTHÈQUE",
      links: [
        { label: "Catalogue",      href: "/bibliotheque",       icon: Library },
        { label: "Administration", href: "/admin-bibliotheque", icon: BookMarked },
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
      title: "PRINCIPAL",
      links: [
        { label: "Tableau de bord",    href: "/dashboard",         icon: LayoutDashboard },
        { label: "Mon établissement",  href: "/mon-etablissement", icon: Building },
        { label: "Équipe pédagogique", href: "/utilisateurs",      icon: Users },
      ],
    },
    {
      title: "ANALYTIQUE",
      links: [
        { label: "Dashboard analytique", href: "/analytics",           icon: BarChart3 },
        { label: "Analyse pédagogique",  href: "/analyse-pedagogique", icon: TrendingUp },
        { label: "Analyse présences",    href: "/analyse-presences",   icon: UserMinus },
        { label: "Rapports",             href: "/rapports-exports",    icon: FileSpreadsheet },
      ],
    },
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
      title: "SCOLARITÉ",
      links: [
        { label: "Tableau de bord",  href: "/scolarite",          icon: DollarSign },
        { label: "Suivi par classe", href: "/scolarite/classe",   icon: Banknote },
        { label: "Enreg. paiement",  href: "/scolarite/paiement", icon: CreditCard },
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
      title: "EXAMENS",
      links: [
        { label: "Préparation examens", href: "/examens",              icon: Target },
        { label: "Sujets BEPC/BAC",     href: "/bibliotheque-sujets",  icon: BookOpen },
        { label: "Épreuves blanches",   href: "/epreuves-blanches",    icon: ClipboardCheck },
        { label: "Résultats",           href: "/resultats-progression",icon: TrendingUp },
      ],
    },
    {
      title: "INFIRMERIE",
      links: [
        { label: "Tableau de bord",   href: "/infirmerie",               icon: Heart },
        { label: "Consultations",     href: "/infirmerie/consultations", icon: Stethoscope },
        { label: "Dossiers médicaux", href: "/infirmerie/dossiers",      icon: FileText },
        { label: "Stocks médicaux",   href: "/infirmerie/stocks",        icon: Package },
      ],
    },
    {
      title: "CLUBS & ACTIVITÉS",
      links: [
        { label: "Catalogue clubs", href: "/clubs",       icon: Trophy },
        { label: "Administration",  href: "/admin-clubs", icon: Activity },
      ],
    },
    {
      title: "BIBLIOTHÈQUE",
      links: [
        { label: "Catalogue",      href: "/bibliotheque",       icon: Library },
        { label: "Administration", href: "/admin-bibliotheque", icon: BookMarked },
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
      title: "MON ANALYTIQUE",
      links: [
        { label: "Tableau de bord", href: "/analytics-professeur", icon: BarChart3 },
      ],
    },
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
      title: "EXAMENS",
      links: [
        { label: "Sujets BEPC/BAC",   href: "/bibliotheque-sujets",  icon: BookOpen },
        { label: "Épreuves blanches",  href: "/epreuves-blanches",    icon: ClipboardCheck },
        { label: "Résultats classe",   href: "/resultats-progression",icon: TrendingUp },
      ],
    },
    {
      title: "CLUBS & ACTIVITÉS",
      links: [
        { label: "Catalogue clubs", href: "/clubs",       icon: Trophy },
        { label: "Administration",  href: "/admin-clubs", icon: Activity },
      ],
    },
    {
      title: "BIBLIOTHÈQUE",
      links: [
        { label: "Catalogue",    href: "/bibliotheque",   icon: Library },
        { label: "Mes dépôts",   href: "/depot-ressource",icon: Upload },
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
      title: "EXAMENS",
      links: [
        { label: "Préparation",     href: "/examens",              icon: Target },
        { label: "Sujets BEPC/BAC", href: "/bibliotheque-sujets",  icon: BookOpen },
        { label: "Épreuves blanches",href: "/epreuves-blanches",   icon: ClipboardCheck },
        { label: "Mon planning",    href: "/planning-revision",    icon: Calendar },
        { label: "Mes résultats",   href: "/resultats-progression",icon: TrendingUp },
      ],
    },
    {
      title: "CLUBS & ACTIVITÉS",
      links: [
        { label: "Catalogue clubs", href: "/clubs",     icon: Trophy },
        { label: "Mes clubs",       href: "/mes-clubs", icon: StarIcon },
      ],
    },
    {
      title: "BIBLIOTHÈQUE",
      links: [
        { label: "Catalogue",  href: "/bibliotheque",  icon: Library },
        { label: "Favoris",    href: "/mes-ressources", icon: Star },
        { label: "Historique", href: "/mes-ressources", icon: Clock },
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
  educateur: [
    {
      title: "TABLEAU DE BORD",
      links: [
        { label: "Incidents",        href: "/discipline/incidents", icon: ShieldAlert },
        { label: "Sanctions",        href: "/discipline/sanctions", icon: ClipboardList },
        { label: "Statistiques",     href: "/discipline/stats",     icon: BarChart3 },
      ],
    },
    {
      title: "SUIVI",
      links: [
        { label: "Absences (lecture)", href: "/absences",          icon: UserMinus },
        { label: "Cahier de textes",   href: "/cahier-de-textes", icon: BookOpen },
      ],
    },
    {
      title: "COMMUNICATION",
      links: [
        { label: "Messagerie",    href: "/messagerie",    icon: MessageSquare },
        { label: "Notifications", href: "/notifications", icon: Bell },
      ],
    },
  ],
  infirmier: [
    {
      title: "INFIRMERIE",
      links: [
        { label: "Tableau de bord",      href: "/infirmerie",                       icon: Heart },
        { label: "Nouvelle consultation", href: "/infirmerie/nouvelle-consultation", icon: Stethoscope },
        { label: "Toutes les consult.",  href: "/infirmerie/consultations",         icon: ClipboardList },
        { label: "Dossiers médicaux",    href: "/infirmerie/dossiers",              icon: FileText },
        { label: "Stocks médicaux",      href: "/infirmerie/stocks",                icon: Package },
      ],
    },
    {
      title: "COMMUNICATION",
      links: [
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
      title: "EXAMENS",
      links: [
        { label: "Sujets BEPC/BAC",    href: "/bibliotheque-sujets",  icon: BookOpen },
        { label: "Épreuves blanches",  href: "/epreuves-blanches",    icon: ClipboardCheck },
        { label: "Résultats enfant",   href: "/resultats-progression",icon: TrendingUp },
      ],
    },
    {
      title: "BIBLIOTHÈQUE",
      links: [
        { label: "Catalogue",  href: "/bibliotheque",   icon: Library },
        { label: "Favoris",    href: "/mes-ressources", icon: Star },
        { label: "Historique", href: "/mes-ressources", icon: Clock },
      ],
    },
    {
      title: "INFIRMERIE",
      links: [
        { label: "Consultations enfant", href: "/infirmerie/parent", icon: Heart },
      ],
    },
    {
      title: "CLUBS & ACTIVITÉS",
      links: [
        { label: "Clubs de mon enfant", href: "/clubs", icon: Trophy },
      ],
    },
    {
      title: "SCOLARITÉ",
      links: [
        { label: "Ma scolarité", href: "/scolarite-parent", icon: DollarSign },
      ],
    },
    {
      title: "COMMUNICATION",
      links: [
        { label: "Annonces",      href: "/fil-annonces",  icon: Megaphone },
        { label: "Messagerie",    href: "/messagerie",    icon: MessageSquare },
        { label: "Notifications", href: "/notifications", icon: Bell },
        { label: "Rendez-vous",   href: "/rendez-vous",   icon: CalendarCheck },
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
  "/paiements":              "Paiements",
  "/rapports":               "Rapports",
  "/scolarite":              "Scolarité — Tableau de bord",
  "/scolarite/classe":       "Scolarité par classe",
  "/scolarite/paiement":     "Enregistrer un paiement",
  "/scolarite/frais-config": "Configuration des frais",
  "/scolarite/caisse":       "Rapport de caisse",
  "/scolarite-parent":       "Ma scolarité",
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
  "/rendez-vous":             "Rendez-vous",
  "/examens":                 "Préparation aux Examens",
  "/bibliotheque-sujets":     "Bibliothèque de Sujets",
  "/epreuves-blanches":       "Épreuves Blanches",
  "/planning-revision":       "Planning de Révision",
  "/resultats-progression":   "Résultats & Progression",
  "/bibliotheque":            "Bibliothèque numérique",
  "/mes-ressources":          "Mes Ressources",
  "/depot-ressource":         "Mes Dépôts",
  "/admin-bibliotheque":      "Administration Bibliothèque",
  "/infirmerie":                         "Infirmerie — Tableau de bord",
  "/infirmerie/nouvelle-consultation":   "Nouvelle consultation",
  "/infirmerie/consultations":           "Consultations",
  "/infirmerie/dossiers":                "Dossiers médicaux",
  "/infirmerie/stocks":                  "Stocks infirmerie",
  "/infirmerie/parent":                  "Infirmerie — Mon enfant",
  "/clubs":             "Clubs & Activités",
  "/clubs/nouveau":     "Créer un club",
  "/mes-clubs":         "Mes clubs",
  "/admin-clubs":       "Administration — Clubs",
  "/analytics":                 "Tableau de bord analytique",
  "/analyse-pedagogique":       "Analyse pédagogique",
  "/analyse-presences":         "Analyse des présences",
  "/analytics-professeur":      "Mon tableau de bord analytique",
  "/rapports-exports":          "Rapports & Exports",
  "/analytics-complementaires": "Analytics — Clubs & Infirmerie",
  "/discipline/incidents":  "Gestion des Incidents",
  "/discipline/sanctions":  "Sanctions en attente",
  "/discipline/stats":      "Tableau de bord disciplinaire",
  "/cahier-textes":         "Cahier de textes",
};

const ROLE_LABELS: Record<string, string> = {
  dev:        "DÉVELOPPEUR",
  directeur:  "DIRECTEUR",
  censeur:    "CENSEUR",
  professeur: "PROFESSEUR",
  eleve:      "ÉLÈVE",
  parent:     "PARENT",
  infirmier:  "INFIRMIER(E)",
  educateur:  "ÉDUCATEUR",
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
function SidebarContent({ location, onClose, onLogoutRequest }: { location: string; onClose: () => void; onLogoutRequest: () => void }) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const role = user?.role || "eleve";
  const sections = navConfig[role as keyof typeof navConfig] || [];
  const initials = `${user?.prenoms?.charAt(0) || ""}${user?.nom?.charAt(0) || ""}`.toUpperCase() || "U";

  const handleLogout = () => {
    onClose();
    onLogoutRequest();
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "var(--m15-card)", borderRight: "1px solid var(--m15-border)" }}>
      {/* Logo */}
      <div className="p-5 pb-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
        <img src="/logo.png" alt="M15-SchoolTech" className="h-10 w-auto" />
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
  const { user, logout } = useAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
        <SidebarContent location={location} onClose={() => {}} onLogoutRequest={() => setShowLogoutConfirm(true)} />
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
                <SidebarContent location={location} onClose={() => setIsMobileOpen(false)} onLogoutRequest={() => setShowLogoutConfirm(true)} />
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

            {/* Déconnexion */}
            <button
              onClick={() => setShowLogoutConfirm(true)}
              title="Se déconnecter"
              className="w-9 h-9 flex items-center justify-center rounded-xl transition-all"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6D"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,77,109,0.4)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--m15-border)"; }}>
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── Contenu principal ── */}
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden page-fade-in">
          {children}
        </main>
      </div>

      {/* Modale confirmation déconnexion */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Se déconnecter ?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Vous allez quitter votre session. Toute activité non enregistrée sera perdue.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowLogoutConfirm(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={logout}>
              Se déconnecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
