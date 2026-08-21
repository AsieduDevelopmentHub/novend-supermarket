import Image from "next/image";
import Link from "next/link";
import { BRANDING } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import { LandingAtmosphere } from "@/features/marketing/components/landing-atmosphere";
import { LandingPosStage } from "@/features/marketing/components/landing-pos-stage";

/** Product-first hero — copy + isometric Novend POS stage. */
export function LandingHero() {
  return (
    <section className="landing-hero relative isolate overflow-hidden px-4 pb-8 sm:px-6 lg:px-8">
      <LandingAtmosphere />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 pt-10 pb-20 lg:grid-cols-[1fr_1.05fr] lg:gap-10 lg:pt-14 lg:pb-28">
        <div data-hero-copy>
          <Image
            data-hero-brand
            src={BRANDING.logoHorizontal}
            alt={landingCopy.brand}
            width={200}
            height={48}
            className="mb-8 h-10 w-auto object-contain sm:h-11"
            priority
          />
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

        <div data-hero-visual className="landing-perspective relative mx-auto w-full pt-6 sm:pt-8">
          <LandingPosStage />
        </div>
      </div>
    </section>
  );
}
