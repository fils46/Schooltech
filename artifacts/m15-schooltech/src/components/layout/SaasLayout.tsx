import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  ScrollText,
  LogOut,
  Shield,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/saas", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/saas/etablissements", label: "Établissements", icon: Building2 },
  { href: "/saas/licences", label: "Licences & Paiements", icon: CreditCard },
  { href: "/saas/logs", label: "Logs & Activité", icon: ScrollText },
];

export function SaasLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen" style={{ fontFamily: "Poppins, sans-serif", backgroundColor: "#0A1628" }}>
      {/* Sidebar */}
      <aside
        className="w-64 flex-shrink-0 flex flex-col border-r"
        style={{ backgroundColor: "#0A1628", borderColor: "rgba(0,201,167,0.15)" }}
      >
        {/* Logo */}
        <div className="px-6 py-5 flex items-center gap-3 border-b" style={{ borderColor: "rgba(0,201,167,0.15)" }}>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: "rgba(0,201,167,0.15)" }}
          >
            <Shield className="w-5 h-5" style={{ color: "#00C9A7" }} />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">M15-SchoolTech</p>
            <p className="text-xs font-medium" style={{ color: "#00C9A7" }}>Admin SaaS</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? location === href : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                    active
                      ? "text-white"
                      : "text-[#8B9DC3] hover:text-white",
                  )}
                  style={active ? { backgroundColor: "rgba(0,201,167,0.15)", color: "#00C9A7" } : {}}
                >
                  <Icon
                    className="w-4 h-4 flex-shrink-0"
                    style={active ? { color: "#00C9A7" } : {}}
                  />
                  <span className="flex-1">{label}</span>
                  {active && <ChevronRight className="w-3 h-3" style={{ color: "#00C9A7" }} />}
                </a>
              </Link>
            );
          })}
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
              <p className="text-white text-sm font-medium truncate">{user?.nom ?? "Dev"}</p>
              <p className="text-xs truncate" style={{ color: "#8B9DC3" }}>{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
            style={{ color: "#8B9DC3" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#FF4D6D"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "rgba(255,77,109,0.1)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#8B9DC3"; (e.currentTarget as HTMLButtonElement).style.backgroundColor = "transparent"; }}
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
