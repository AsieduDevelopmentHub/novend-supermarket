"use client";

import { type ReactNode, Suspense, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { useIsClient } from "@/hooks/use-is-client";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import {
  isPostLoginLeavePending,
  prepareHardNavigation,
} from "@/lib/auth/redirect-after-login";
import { readPlatformOfflineSession } from "@/lib/offline/platform-cache";

/**
 * Escape hatch only: if still on /login with a live session and the login form
 * did not own a leave, hard-leave so "Welcome" cannot strand the form.
 *
 * Credential unlock marks `postLoginLeave` before resolve — this gate must not
 * race that path (mid-bind leave caused first-login bounce to /login).
 */
const FORCE_LEAVE_BUDGET_MS = 10_000;

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
    if (isPostLoginLeavePending()) return;

    const timer = window.setTimeout(() => {
      if (window.location.pathname !== "/login" && window.location.pathname !== "/signup") {
        return;
      }
      if (isPostLoginLeavePending()) return;

      prepareHardNavigation();
      // Prefer platform console only when a platform marker is already claimed
      // (tenant bind clears it). Otherwise dashboard — shell redirects platform admins.
      const platform = readPlatformOfflineSession();
      const target =
        platform && !platform.hasTenantRole
          ? "/platform?fromLogin=1"
          : "/dashboard?fromLogin=1";
      window.location.replace(target);
    }, FORCE_LEAVE_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, [mounted, explicitLogout, isAuthenticated]);

  return <>{children}</>;
}
