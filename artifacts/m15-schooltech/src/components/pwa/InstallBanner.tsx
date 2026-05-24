import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    const lastDismissed = localStorage.getItem("pwa_banner_dismissed");
    if (lastDismissed) {
      const daysSince = (Date.now() - parseInt(lastDismissed)) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) return;
    }

    const isDesktopDevice = window.innerWidth >= 1024;
    setIsDesktop(isDesktopDevice);

    const isIOSDevice = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(isIOSDevice);

    if (isIOSDevice) {
      const nav = window.navigator as Navigator & { standalone?: boolean };
      if (!nav.standalone) {
        setTimeout(() => setShowBanner(true), 3000);
      }
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowBanner(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setShowBanner(false);
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setDismissed(true);
    localStorage.setItem("pwa_banner_dismissed", Date.now().toString());
  };

  if (!showBanner || isInstalled || dismissed) return null;

  if (isDesktop) {
    return (
      <>
        <div
          style={{
            position: "fixed",
            bottom: 28,
            right: 28,
            zIndex: 9999,
            width: 380,
            background: "linear-gradient(135deg, #111E35 0%, #0A1628 100%)",
            border: "1px solid rgba(0,201,167,0.25)",
            borderRadius: 20,
            padding: "24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,201,167,0.1)",
            animation: "slideInRight 0.4s cubic-bezier(0.34,1.56,0.64,1)",
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  background: "linear-gradient(135deg, #00C9A7, #0080FF)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 16px rgba(0,201,167,0.4)",
                  flexShrink: 0,
                }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 15, fontWeight: 700, color: "#FFFFFF", margin: 0, letterSpacing: "-0.3px" }}>
                  M15-SchoolTech
                </p>
                <p style={{ fontSize: 12, color: "#00C9A7", margin: 0, fontWeight: 500 }}>
                  Application disponible
                </p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              style={{
                background: "rgba(139,157,195,0.1)",
                border: "none",
                borderRadius: 99,
                width: 28,
                height: 28,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: "#8B9DC3",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,157,195,0.2)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(139,157,195,0.1)")}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <p style={{ fontSize: 13, color: "#8B9DC3", lineHeight: 1.6, margin: "0 0 16px" }}>
            Installez l'application sur votre bureau pour un accès instantané, même sans connexion internet.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {[
              { icon: "⚡", label: "Lancement rapide" },
              { icon: "📶", label: "Mode hors-ligne" },
              { icon: "🔔", label: "Notifications" },
              { icon: "🖥️", label: "Fenêtre dédiée" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(0,201,167,0.06)",
                  border: "1px solid rgba(0,201,167,0.15)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 12,
                  color: "#8B9DC3",
                }}
              >
                <span style={{ fontSize: 14 }}>{item.icon}</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={handleInstall}
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #00C9A7, #0080FF)",
                border: "none",
                borderRadius: 10,
                padding: "11px",
                color: "white",
                fontFamily: "'Syne', sans-serif",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,201,167,0.3)",
                transition: "opacity 0.2s, transform 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.9")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Installer
            </button>
            <button
              onClick={handleDismiss}
              style={{
                background: "rgba(139,157,195,0.1)",
                border: "1px solid rgba(139,157,195,0.2)",
                borderRadius: 10,
                padding: "11px 16px",
                color: "#8B9DC3",
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 13,
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(139,157,195,0.15)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(139,157,195,0.1)")}
            >
              Plus tard
            </button>
          </div>

          <p style={{ fontSize: 11, color: "rgba(139,157,195,0.5)", margin: "12px 0 0", textAlign: "center", lineHeight: 1.5 }}>
            Fonctionne sur Chrome, Edge et Opera
          </p>
        </div>

        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(120%); opacity: 0; }
            to   { transform: translateX(0);    opacity: 1; }
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      <div
        onClick={handleDismiss}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 9998,
          backdropFilter: "blur(4px)",
          animation: "fadeIn 0.3s ease",
        }}
      />

      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: "linear-gradient(135deg, #111E35 0%, #0A1628 100%)",
          borderTop: "1px solid rgba(0,201,167,0.3)",
          borderRadius: "20px 20px 0 0",
          padding: "28px 24px 36px",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
          animation: "slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ width: 40, height: 4, background: "rgba(139,157,195,0.4)", borderRadius: 99, margin: "0 auto 24px" }} />

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "linear-gradient(135deg, #00C9A7, #0080FF)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 4px 16px rgba(0,201,167,0.4)",
            }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontFamily: "'Syne', sans-serif", fontSize: 17, fontWeight: 700, color: "#FFFFFF", margin: "0 0 4px" }}>
              Installer M15-SchoolTech
            </p>
            <p style={{ fontSize: 13, color: "#8B9DC3", margin: 0, lineHeight: 1.5 }}>
              {isIOS
                ? "Ajoutez l'app à votre écran d'accueil pour un accès rapide."
                : "Accès rapide, mode hors-ligne et notifications."}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            style={{
              background: "rgba(139,157,195,0.15)",
              border: "none",
              borderRadius: 99,
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#8B9DC3",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, margin: "20px 0", flexWrap: "wrap" }}>
          {[
            { icon: "⚡", label: "Rapide" },
            { icon: "📶", label: "Hors-ligne" },
            { icon: "🔔", label: "Notifications" },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "rgba(0,201,167,0.08)",
                border: "1px solid rgba(0,201,167,0.2)",
                borderRadius: 99,
                padding: "5px 12px",
                fontSize: 12,
                color: "#00C9A7",
                fontWeight: 500,
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        {isIOS && (
          <div
            style={{
              background: "rgba(0,128,255,0.08)",
              border: "1px solid rgba(0,128,255,0.2)",
              borderRadius: 12,
              padding: "14px 16px",
              marginBottom: 16,
            }}
          >
            <p style={{ fontSize: 11, color: "#8B9DC3", margin: "0 0 10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Comment installer
            </p>
            {[
              { num: "1", text: "Appuyez sur le bouton Partager", icon: "⬆️" },
              { num: "2", text: "Appuyez sur", bold: '"Sur l\'écran d\'accueil"', icon: "➕" },
              { num: "3", text: "Appuyez sur", bold: '"Ajouter"', icon: "✅" },
            ].map((step) => (
              <div key={step.num} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 22, height: 22, borderRadius: 99, background: "rgba(0,128,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#0080FF", flexShrink: 0 }}>
                  {step.num}
                </div>
                <p style={{ fontSize: 13, color: "#8B9DC3", margin: 0 }}>
                  {step.icon} {step.text}{" "}
                  {step.bold && <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{step.bold}</span>}
                </p>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          {!isIOS && (
            <button
              onClick={handleInstall}
              style={{
                flex: 1,
                background: "linear-gradient(135deg, #00C9A7, #0080FF)",
                border: "none",
                borderRadius: 12,
                padding: "14px",
                color: "white",
                fontFamily: "'Syne', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 4px 16px rgba(0,201,167,0.35)",
              }}
            >
              Installer l'application
            </button>
          )}
          <button
            onClick={handleDismiss}
            style={{
              flex: isIOS ? 1 : "0 0 auto",
              background: "rgba(139,157,195,0.1)",
              border: "1px solid rgba(139,157,195,0.2)",
              borderRadius: 12,
              padding: "14px 20px",
              color: "#8B9DC3",
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {isIOS ? "Compris !" : "Plus tard"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default InstallBanner;
