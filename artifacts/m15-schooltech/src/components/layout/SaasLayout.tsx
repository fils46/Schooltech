import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Building2,
  ScrollText,
  LogOut,
  ChevronRight,
  Key,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_SECTIONS = [
  {
    title: "PRINCIPAL",
    links: [
      { href: "/saas",                label: "Tableau de bord", icon: LayoutDashboard, exact: true },
      { href: "/saas/etablissements", label: "Établissements",  icon: Building2 },
      { href: "/saas/logs",           label: "Logs d'activité", icon: ScrollText },
    ],
  },
  {
    title: "GESTION",
    links: [
      { href: "/saas/licences", label: "Licences & Paiements", icon: Key },
    ],
  },
];

function SidebarContent({ location, onClose }: { location: string; onClose: () => void }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: "var(--m15-navy)", borderRight: "1px solid rgba(0,201,167,0.15)" }}>
      {/* Logo */}
      <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: "rgba(0,201,167,0.15)" }}>
        <div>
          <img src="/logo.png" alt="M15-SchoolTech" className="h-10 w-auto" />
          <p className="text-xs font-medium mt-1 pl-1" style={{ color: "#00C9A7" }}>Admin SaaS</p>
        </div>
        <button
          onClick={onClose}
          className="md:hidden w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{ color: "#8B9DC3" }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav avec sections */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto">
        {NAV_SECTIONS.map(({ title, links }) => (
          <div key={title}>
            <p className="px-3 mb-1 text-[10px] font-semibold tracking-widest uppercase" style={{ color: "rgba(139,157,195,0.6)" }}>
              {title}
            </p>
            <div className="space-y-0.5">
              {links.map(({ href, label, icon: Icon, exact }) => {
                const active = exact ? location === href : location.startsWith(href);
                return (
                  <Link key={href} href={href}>
                    <a
                      onClick={onClose}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                        active ? "text-[var(--m15-white)]" : "text-[var(--m15-muted)] hover:text-[var(--m15-white)]",
                      )}
                      style={active ? { backgroundColor: "rgba(0,201,167,0.15)", color: "#00C9A7" } : {}}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" style={active ? { color: "#00C9A7" } : {}} />
                      <span className="flex-1">{label}</span>
                      {active && <ChevronRight className="w-3 h-3" style={{ color: "#00C9A7" }} />}
                    </a>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Utilisateur */}
      <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(0,201,167,0.15)" }}>
        <div className="flex items-center gap-3 mb-3 px-1">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: "rgba(0,201,167,0.2)", color: "#00C9A7" }}
          >
            {user?.nom?.[0]?.toUpperCase() ?? "D"}
          </div>
          <div className="min-w-0">
            <p className="text-[var(--m15-white)] text-sm font-medium truncate">{user?.prenoms} {user?.nom}</p>
            <p className="text-xs truncate" style={{ color: "var(--m15-muted)" }}>{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ color: "var(--m15-muted)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#FF4D6D"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,77,109,0.1)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8B9DC3"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
        >
          <LogOut className="w-4 h-4" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

export function SaasLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen" style={{ fontFamily: "Poppins, sans-serif", backgroundColor: "var(--m15-navy)" }}>

      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 flex-shrink-0 flex-col h-screen sticky top-0">
        <SidebarContent location={location} onClose={() => {}} />
      </aside>

      {/* Zone principale */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Topbar mobile */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 h-14 border-b"
          style={{ backgroundColor: "var(--m15-navy)", borderColor: "rgba(0,201,167,0.15)" }}>
          <img src="/logo.png" alt="M15-SchoolTech" className="h-8 w-auto" />

          <div className="flex items-center gap-2">
            {/* Déconnexion */}
            <button
              onClick={logout}
              title="Se déconnecter"
              className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
              style={{ backgroundColor: "rgba(255,77,109,0.1)", color: "#FF4D6D" }}
            >
              <LogOut className="w-4 h-4" />
            </button>

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="w-9 h-9 flex items-center justify-center rounded-lg transition-all"
                  style={{ backgroundColor: "rgba(0,201,167,0.1)", color: "#00C9A7" }}
                >
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0 border-0" style={{ backgroundColor: "var(--m15-navy)" }}>
                <SidebarContent location={location} onClose={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
