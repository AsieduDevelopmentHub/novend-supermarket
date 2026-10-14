"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { ReactNode, useCallback, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import {
  AppearanceBootstrap,
  AppearanceProfileSync,
  THEME_STORAGE_KEY,
} from "@/hooks/use-appearance";
import { MarketingCookieConsentHost } from "@/features/marketing/components/marketing-cookie-consent-host";
import { isMarketingPath } from "@/lib/marketing-routes";
import { useNonce } from "@/providers/nonce-provider";
import { StaleClientRecovery } from "@/features/auth/components/stale-client-recovery";
import { StartupSplash } from "@/providers/startup-splash";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { hasMilliesSession, readMilliesSession } from "@/lib/offline/millies-auth";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
/** Placeholder so Convex React hooks have a client; Millie's never calls the network. */
const OFFLINE_CLIENT_URL = "https://millies-local.invalid";

function AppThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const pathname = usePathname();
  const contextNonce = useNonce();
  const resolvedNonce = nonce ?? contextNonce;
  const forcedTheme = isMarketingPath(pathname) ? "light" : undefined;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      forcedTheme={forcedTheme}
      storageKey={THEME_STORAGE_KEY}
      nonce={resolvedNonce}
    >
      {children}
    </ThemeProvider>
  );
}

function MissingConvexConfig({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <AppThemeProvider nonce={nonce}>
      <AppearanceBootstrap>
        <div className="bg-background min-h-screen">
          <div className="border-warning/30 bg-accent text-accent-foreground border-b px-4 py-3 text-sm">
            Novend isn&apos;t fully configured for this environment yet.{" "}
            <Link href="/login" className="font-medium underline">
              Continue to sign in
            </Link>
          </div>
          {children}
        </div>
        <MarketingCookieConsentHost />
        <StaleClientRecovery />
        <Toaster />
      </AppearanceBootstrap>
    </AppThemeProvider>
  );
}

function subscribeMilliesSession(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onStoreChange);
  // Same-tab session writes use sessionStorage — poll lightly via focus.
  window.addEventListener("focus", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("focus", onStoreChange);
  };
}

function useMilliesAuthForConvex() {
  const hasSession = useSyncExternalStore(
    subscribeMilliesSession,
    () => hasMilliesSession(),
    () => false,
  );
  const fetchAccessToken = useCallback(async () => null, []);
  return {
    isLoading: false,
    // Keep Convex auth "logged out" so live queries stay skipped; shell uses Dexie session.
    isAuthenticated: false,
    fetchAccessToken,
    // Expose for diagnostics / future — unused by ConvexProviderWithAuth.
    milliesAuthenticated: hasSession || Boolean(readMilliesSession()),
  };
}

function FullyOfflineProviders({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const client = useMemo(() => new ConvexReactClient(OFFLINE_CLIENT_URL), []);
  return (
    <ConvexProviderWithAuth client={client} useAuth={useMilliesAuthForConvex}>
      <AppThemeProvider nonce={nonce}>
        <AppearanceBootstrap>
          <StartupSplash>{children}</StartupSplash>
          <Toaster />
        </AppearanceBootstrap>
      </AppThemeProvider>
    </ConvexProviderWithAuth>
  );
}

/**
 * `nonce` is optional. Root leaves it unset (static marketing CSP + ThemeBootScript
 * on app/auth). Prefer NonceProvider from app/(app) and app/(auth) for consumers.
 */
export function AppProviders({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const client = useMemo(() => {
    if (FULLY_OFFLINE || !convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, []);

  if (FULLY_OFFLINE) {
    return <FullyOfflineProviders nonce={nonce}>{children}</FullyOfflineProviders>;
  }

  if (!client) {
    return <MissingConvexConfig nonce={nonce}>{children}</MissingConvexConfig>;
  }

  return (
    <ConvexAuthNextjsProvider client={client}>
      <AppThemeProvider nonce={nonce}>
        <AppearanceBootstrap>
          <AppearanceProfileSync />
          <StartupSplash>{children}</StartupSplash>
          <MarketingCookieConsentHost />
          <StaleClientRecovery />
          <Toaster />
        </AppearanceBootstrap>
      </AppThemeProvider>
    </ConvexAuthNextjsProvider>
  );
}

export function hasConvexConfig() {
  if (FULLY_OFFLINE) return false;
  return Boolean(convexUrl);
}
