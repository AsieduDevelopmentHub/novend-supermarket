"use client";

import { type ReactNode, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConvexAuth } from "convex/react";
import { AppSplash } from "@/features/auth/components/app-splash";
import { hasExplicitLogout } from "@/lib/auth/logout-flag";

/** Cap/emulator Convex can stay isAuthenticated briefly after sign-out. */
const AUTH_COVER_BUDGET_MS = 4000;

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

function LoginSessionGateInner({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useConvexAuth();
  const searchParams = useSearchParams();
  const signedOutParam = searchParams.get("signedOut") === "1";
  const [mounted, setMounted] = useState(false);
  const [sessionLogout, setSessionLogout] = useState(false);
  const [coverBudgetElapsed, setCoverBudgetElapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    setSessionLogout(hasExplicitLogout());
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setCoverBudgetElapsed(true), AUTH_COVER_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const explicitLogout = signedOutParam || sessionLogout;
  const cover = mounted && !explicitLogout && isAuthenticated && !coverBudgetElapsed;

  return (
    <>
      <div className={cover ? "invisible h-0 overflow-hidden" : undefined} aria-hidden={cover}>
        {children}
      </div>
      {cover ? <AppSplash label="Opening workspace…" /> : null}
    </>
  );
}
