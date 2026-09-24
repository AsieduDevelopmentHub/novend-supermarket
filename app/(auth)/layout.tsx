import type { ReactNode } from "react";
import { headers } from "next/headers";
import { ThemeBootScript } from "@/components/theme-boot-script";
import { NonceProvider } from "@/providers/nonce-provider";

/**
 * Auth pages need the CSP nonce for theme boot scripts.
 * Kept out of the root layout so marketing routes stay static-friendly.
 */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <NonceProvider nonce={nonce}>
      {nonce ? <ThemeBootScript nonce={nonce} /> : null}
      {children}
    </NonceProvider>
  );
}
