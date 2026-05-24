import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation, Link } from "wouter";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useState, useEffect } from "react";
import { Loader2, Lock, Eye, EyeOff } from "lucide-react";

const SLIDES = [
  { src: "/hero-classe.png",   alt: "Élèves en classe" },
  { src: "/hero-eleve-1.png",  alt: "Élève au travail" },
  { src: "/hero-eleve-2.png",  alt: "Élève concentré"  },
];

const loginSchema = z.object({
  email: z.string().email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

type LoginFormValues = z.infer<typeof loginSchema>;



export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const loginMutation = useLogin();

  useEffect(() => {
    const timer = setInterval(() => {
      setSlideIndex(i => (i + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

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
        } else if (tokens.utilisateur.role === "dev") {
          setLocation("/saas");
        } else {
          setLocation("/dashboard");
        }
      },
      onError: () => {},
    });
  };

  return (
    <div className="min-h-screen w-full flex" style={{ background: "var(--m15-navy)", fontFamily: "'DM Sans', sans-serif" }}>

      {/* ── Colonne gauche — Slideshow ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden">

        {/* Photos en fond — défilement par fondu */}
        {SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            className="absolute inset-0 transition-opacity duration-1000"
            style={{ opacity: i === slideIndex ? 1 : 0 }}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              className="w-full h-full object-cover object-center"
            />
          </div>
        ))}

        {/* Overlay dégradé sombre pour lisibilité du texte */}
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to bottom, rgba(10,22,40,0.55) 0%, rgba(10,22,40,0.30) 40%, rgba(10,22,40,0.75) 100%)"
        }} />

        {/* Contenu en premier plan */}
        <div className="relative z-10 flex flex-col h-full p-12">
          {/* Logo */}
          <div className="mb-auto">
            <img src="/logo.png" alt="M15-SchoolTech" className="h-16 w-auto mb-2 drop-shadow-lg" />
            <p className="text-xs pl-1 text-white/70">v1.0 — Collège & Lycée</p>
          </div>

          {/* Hero text */}
          <div className="mb-10">
            <h2 className="text-4xl font-bold mb-4 leading-tight" style={{ fontFamily: "'Syne', sans-serif", color: "#ffffff" }}>
              La gestion scolaire<br />
              <span style={{ color: "#00C9A7" }}>simplifiée</span> pour la<br />
              Côte d'Ivoire
            </h2>
            <p className="text-base leading-relaxed text-white/75">
              Une plateforme complète pour administrer vos établissements, suivre les élèves et communiquer avec les familles.
            </p>
          </div>

          {/* Indicateurs de slide */}
          <div className="flex items-center gap-2 mb-6">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlideIndex(i)}
                className="transition-all duration-300 rounded-full"
                style={{
                  width: i === slideIndex ? "24px" : "8px",
                  height: "8px",
                  background: i === slideIndex ? "#00C9A7" : "rgba(255,255,255,0.4)",
                }}
              />
            ))}
          </div>

          {/* Footer */}
          <p className="text-xs text-white/50">
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
