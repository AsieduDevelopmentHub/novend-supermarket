import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { ThemeBootScript } from "@/components/theme-boot-script";
import { PublicSiteHostProvider } from "@/features/auth/components/public-site-host";
import { buildAppShellMetadata } from "@/lib/seo/metadata";
import { NonceProvider } from "@/providers/nonce-provider";
import AppLayoutClient from "./app-layout-client";

export const metadata: Metadata = buildAppShellMetadata();

/**
 * Dynamic app shell: reads CSP nonce for ThemeBootScript / NonceProvider.
 * Root layout intentionally does not call headers() so marketing stays static-friendly.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const nonce = headerList.get("x-nonce") ?? undefined;
  const requestHost = headerList.get("x-forwarded-host") ?? headerList.get("host");

  return (
    <NonceProvider nonce={nonce}>
      <PublicSiteHostProvider host={requestHost}>
        {nonce ? <ThemeBootScript nonce={nonce} /> : null}
        <AppLayoutClient>{children}</AppLayoutClient>
      </PublicSiteHostProvider>
    </NonceProvider>
  );
}
