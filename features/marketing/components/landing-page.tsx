"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import {
  useLandingDepth,
  useLandingHeroIntro,
  useLandingReveal,
} from "@/features/marketing/hooks/use-landing-motion";
import { LandingNav } from "@/features/marketing/components/landing-nav";
import { LandingHero } from "@/features/marketing/components/landing-hero";
import { LandingArchitecture } from "@/features/marketing/components/landing-architecture";
import { LandingHowItWorks } from "@/features/marketing/components/landing-how-it-works";
import { LandingFeatures } from "@/features/marketing/components/landing-features";
import { LandingIndustries } from "@/features/marketing/components/landing-industries";
import { LandingPricing } from "@/features/marketing/components/landing-pricing";
import { LandingFaq } from "@/features/marketing/components/landing-faq";
import { LandingCta } from "@/features/marketing/components/landing-cta";
import { LandingFooter } from "@/features/marketing/components/landing-footer";
import { CookieConsentBanner } from "@/features/marketing/components/cookie-consent-banner";

/**
 * Web-only SaaS landing V3 — reference layout with Novend brand tokens.
 * Electron detects `novendDesktop` and leaves for /dashboard.
 */
export function LandingPage() {
  const isDesktop = useDesktopRuntime();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  useLandingHeroIntro(pageRef);
  useLandingReveal(pageRef, { scroller: scrollRef });
  useLandingDepth(pageRef, scrollRef);

  useEffect(() => {
    if (isDesktop) {
      router.replace("/dashboard");
    }
  }, [isDesktop, router]);

  if (isDesktop) {
    return (
      <div className="bg-background text-muted-foreground flex min-h-dvh items-center justify-center text-sm">
        Opening Novend POS…
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="marketing-forced-light text-foreground h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain bg-[#F8FAFC]"
    >
      <div ref={pageRef}>
        <LandingNav scrollRootRef={scrollRef} />
        <main>
          <LandingHero />
          <LandingArchitecture />
          <LandingHowItWorks />
          <LandingFeatures />
          <LandingIndustries />
          <LandingPricing />
          <LandingFaq />
          <LandingCta />
        </main>
        <LandingFooter />
        <CookieConsentBanner />
      </div>
    </div>
  );
}
