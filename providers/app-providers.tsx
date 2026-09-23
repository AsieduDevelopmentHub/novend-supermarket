"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { usePathname } from "next/navigation";
import { ReactNode, useMemo } from "react";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import {
  AppearanceBootstrap,
  AppearanceProfileSync,
  THEME_STORAGE_KEY,
} from "@/hooks/use-appearance";
import { MarketingCookieConsentHost } from "@/features/marketing/components/marketing-cookie-consent-host";
import { isMarketingPath } from "@/lib/marketing-routes";
import { StartupSplash } from "@/providers/startup-splash";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

function AppThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const pathname = usePathname();
  const forcedTheme = isMarketingPath(pathname) ? "light" : undefined;

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      forcedTheme={forcedTheme}
      storageKey={THEME_STORAGE_KEY}
      nonce={nonce}
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
        <Toaster />
      </AppearanceBootstrap>
    </AppThemeProvider>
  );
}

export function AppProviders({ children, nonce }: { children: ReactNode; nonce?: string }) {
  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, []);

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
          <Toaster />
        </AppearanceBootstrap>
      </AppThemeProvider>
    </ConvexAuthNextjsProvider>
  );
}

export function hasConvexConfig() {
  return Boolean(convexUrl);
}
