import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import { LandingDashboardStage } from "@/features/marketing/components/landing-dashboard-stage";

export function LandingHero() {
  return (
    <section className="landing-hero relative isolate overflow-hidden px-4 sm:px-6 lg:px-8">
      <div className="landing-hero-layers" aria-hidden>
        <div className="landing-hero-wash-sheet" />
        <div className="landing-hero-white-sheet" />
        <div className="landing-hero-accent-blob" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 pt-8 pb-12 sm:gap-12 sm:pt-10 sm:pb-16 lg:grid-cols-[0.95fr_1.15fr] lg:gap-12 lg:pt-14 lg:pb-20">
        <div data-hero-copy>
          <p className="text-primary mb-3 text-sm font-semibold tracking-wide sm:mb-4">
            {landingCopy.hero.eyebrow}
          </p>
          <h1 className="text-foreground max-w-xl text-[2rem] leading-tight font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3rem] lg:leading-[1.12]">
            {landingCopy.hero.headline}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-lg text-base leading-relaxed text-pretty sm:mt-5 sm:text-lg">
            {landingCopy.hero.subhead}
          </p>
          <div className="mt-7 flex w-full flex-col gap-3 sm:mt-9 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <Button
              asChild
              size="lg"
              className="landing-shadow-cta-primary h-11 w-full px-6 text-[15px] font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5 sm:w-auto"
            >
              <Link href="/signup">{landingCopy.hero.primaryCta}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="landing-shadow-cta-outline h-11 w-full px-6 text-[15px] font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5 sm:w-auto"
            >
              <a href="#analytics">{landingCopy.hero.secondaryCta}</a>
            </Button>
          </div>
          <ul className="mt-6 flex flex-col gap-2 sm:mt-8 sm:flex-row sm:flex-wrap sm:gap-x-5 sm:gap-y-2">
            {landingCopy.hero.trustBadges.map((badge) => (
              <li
                key={badge}
                className="text-muted-foreground flex items-center gap-2 text-sm font-medium"
              >
                <CheckCircle2 className="text-primary h-4 w-4 shrink-0" aria-hidden />
                {badge}
              </li>
            ))}
          </ul>
        </div>

        <div data-hero-visual className="relative mx-auto w-full max-w-[380px] lg:max-w-none">
          <div className="landing-hero-visual-aura hidden sm:block" aria-hidden>
            <span className="landing-hero-aura landing-hero-aura-a" />
            <span className="landing-hero-aura landing-hero-aura-b" />
            <span className="landing-hero-aura landing-hero-aura-c" />
            <span className="landing-hero-aura landing-hero-aura-d" />
          </div>
          <div className="landing-perspective relative z-10 mx-auto w-full pt-2 sm:pt-4">
            <LandingDashboardStage />
          </div>
        </div>
      </div>
    </section>
  );
}
