"use client";

import { useEffect } from "react";
import { isStandaloneWebApp } from "@/lib/device-install";

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
  "/refund",
  "/cookies",
  "/aup",
  "/dpa",
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

function warmShellRoutes() {
  if (!navigator.onLine || isAuthPath(window.location.pathname)) return;
  void Promise.all(
    SHELL_ROUTES.map((path) => fetch(path, { credentials: "same-origin" }).catch(() => undefined)),
  );
}

/**
 * Register the service worker so Capacitor and the web PWA can open from
 * Cache Storage after one online visit. Development stays off unless
 * NEXT_PUBLIC_OFFLINE_SW=1. Do not warm shell routes from /login — that
 * would cache a login document under /dashboard.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncStandaloneClass = () => {
      document.documentElement.classList.toggle("standalone-display", isStandaloneWebApp());
    };
    syncStandaloneClass();
    const media = window.matchMedia("(display-mode: standalone)");
    media.addEventListener("change", syncStandaloneClass);
    window.addEventListener("appinstalled", syncStandaloneClass);

    return () => {
      media.removeEventListener("change", syncStandaloneClass);
      window.removeEventListener("appinstalled", syncStandaloneClass);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    if (!shouldRegisterServiceWorker()) {
      void unregisterServiceWorkers().catch((error) => {
        console.info("[pwa] service worker cleanup skipped", error);
      });
      return;
    }

    const onControllerChange = () => {
      // New SW claimed after a CACHE_NAME bump — re-warm shells into the new bucket.
      warmShellRoutes();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    void navigator.serviceWorker
      .register("/sw.js")
      .then(async (registration) => {
        await registration.update().catch(() => undefined);
        await navigator.serviceWorker.ready;
        warmShellRoutes();
        return registration;
      })
      .catch((error) => {
        console.info("[pwa] service worker registration skipped", error);
      });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  return null;
}
