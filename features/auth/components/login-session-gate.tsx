"use client";

import { type ReactNode, Suspense, useEffect, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { AppSplash } from "@/features/auth/components/app-splash";
import { useIsClient } from "@/hooks/use-is-client";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";

/** Cap/emulator Convex can stay isAuthenticated briefly after sign-out. */
const AUTH_COVER_BUDGET_MS = 4000;
/** If still on /login after cover, hard-leave so "Welcome" cannot strand the form. */
const FORCE_LEAVE_BUDGET_MS = 6000;

/**
 * Covers login chrome only after mount, and only while a live session is
 * about to leave /login. Never cover because Convex `isLoading` — that
 * stays true on Cap/emulator and remounts reset the budget, trapping the
 * splash. SSR always paints the form so hydration cannot leave a stuck cover.
 */
export function LoginSessionGate({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <LoginSessionGateInner>{children}</LoginSessionGateInner>
    </Suspense>
  );
}

function subscribeNoop() {
  return () => {};
}

function LoginSessionGateInner({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();
  const signedOutParam = searchParams.get("signedOut") === "1";
  const mounted = useIsClient();
  const sessionLogout = useSyncExternalStore(subscribeNoop, hasExplicitLogout, () => false);
  const [coverBudgetElapsed, setCoverBudgetElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setCoverBudgetElapsed(true), AUTH_COVER_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const explicitLogout = signedOutParam || sessionLogout;
  const cover = mounted && !explicitLogout && isAuthenticated && !coverBudgetElapsed;

  useEffect(() => {
    if (!mounted || explicitLogout || !isAuthenticated) return;
    const timer = window.setTimeout(() => {
      if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
        return;
      }
      prepareHardNavigation();
      window.location.replace("/dashboard");
    }, FORCE_LEAVE_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, [mounted, explicitLogout, isAuthenticated]);

  return (
    <>
      <div className={cover ? "invisible h-0 overflow-hidden" : undefined} aria-hidden={cover}>
        {children}
      </div>
      {cover ? <AppSplash label="Opening workspace…" /> : null}
    </>
  );
}
