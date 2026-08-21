import Link from "next/link";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import { LandingPosStage } from "@/features/marketing/components/landing-pos-stage";

/**
 * Hero layout mirrored from Vital-Go (health.vital-go.org):
 * soft upper blue wash → large white sheet overlapping mid-hero →
 * organic blobs behind the product visual. Novend Candy Blue palette.
 */
export function LandingHero() {
  return (
    <section className="landing-hero relative isolate overflow-hidden px-4 sm:px-6 lg:px-8">
      {/* Page-level wash layers (Vital-Go: gradient sheet + white blend sheet) */}
      <div className="landing-hero-layers" aria-hidden>
        <div className="landing-hero-wash-sheet" />
        <div className="landing-hero-white-sheet" />
        <div className="landing-hero-accent-blob" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 pt-10 pb-16 lg:grid-cols-[0.95fr_1.15fr] lg:gap-12 lg:pt-14 lg:pb-24">
        <div data-hero-copy>
          <p className="text-primary mb-4 text-sm font-semibold tracking-wide">
            {landingCopy.hero.eyebrow}
          </p>
          <h1 className="text-foreground max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3rem] lg:leading-[1.12]">
            {landingCopy.hero.headline}
          </h1>
          <p className="text-muted-foreground mt-5 max-w-lg text-base leading-relaxed text-pretty sm:text-lg">
            {landingCopy.hero.subhead}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Button asChild size="lg" className="h-11 px-6 text-[15px] font-semibold">
              <Link href="/login">{landingCopy.hero.primaryCta}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-11 px-6 text-[15px] font-semibold">
              <a href="#contact">{landingCopy.hero.secondaryCta}</a>
            </Button>
          </div>
        </div>

        <div data-hero-visual className="relative mx-auto w-full">
          {/* Organic aura behind product (Vital-Go hero-visual blobs) */}
          <div className="landing-hero-visual-aura" aria-hidden>
            <span className="landing-hero-aura landing-hero-aura-a" />
            <span className="landing-hero-aura landing-hero-aura-b" />
            <span className="landing-hero-aura landing-hero-aura-c" />
            <span className="landing-hero-aura landing-hero-aura-d" />
          </div>
          <div className="landing-perspective relative z-10 mx-auto w-full pt-4 sm:pt-6">
            <LandingPosStage />
          </div>
        </div>
      </div>
    </section>
  );
}
