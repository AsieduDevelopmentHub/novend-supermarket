"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { LandingNav } from "@/features/marketing/components/landing-nav";
import { LandingFooter } from "@/features/marketing/components/landing-footer";
import { useLandingReveal } from "@/features/marketing/hooks/use-landing-motion";
import { isCapacitor, isElectron } from "@novend/hardware";
import { isStandaloneWebApp } from "@/lib/device-install";

/** Shared public marketing chrome for docs/legal/product/pricing (scroll + footer). */
export function MarketingSiteShell({ children }: { children: ReactNode }) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);
  const [embedded, setEmbedded] = useState<boolean | null>(null);

  useLandingReveal(pageRef, { scroller: scrollRef });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEmbedded(isCapacitor() || isElectron() || isStandaloneWebApp());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      ref={scrollRef}
      className={`${embedded === false ? "marketing-forced-light bg-[#F8FAFC]" : "bg-background"} text-foreground h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-smooth`}
    >
      {embedded === false ? <LandingNav scrollRootRef={scrollRef} /> : null}
      <main
        ref={pageRef}
        className={`min-h-[70dvh] pb-4 ${embedded ? "pt-4" : "pt-24 sm:pt-28"}`}
      >
        {children}
      </main>
      {embedded === false ? <LandingFooter /> : null}
    </div>
  );
}
