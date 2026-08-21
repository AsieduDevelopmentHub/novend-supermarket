"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { ReactNode, useMemo } from "react";
import Link from "next/link";
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
            Convex is not configured. Set{" "}
            <code className="bg-card rounded px-1">NEXT_PUBLIC_CONVEX_URL</code> in{" "}
            <code className="bg-card rounded px-1">.env.local</code> after running{" "}
            <code className="bg-card rounded px-1">npx convex dev</code>.{" "}
            <Link href="/login" className="font-medium underline">
              Continue to login UI
            </Link>
          </div>
          {children}
        </div>
        <Toaster richColors position="top-right" />
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
          <Toaster richColors position="top-right" />
        </AppearanceBootstrap>
      </ThemeProvider>
    </ConvexAuthNextjsProvider>
  );
}

export function hasConvexConfig() {
  return Boolean(convexUrl);
}
