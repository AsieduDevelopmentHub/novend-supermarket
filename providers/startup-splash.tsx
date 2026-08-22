"use client";

import { useConvexAuth } from "convex/react";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { AppSplash } from "@/features/auth/components/app-splash";
import { useConnectivity } from "@/hooks/use-connectivity";
import { hasOfflineSession } from "@/lib/offline/session";

const MIN_SPLASH_MS = 2200;
const EXIT_MS = 400;
/** Don't block forever when Convex auth cannot resolve offline. */
const OFFLINE_AUTH_BUDGET_MS = 1200;

/**
 * Shows the branded splash until Convex auth has resolved and a short
 * minimum display time has elapsed, then fades out over the app.
 * Offline refresh: dismisses once a prior session exists (or budget elapses),
 * so the shell can boot from Dexie without the network.
 */
export function StartupSplash({ children }: { children: ReactNode }) {
  const configured = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  if (!configured) {
    return <>{children}</>;
  }

  return <AuthStartupSplash>{children}</AuthStartupSplash>;
}

function AuthStartupSplash({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { isLoading } = useConvexAuth();
  const online = useConnectivity();
  const startedAt = useRef(0);
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);
  const [offlineReady, setOfflineReady] = useState(false);
  const isMarketingLanding = pathname === "/";
  const isAuthRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/onboarding");
  const skipSplash = isMarketingLanding || isAuthRoute;

  useEffect(() => {
    startedAt.current = performance.now();
  }, []);

  useEffect(() => {
    if (online || !isLoading) {
      queueMicrotask(() => setOfflineReady(false));
      return;
    }
    // Prior session on this device → allow shell boot without waiting on Convex.
    if (hasOfflineSession()) {
      queueMicrotask(() => setOfflineReady(true));
      return;
    }
    const timer = window.setTimeout(() => setOfflineReady(true), OFFLINE_AUTH_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, [online, isLoading]);

  const authSettled = !isLoading || offlineReady;

  useEffect(() => {
    if (!authSettled || !visible) return;

    const wait = Math.max(0, MIN_SPLASH_MS - (performance.now() - startedAt.current));
    let exitTimer = 0;

    const showTimer = window.setTimeout(() => {
      setExiting(true);
      exitTimer = window.setTimeout(() => setVisible(false), EXIT_MS);
    }, wait);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(exitTimer);
    };
  }, [authSettled, visible]);

  return (
    <>
      {children}
      {!skipSplash && visible ? (
        <AppSplash label="Starting Novend POS…" exiting={exiting} />
      ) : null}
    </>
  );
}
