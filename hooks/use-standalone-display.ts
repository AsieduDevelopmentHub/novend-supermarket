"use client";

import { useSyncExternalStore } from "react";
import { isStandaloneWebApp } from "@/lib/device-install";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const media = window.matchMedia("(display-mode: standalone)");
  const onChange = () => onStoreChange();
  media.addEventListener("change", onChange);
  window.addEventListener("appinstalled", onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener("appinstalled", onChange);
  };
}

/**
 * True when the app is running as an installed PWA / home-screen web app
 * (Chrome standalone, iOS `navigator.standalone`, etc.).
 */
export function useStandaloneDisplay(): boolean {
  return useSyncExternalStore(subscribe, isStandaloneWebApp, () => false);
}
