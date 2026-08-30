"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useConvexAuth } from "convex/react";
import { AppSplash } from "@/features/auth/components/app-splash";

/** Cap/emulator Convex often stays isLoading forever — never cover the login form past this. */
const AUTH_COVER_BUDGET_MS = 4000;

/**
 * Covers the login brand chrome while a live session is still settling.
 * Children stay mounted (hidden) so LoginForm redirect effects still run.
 */
export function LoginSessionGate({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [coverBudgetElapsed, setCoverBudgetElapsed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setCoverBudgetElapsed(true), AUTH_COVER_BUDGET_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Cover only while Convex is actually settling or a live session is about to
  // leave /login. Do not pin the splash to Capacitor, fromBoot, or a leftover
  // Dexie flag — those stay true after auth has already failed.
  const coverAuthenticated = isAuthenticated && !coverBudgetElapsed;
  const coverWhileLoading = isLoading && !coverBudgetElapsed;
  const cover = coverAuthenticated || coverWhileLoading;

  const label = coverAuthenticated ? "Opening workspace…" : "Starting Novend POS…";

  return (
    <>
      <div className={cover ? "invisible h-0 overflow-hidden" : undefined} aria-hidden={cover}>
        {children}
      </div>
      {cover ? <AppSplash label={label} /> : null}
    </>
  );
}
