"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useDesktopRuntime } from "@/hooks/use-desktop-runtime";
import { useLandingHeroIntro, useLandingReveal } from "@/features/marketing/hooks/use-landing-motion";
import { LandingNav } from "@/features/marketing/components/landing-nav";
import { LandingHero } from "@/features/marketing/components/landing-hero";
import { LandingProofStrip } from "@/features/marketing/components/landing-proof-strip";
import { LandingEditorialFeatures } from "@/features/marketing/components/landing-editorial-features";
import { LandingOfflineFlow } from "@/features/marketing/components/landing-offline-flow";
import { LandingIndustries } from "@/features/marketing/components/landing-industries";
import { LandingResearchProof } from "@/features/marketing/components/landing-research-proof";
import { LandingPricingPreview } from "@/features/marketing/components/landing-pricing-preview";
import { LandingFaq } from "@/features/marketing/components/landing-faq";
import { LandingCta } from "@/features/marketing/components/landing-cta";
import { LandingFooter } from "@/features/marketing/components/landing-footer";

/**
 * Homepage per NOVEND_WEBSITE_REDESIGN_CURSOR_BRIEF — focused narrative, fewer sections.
 * Electron detects `novendDesktop` and leaves for /dashboard.
 */
export function LandingPage() {
  const isDesktop = useDesktopRuntime();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pageRef = useRef<HTMLDivElement | null>(null);

  useLandingHeroIntro(pageRef);
  useLandingReveal(pageRef, { scroller: scrollRef });

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
      className="marketing-forced-light text-foreground landing-page-canvas h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain scroll-smooth"
    >
      <a
        href="#product"
        className="bg-primary text-primary-foreground focus:ring-ring sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-md focus:px-3 focus:py-2 focus:ring-2"
      >
        Skip to product story
      </a>
      <div ref={pageRef}>
        <LandingNav scrollRootRef={scrollRef} />
        <main>
          <LandingHero />
          <LandingProofStrip />
          <LandingEditorialFeatures />
          <LandingOfflineFlow />
          <LandingIndustries />
          <LandingResearchProof />
          <LandingPricingPreview />
          <LandingFaq />
          <LandingCta />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
