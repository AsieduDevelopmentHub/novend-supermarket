"use client";

import { useEffect } from "react";

const SHELL_ROUTES = [
  "/dashboard",
  "/sales",
  "/orders",
  "/returns",
  "/inventory",
  "/wholesale",
  "/customers",
  "/products",
  "/reports",
  "/analytics",
  "/settings",
  "/more",
  "/about",
  "/users",
  "/branches",
  "/suppliers",
  "/platform",
  "/privacy",
  "/terms",
  "/docs",
  "/docs/help",
  "/docs/releases",
];

function shouldRegisterServiceWorker() {
  if (process.env.NODE_ENV === "production") return true;
  // Opt-in for local offline-refresh testing (Turbopack + SW can otherwise fight).
  return process.env.NEXT_PUBLIC_OFFLINE_SW === "1";
}

function isAuthPath(pathname: string) {
  return pathname === "/login" || pathname === "/signup";
}

async function unregisterServiceWorkers() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((reg) => reg.unregister()));
  if ("caches" in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

/**
 * Register the service worker so Capacitor and the web PWA can open from
 * Cache Storage after one online visit. Development stays off unless
 * NEXT_PUBLIC_OFFLINE_SW=1. Do not warm shell routes from /login — that
 * would cache a login document under /dashboard.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (!shouldRegisterServiceWorker()) {
      void unregisterServiceWorkers().catch((error) => {
        console.info("[pwa] service worker cleanup skipped", error);
      });
      return;
    }

    void navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        await registration.update().catch(() => undefined);
        await navigator.serviceWorker.ready;
        if (!navigator.onLine || isAuthPath(window.location.pathname)) {
          return registration;
        }
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
