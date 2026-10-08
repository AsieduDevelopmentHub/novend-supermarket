"use client";

import { useCallback, useEffect, useState } from "react";
import { installGaClickTracking, trackGaEvent } from "@/lib/analytics/ga-events";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

/**
 * Captures the browser install prompt for Chromium-based mobile / desktop PWAs.
 * Returns null on iOS Safari (use manual Add to Home Screen instructions).
 */
export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    function onBeforeInstall(event: BeforeInstallPromptEvent) {
      event.preventDefault();
      setDeferred(event);
    }
    function onInstalled() {
      setInstalled(true);
      setDeferred(null);
      trackGaEvent("install_pwa", { source: "appinstalled" });
    }

    installGaClickTracking();
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return { ok: false as const, reason: "unavailable" as const };
    await deferred.prompt();
    const choice = await deferred.userChoice;
    setDeferred(null);
    if (choice.outcome === "accepted") {
      trackGaEvent("install_pwa", { source: "prompt" });
    }
    return {
      ok: choice.outcome === "accepted",
      reason: choice.outcome === "accepted" ? ("accepted" as const) : ("dismissed" as const),
    };
  }, [deferred]);

  return {
    canPrompt: Boolean(deferred),
    installed,
    promptInstall,
  };
}
