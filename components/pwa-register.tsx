"use client";

import { useEffect } from "react";

const SHELL_ROUTES = [
  "/dashboard",
  "/sales",
  "/orders",
  "/returns",
  "/inventory",
  "/customers",
  "/products",
  "/reports",
  "/settings",
];

function shouldRegisterServiceWorker() {
  if (process.env.NODE_ENV === "production") return true;
  // Opt-in for local offline-refresh testing (Turbopack + SW can otherwise fight).
  return process.env.NEXT_PUBLIC_OFFLINE_SW === "1";
}

/**
 * Register the service worker so a full offline refresh can load the cached shell.
 * Development: off by default (unregister) unless NEXT_PUBLIC_OFFLINE_SW=1.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (!shouldRegisterServiceWorker()) {
      void (async () => {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((reg) => reg.unregister()));
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((key) => caches.delete(key)));
        }
      })().catch((error) => {
        console.info("[pwa] dev cleanup skipped", error);
      });
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        await navigator.serviceWorker.ready;
        if (!navigator.onLine) return registration;
        // Warm shell HTML + trigger static asset caching in the background.
        void Promise.all(
          SHELL_ROUTES.map((path) =>
            fetch(path, { credentials: "same-origin" }).catch(() => undefined),
          ),
        );
        return registration;
      })
      .catch((error) => {
        console.info("[pwa] service worker registration skipped", error);
      });
  }, []);

  return null;
}
