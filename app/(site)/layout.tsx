import type { ReactNode } from "react";
import { MarketingSiteShell } from "@/features/marketing/components/marketing-site-shell";
import { GoogleAnalytics } from "@/lib/analytics/google-analytics";

/** Marketing site must not call headers() — inherits static-friendly root providers. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <MarketingSiteShell>
      <GoogleAnalytics />
      {children}
    </MarketingSiteShell>
  );
}
