"use client";

import { type ReactNode, Suspense, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useIsClient } from "@/hooks/use-is-client";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import { prepareHardNavigation } from "@/lib/auth/redirect-after-login";
import { readPlatformOfflineSession } from "@/lib/offline/platform-cache";

/**
 * If still on /login with a live session, hard-leave so "Welcome" cannot
 * strand the form. Does **not** paint AppSplash — the login form owns
 * “Opening workspace…” so credential unlock does not stack brand covers.
 */
const FORCE_LEAVE_BUDGET_MS = 6000;

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

  const explicitLogout = signedOutParam || sessionLogout;

  useEffect(() => {
    if (!mounted || explicitLogout || !isAuthenticated) return;
    const timer = window.setTimeout(() => {
      if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
        return;
      }
      prepareHardNavigation();
      // Platform-only sessions must not hard-leave into the tenant dashboard
      // (that revived a prior cashier and painted Continue as…).
      const platform = readPlatformOfflineSession();
      const target = platform
        ? "/platform?fromLogin=1"
        : "/dashboard?fromLogin=1";
      window.location.replace(target);
    }, FORCE_LEAVE_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, [mounted, explicitLogout, isAuthenticated]);

  return <>{children}</>;
}
