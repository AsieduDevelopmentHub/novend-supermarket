"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LandingNav } from "@/features/marketing/components/landing-nav";
import { LandingFooter } from "@/features/marketing/components/landing-footer";
import { CookieConsentBanner } from "@/features/marketing/components/cookie-consent-banner";
import { isCapacitor, isElectron } from "@novend/hardware";
import { isStandaloneWebApp } from "@/lib/device-install";

/** Shared public marketing chrome for docs/legal pages (matches landing scroll + footer). */
export function MarketingSiteShell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [embedded, setEmbedded] = useState<boolean | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEmbedded(isCapacitor() || isElectron() || isStandaloneWebApp());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      ref={scrollRef}
      className={`${embedded === false ? "marketing-forced-light bg-[#F8FAFC]" : "bg-background"} text-foreground h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain`}
    >
      {embedded === false ? <LandingNav scrollRootRef={scrollRef} /> : null}
      <main className={`min-h-[70dvh] pb-4 ${embedded ? "pt-4" : "pt-24 sm:pt-28"}`}>
        {children}
      </main>
      {embedded === false ? <LandingFooter /> : null}
      {embedded === false ? <CookieConsentBanner /> : null}
    </div>
  );
}
