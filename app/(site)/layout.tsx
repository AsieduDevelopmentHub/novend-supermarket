import type { ReactNode } from "react";
import { MarketingSiteShell } from "@/features/marketing/components/marketing-site-shell";

export default function SiteLayout({ children }: { children: ReactNode }) {
  return <MarketingSiteShell>{children}</MarketingSiteShell>;
}
