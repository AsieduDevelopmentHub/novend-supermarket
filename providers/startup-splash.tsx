"use client";

import { useConvexAuth } from "convex/react";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useRef, useState } from "react";
import { AppSplash } from "@/features/auth/components/app-splash";
import { consumeSkipStartupSplash } from "@/lib/auth/redirect-after-login";
import { useConnectivity } from "@/hooks/use-connectivity";
import { isMarketingPath } from "@/lib/marketing-routes";
import { hasOfflineSession } from "@/lib/offline/session";

/** Brand beat — keep short so POS never feels blocked on first paint. */
const MIN_SPLASH_MS = 700;
const EXIT_MS = 320;
/** Cap/WebView often reports online while Convex cannot settle — never block forever. */
const MAX_SPLASH_MS = 3200;
/** Don't wait on Convex when offline (or when a prior session exists). */
const OFFLINE_AUTH_BUDGET_MS = 800;

/**
 * Shows the branded splash until Convex auth has resolved and a short
 * minimum display time has elapsed, then fades out over the app.
 * Hard-caps display so first load / flaky Cap networks cannot stack forever.
 *
 * Never read sessionStorage during render — that hydrates as splash-on vs
 * splash-off after login `location.replace`, and React 19 leaves the
 * server splash stuck.
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
  const [skipFromLogin, setSkipFromLogin] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [visible, setVisible] = useState(true);
  const [offlineReady, setOfflineReady] = useState(false);
  const [forcedReady, setForcedReady] = useState(false);
  const isAuthRoute =
    pathname === "/login" || pathname === "/signup" || pathname.startsWith("/onboarding");
  const skipSplash = skipFromLogin || isAuthRoute || isMarketingPath(pathname);

  useEffect(() => {
    if (isAuthRoute) return;
    if (!consumeSkipStartupSplash()) return;
    queueMicrotask(() => {
      setSkipFromLogin(true);
      setVisible(false);
      setExiting(false);
    });
  }, [pathname, isAuthRoute]);

  useEffect(() => {
    startedAt.current = performance.now();
    const hardStop = window.setTimeout(() => setForcedReady(true), MAX_SPLASH_MS);
    return () => window.clearTimeout(hardStop);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      queueMicrotask(() => setOfflineReady(false));
      return;
    }
    if (hasOfflineSession()) {
      queueMicrotask(() => setOfflineReady(true));
      return;
    }
    if (online) return;
    const timer = window.setTimeout(() => setOfflineReady(true), OFFLINE_AUTH_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, [online, isLoading]);

  const authSettled = !isLoading || offlineReady || forcedReady;

  useEffect(() => {
    if (skipFromLogin || !authSettled || !visible) return;

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
  }, [authSettled, visible, skipFromLogin]);

  return (
    <>
      {children}
      {!skipSplash && visible ? <AppSplash label="Starting Novend POS…" exiting={exiting} /> : null}
    </>
  );
}
