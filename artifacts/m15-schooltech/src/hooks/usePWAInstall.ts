import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PWAInstallState {
  canInstall: boolean;
  isInstalled: boolean;
  install: () => Promise<void>;
}

let globalPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    globalPrompt = e as BeforeInstallPromptEvent;
    notifyListeners();
  });

  window.addEventListener("appinstalled", () => {
    globalPrompt = null;
    notifyListeners();
  });
}

export function usePWAInstall(): PWAInstallState {
  const [, forceUpdate] = useState(0);

  const isInstalled =
    typeof window !== "undefined" &&
    window.matchMedia("(display-mode: standalone)").matches;

  useEffect(() => {
    const update = () => forceUpdate((n) => n + 1);
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  const install = async () => {
    if (!globalPrompt) return;
    await globalPrompt.prompt();
    const { outcome } = await globalPrompt.userChoice;
    if (outcome === "accepted") {
      globalPrompt = null;
      notifyListeners();
    }
  };

  return {
    canInstall: !!globalPrompt && !isInstalled,
    isInstalled,
    install,
  };
}
