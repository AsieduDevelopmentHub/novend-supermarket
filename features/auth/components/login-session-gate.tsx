"use client";

import { Suspense, type ReactNode } from "react";
import { useConvexAuth } from "convex/react";
import { useSearchParams } from "next/navigation";
import { isCapacitor } from "@novend/hardware";
import { AppSplash } from "@/features/auth/components/app-splash";
import { hasOfflineSession } from "@/lib/offline/session";

/**
 * Covers the login brand chrome while a live or cached session is still settling.
 * Children stay mounted (hidden) so LoginForm redirect effects still run.
 */
function LoginSessionGateInner({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const searchParams = useSearchParams();
  const fromBoot = searchParams.get("fromBoot") === "1";
  const cached = typeof window !== "undefined" && hasOfflineSession();
  const native = typeof window !== "undefined" && isCapacitor();

  const coverAuthenticated = isAuthenticated;
  const coverCachedResume = cached && (fromBoot || native || isLoading);
  const coverBootAuthWait = (fromBoot || native) && isLoading && !cached;
  const cover = coverAuthenticated || coverCachedResume || coverBootAuthWait;

  const label =
    coverAuthenticated || coverCachedResume ? "Opening workspace…" : "Starting Novend POS…";

  return (
    <>
      <div className={cover ? "invisible h-0 overflow-hidden" : undefined} aria-hidden={cover}>
        {children}
      </div>
      {cover ? <AppSplash label={label} /> : null}
    </>
  );
}

export function LoginSessionGate({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppSplash label="Starting Novend POS…" />}>
      <LoginSessionGateInner>{children}</LoginSessionGateInner>
    </Suspense>
  );
}
