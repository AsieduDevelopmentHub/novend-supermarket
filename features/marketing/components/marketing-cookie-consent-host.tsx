"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isCapacitor, isElectron } from "@novend/hardware";
import { CookieConsentBanner } from "@/features/marketing/components/cookie-consent-banner";
import { isStandaloneWebApp } from "@/lib/device-install";
import { isMarketingPath } from "@/lib/marketing-routes";

/**
 * Single app-wide host for the marketing cookie banner.
 * Keeps one instance across `/` ↔ docs/legal navigations so a saved choice
 * is not lost to remount races between LandingPage and MarketingSiteShell.
 */
export function MarketingCookieConsentHost() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const marketing = isMarketingPath(pathname);
      const embedded = isCapacitor() || isElectron() || isStandaloneWebApp();
      setEnabled(marketing && !embedded);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return <CookieConsentBanner enabled={enabled} />;
}
