import type { Metadata, Viewport } from "next";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { AppProviders } from "@/providers/app-providers";
import { PwaRegister } from "@/components/pwa-register";
import { buildRootMetadata } from "@/lib/seo/metadata";
import { FULLY_OFFLINE } from "@/constants/runtime";

import "@/styles/globals.css";

export const metadata: Metadata = buildRootMetadata();

export const viewport: Viewport = {
  themeColor: [
    // Browser chrome hint only; in-app appearance follows the `.dark` class (not OS).
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0B1F33" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

/**
 * Root layout is static-friendly: does not read request headers or a CSP nonce.
 * Millie's fully offline skips Convex Auth server provider entirely.
 */
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const body = (
    <AppProviders>
      {children}
      <PwaRegister />
    </AppProviders>
  );

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="bg-background text-foreground h-full overflow-hidden font-sans antialiased">
        {FULLY_OFFLINE ? body : <ConvexAuthNextjsServerProvider>{body}</ConvexAuthNextjsServerProvider>}
      </body>
    </html>
  );
}
