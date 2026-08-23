"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { ReactNode, useMemo } from "react";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import {
  AppearanceBootstrap,
  AppearanceProfileSync,
  THEME_STORAGE_KEY,
} from "@/hooks/use-appearance";
import { StartupSplash } from "@/providers/startup-splash";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

function MissingConvexConfig({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey={THEME_STORAGE_KEY}
    >
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
        <Toaster />
      </AppearanceBootstrap>
    </ThemeProvider>
  );
}

export function AppProviders({ children }: { children: ReactNode }) {
  const client = useMemo(() => {
    if (!convexUrl) return null;
    return new ConvexReactClient(convexUrl);
  }, []);

  if (!client) {
    return <MissingConvexConfig>{children}</MissingConvexConfig>;
  }

  return (
    <ConvexAuthNextjsProvider client={client}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey={THEME_STORAGE_KEY}
      >
        <AppearanceBootstrap>
          <AppearanceProfileSync />
          <StartupSplash>{children}</StartupSplash>
          <Toaster />
        </AppearanceBootstrap>
      </ThemeProvider>
    </ConvexAuthNextjsProvider>
  );
}

export function hasConvexConfig() {
  return Boolean(convexUrl);
}
