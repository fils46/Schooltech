import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginFormValues = z.infer<typeof loginSchema>;


const FEATURES = [
  { icon: "📊", text: "Notes & Bulletins automatisés" },
  { icon: "👨‍👩‍👧", text: "Portail parents en temps réel" },
  { icon: "💳", text: "Paiements Mobile Money intégrés" },
  { icon: "💬", text: "Notifications WhatsApp instantanées" },
];

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate({ data }, {
      onSuccess: (tokens) => {
        login(tokens);
        if (tokens.premierLogin) {
          setLocation("/premier-login");
        } else {
          setLocation("/dashboard");
        }
      },
      onError: () => {},
    });
  };

  return (
    <div className="min-h-screen w-full flex" style={{ background: "var(--m15-navy)", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Colonne gauche ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, var(--m15-navy) 0%, var(--m15-card2) 100%)" }}>

        {/* Grille de fond */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "linear-gradient(rgba(0,201,167,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,201,167,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px"
        }} />

        {/* Glow radial */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full pointer-events-none" style={{
          background: "radial-gradient(circle, rgba(0,201,167,0.12) 0%, transparent 70%)"
        }} />

        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <div className="mb-auto">
            <img src="/logo.png" alt="M15-SchoolTech" className="h-16 w-auto mb-2" />
            <p className="text-xs pl-1" style={{ color: "var(--m15-muted)" }}>v1.0 — Collège & Lycée</p>
          </div>

          {/* Hero text */}
          <div className="mb-10">
            <h2 className="text-4xl font-bold mb-4 leading-tight" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              La gestion scolaire<br />
              <span style={{ color: "#00C9A7" }}>simplifiée</span> pour la<br />
              Côte d'Ivoire
            </h2>
            <p className="text-base leading-relaxed" style={{ color: "var(--m15-muted)" }}>
              Une plateforme complète pour administrer vos établissements, suivre les élèves et communiquer avec les familles.
            </p>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f) => (
              <div key={f.text} className="flex items-center gap-3 p-4 rounded-xl transition-all"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
                <span className="text-xl">{f.icon}</span>
                <span className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>{f.text}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <p className="mt-8 text-xs" style={{ color: "var(--m15-muted)" }}>
            © {new Date().getFullYear()} M15 Tech. Tous droits réservés.
          </p>
        </div>
      </div>

      {/* ── Colonne droite — Formulaire ── */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 lg:p-12"
        style={{ background: "var(--m15-navy2)" }}>

        {/* Logo mobile uniquement */}
        <div className="lg:hidden mb-8 text-center">
          <img src="/logo.png" alt="M15-SchoolTech" className="h-14 w-auto mx-auto" />
          <p className="text-sm mt-2" style={{ color: "var(--m15-muted)" }}>Portail de Gestion Scolaire</p>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Connexion
            </h2>
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
              Accédez à votre espace de gestion scolaire
            </p>
          </div>

          {/* Formulaire */}
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest mb-2"
                style={{ color: "var(--m15-muted)" }}>Adresse email</label>
              <input
                type="email"
                placeholder="nom@etablissement.edu.ci"
                {...form.register("email")}
                data-testid="input-email"
                className="w-full rounded-xl px-4 py-3.5 text-sm transition-all outline-none"
                style={{
                  background: "var(--m15-card)",
                  border: form.formState.errors.email ? "1px solid #FF4D6D" : "1px solid var(--m15-border)",
                  color: "var(--m15-white)",
                  fontFamily: "'DM Sans', sans-serif",
                }}
                onFocus={e => { e.target.style.borderColor = "#00C9A7"; e.target.style.boxShadow = "0 0 0 3px rgba(0,201,167,0.1)"; }}
                onBlur={e => { e.target.style.borderColor = form.formState.errors.email ? "#FF4D6D" : "var(--m15-border)"; e.target.style.boxShadow = "none"; }}
              />
              {form.formState.errors.email && (
                <p className="mt-1.5 text-xs" style={{ color: "#FF4D6D" }}>{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--m15-muted)" }}>Mot de passe</label>
                <Link href="/forgot-password"
                  data-testid="link-forgot-password"
                  className="text-xs font-medium hover:underline transition-colors"
                  style={{ color: "#00C9A7" }}>
                  Mot de passe oublié ?
                </Link>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  {...form.register("password")}
                  data-testid="input-password"
                  className="w-full rounded-xl px-4 py-3.5 pr-11 text-sm transition-all outline-none"
                  style={{
                    background: "var(--m15-card)",
                    border: form.formState.errors.password ? "1px solid #FF4D6D" : "1px solid var(--m15-border)",
                    color: "var(--m15-white)",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  onFocus={e => { e.target.style.borderColor = "#00C9A7"; e.target.style.boxShadow = "0 0 0 3px rgba(0,201,167,0.1)"; }}
                  onBlur={e => { e.target.style.borderColor = form.formState.errors.password ? "#FF4D6D" : "var(--m15-border)"; e.target.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 transition-colors"
                  style={{ color: "var(--m15-muted)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-white)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--m15-muted)"; }}
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="mt-1.5 text-xs" style={{ color: "#FF4D6D" }}>{form.formState.errors.password.message}</p>
              )}
            </div>

            {/* Erreur API */}
            {loginMutation.error && (
              <div data-testid="error-message" className="flex items-start gap-3 p-4 rounded-xl"
                style={{
                  background: "rgba(255,77,109,0.08)",
                  border: "1px solid rgba(255,77,109,0.3)",
                }}>
                <span className="text-lg leading-none mt-0.5">🔒</span>
                <div>
                  <p className="text-sm font-medium" style={{ color: "#FF4D6D" }}>
                    {loginMutation.error.message?.includes("désactivé")
                      ? "Votre compte a été désactivé."
                      : "Identifiants incorrects."}
                  </p>
                  {loginMutation.error.message?.includes("désactivé") && (
                    <p className="text-xs mt-1" style={{ color: "#FF4D6D", opacity: 0.8 }}>
                      Veuillez contacter l'administration.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Bouton submit */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              data-testid="button-submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl py-4 text-base font-bold transition-all disabled:opacity-70"
              style={{
                fontFamily: "'Syne', sans-serif",
                background: "linear-gradient(135deg, #00C9A7, #0080FF)",
                color: "#fff",
                boxShadow: "0 8px 24px rgba(0,201,167,0.3)",
                border: "none",
              }}
              onMouseEnter={e => { if (!loginMutation.isPending) { (e.target as HTMLButtonElement).style.opacity = "0.9"; (e.target as HTMLButtonElement).style.transform = "translateY(-1px)"; } }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.opacity = "1"; (e.target as HTMLButtonElement).style.transform = "none"; }}
            >
              {loginMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Connexion en cours...</>
                : <>Se connecter →</>}
            </button>
          </form>

          {/* Bandeau sécurité */}
          <div className="mt-6 flex items-center justify-center gap-2 py-3 px-4 rounded-xl"
            style={{ background: "rgba(0,201,167,0.06)", border: "1px solid rgba(0,201,167,0.1)" }}>
            <Lock className="w-3.5 h-3.5" style={{ color: "var(--m15-muted)" }} />
            <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
              Connexion sécurisée SSL — Vos données sont chiffrées
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
