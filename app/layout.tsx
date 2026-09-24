import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { AppProviders } from "@/providers/app-providers";
import { PwaRegister } from "@/components/pwa-register";
import { buildRootMetadata } from "@/lib/seo/metadata";

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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html lang="en" className="h-full" suppressHydrationWarning>
      <body className="bg-background text-foreground h-full overflow-hidden font-sans antialiased">
        <ConvexAuthNextjsServerProvider>
          <AppProviders nonce={nonce}>
            {children}
            <PwaRegister />
          </AppProviders>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}
