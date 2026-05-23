import { useEffect, useState } from "react";

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 400);
    const t2 = setTimeout(() => setPhase("out"), 2200);
    const t3 = setTimeout(() => onDone(), 2900);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
      style={{
        background: "#0A1628",
        opacity: phase === "out" ? 0 : 1,
        transition: phase === "out" ? "opacity 0.7s ease" : "none",
        pointerEvents: phase === "out" ? "none" : "all",
      }}
    >
      {/* ── Anneaux d'onde ── */}
      <div className="absolute flex items-center justify-center" style={{ inset: 0 }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: `${260 + i * 120}px`,
              height: `${260 + i * 120}px`,
              borderColor: `rgba(0,201,167,${0.12 - i * 0.03})`,
              animation: `splashPulse 2.4s ease-out ${i * 0.3}s infinite`,
            }}
          />
        ))}
      </div>

      {/* ── Grille de fond ── */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: "linear-gradient(rgba(0,201,167,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,201,167,0.04) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />

      {/* ── Contenu central ── */}
      <div
        className="relative flex flex-col items-center gap-8"
        style={{
          opacity: phase === "in" ? 0 : 1,
          transform: phase === "in" ? "scale(0.88) translateY(16px)" : "scale(1) translateY(0)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        {/* Logo */}
        <div className="relative">
          {/* Halo derrière le logo */}
          <div className="absolute inset-0 rounded-2xl blur-2xl" style={{
            background: "rgba(0,201,167,0.25)",
            transform: "scale(1.4)",
          }} />
          <img
            src="/logo.png"
            alt="M15-SchoolTech"
            className="relative h-24 w-auto drop-shadow-2xl"
          />
        </div>

        {/* Tagline */}
        <p className="text-sm tracking-widest uppercase" style={{ color: "rgba(0,201,167,0.7)", letterSpacing: "0.25em" }}>
          Plateforme de gestion scolaire
        </p>

        {/* Barre de progression */}
        <div className="w-48 h-0.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #00C9A7, #F5C842)",
              width: phase === "hold" || phase === "out" ? "100%" : "0%",
              transition: "width 1.6s cubic-bezier(0.4,0,0.2,1)",
            }}
          />
        </div>

        {/* Points animés */}
        <div className="flex items-center gap-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full"
              style={{
                background: "#00C9A7",
                animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      {/* ── Particules décoratives ── */}
      {[
        { top: "15%", left: "12%", size: 4, delay: "0s", color: "#00C9A7" },
        { top: "20%", left: "85%", size: 3, delay: "0.4s", color: "#F5C842" },
        { top: "75%", left: "8%",  size: 3, delay: "0.7s", color: "#F5C842" },
        { top: "80%", left: "88%", size: 4, delay: "0.2s", color: "#00C9A7" },
        { top: "50%", left: "5%",  size: 2, delay: "1s",   color: "#00C9A7" },
        { top: "35%", left: "92%", size: 2, delay: "0.6s", color: "#F5C842" },
      ].map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            top: p.top, left: p.left,
            width: p.size, height: p.size,
            background: p.color,
            opacity: 0.6,
            animation: `splashFloat 3s ease-in-out ${p.delay} infinite alternate`,
          }}
        />
      ))}

      <style>{`
        @keyframes splashPulse {
          0%   { opacity: 0.8; transform: scale(1); }
          100% { opacity: 0;   transform: scale(1.25); }
        }
        @keyframes splashDot {
          0%, 100% { opacity: 0.3; transform: translateY(0); }
          50%       { opacity: 1;   transform: translateY(-6px); }
        }
        @keyframes splashFloat {
          0%   { transform: translateY(0)   scale(1); }
          100% { transform: translateY(-8px) scale(1.3); }
        }
      `}</style>
    </div>
  );
}
