import type { ReactNode } from "react";
import { headers } from "next/headers";
import { ThemeBootScript } from "@/components/theme-boot-script";
import { PublicSiteHostProvider } from "@/features/auth/components/public-site-host";
import { NonceProvider } from "@/providers/nonce-provider";

/**
 * Auth pages need the CSP nonce for theme boot scripts.
 * Kept out of the root layout so marketing routes stay static-friendly.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const headerList = await headers();
  const nonce = headerList.get("x-nonce") ?? undefined;
  const requestHost = headerList.get("x-forwarded-host") ?? headerList.get("host");

  return (
    <NonceProvider nonce={nonce}>
      <PublicSiteHostProvider host={requestHost}>
        {nonce ? <ThemeBootScript nonce={nonce} /> : null}
        {children}
      </PublicSiteHostProvider>
    </NonceProvider>
  );
}
