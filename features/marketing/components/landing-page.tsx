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
import { LandingJourney } from "@/features/marketing/components/landing-journey";
import { LandingIndustries } from "@/features/marketing/components/landing-industries";
import { LandingWhy } from "@/features/marketing/components/landing-why";
import { LandingPricing } from "@/features/marketing/components/landing-pricing";
import { LandingFaq } from "@/features/marketing/components/landing-faq";
import { LandingCta } from "@/features/marketing/components/landing-cta";
import { LandingFooter } from "@/features/marketing/components/landing-footer";

/**
 * Web-only SaaS landing — product DNA shared with login/app UI.
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
      className="bg-background text-foreground h-dvh overflow-x-hidden overflow-y-auto overscroll-y-contain"
    >
      <div ref={pageRef}>
        <LandingNav scrollRootRef={scrollRef} />
        <main>
          <LandingHero />
          <LandingJourney />
          <LandingIndustries />
          <LandingWhy />
          <LandingPricing />
          <LandingFaq />
          <LandingCta />
        </main>
        <LandingFooter />
      </div>
    </div>
  );
}
