import type { ReactNode } from "react";
import { MarketingSiteShell } from "@/features/marketing/components/marketing-site-shell";

/** Marketing site must not call headers() — inherits static-friendly root providers. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return <MarketingSiteShell>{children}</MarketingSiteShell>;
}
