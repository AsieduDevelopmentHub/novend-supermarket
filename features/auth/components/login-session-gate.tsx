"use client";

import { type ReactNode, Suspense, useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { isElectron } from "@novend/hardware";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { useIsClient } from "@/hooks/use-is-client";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";
import {
  isPostLoginLeavePending,
  prepareHardNavigation,
} from "@/lib/auth/redirect-after-login";
import { getDesktopBridge } from "@/lib/desktop";
import { readPlatformOfflineSession } from "@/lib/offline/platform-cache";
import { readMilliesSession } from "@/lib/offline/millies-auth";

/**
 * Escape hatch: if still on /login with a live session, hard-leave so "Welcome"
 * / “Opening your workspace” cannot strand the form forever.
 *
 * Credential unlock marks `postLoginLeave` before resolve — do not race that
 * for the first few seconds. After STUCK_LEAVE_BUDGET_MS, force leave even
 * while leave is pending (hung me resolve or hung Electron HTTPS replace).
 */
const FORCE_LEAVE_BUDGET_MS = 6_000;
const STUCK_LEAVE_BUDGET_MS = 12_000;

export function LoginSessionGate({ children }: { children: ReactNode }) {
  if (FULLY_OFFLINE) {
    return <MilliesLoginSessionGate>{children}</MilliesLoginSessionGate>;
  }
  return (
    <Suspense fallback={children}>
      <LoginSessionGateInner>{children}</LoginSessionGateInner>
    </Suspense>
  );
}

function MilliesLoginSessionGate({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (hasExplicitLogout()) return;
    if (!readMilliesSession()) return;
    hardLeaveToShell("/sales?fromLogin=1");
  }, []);
  return <>{children}</>;
}

function subscribeNoop() {
  return () => {};
}

function postLoginTarget(): string {
  const platform = readPlatformOfflineSession();
  return platform && !platform.hasTenantRole
    ? "/platform?fromLogin=1"
    : "/dashboard?fromLogin=1";
}

function hardLeaveToShell(target: string): void {
  prepareHardNavigation();
  if (isElectron()) {
    void (async () => {
      try {
        const result = await getDesktopBridge()?.reloadAuthShell(target);
        if (result?.ok) return;
      } catch {
        /* fall through */
      }
      try {
        window.location.replace(target);
      } catch {
        window.location.href = target;
      }
    })();
    return;
  }
  window.location.replace(target);
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

    const leavePending = isPostLoginLeavePending();
    const budget = leavePending ? STUCK_LEAVE_BUDGET_MS : FORCE_LEAVE_BUDGET_MS;
    const timer = window.setTimeout(() => {
      if (hasExplicitLogout()) return;
      hardLeaveToShell(postLoginTarget());
    }, budget);
    return () => window.clearTimeout(timer);
  }, [mounted, explicitLogout, isAuthenticated]);

  return <>{children}</>;
}
