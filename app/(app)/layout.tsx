import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { ThemeBootScript } from "@/components/theme-boot-script";
import { buildAppShellMetadata } from "@/lib/seo/metadata";
import { NonceProvider } from "@/providers/nonce-provider";
import AppLayoutClient from "./app-layout-client";

export const metadata: Metadata = buildAppShellMetadata();

/**
 * Dynamic app shell: reads CSP nonce for ThemeBootScript / NonceProvider.
 * Root layout intentionally does not call headers() so marketing stays static-friendly.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <NonceProvider nonce={nonce}>
      {nonce ? <ThemeBootScript nonce={nonce} /> : null}
      <AppLayoutClient>{children}</AppLayoutClient>
    </NonceProvider>
  );
}
