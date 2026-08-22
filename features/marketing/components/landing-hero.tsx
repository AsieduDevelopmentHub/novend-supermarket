import Link from "next/link";
import { Building2, ShieldCheck, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import { LandingHeroProductStage } from "@/features/marketing/components/landing-hero-product-stage";

const CHIP_ICONS = {
  offline: WifiOff,
  branches: Building2,
  secure: ShieldCheck,
} as const;

/** V3 hero — accented headline, dual CTAs, trust chips, dashboard monitor. */
export function LandingHero() {
  const { hero } = landingCopy;

  return (
    <section className="landing-v2-hero relative isolate min-h-dvh bg-white lg:min-h-screen">
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-4 pt-24 pb-16 sm:px-6 lg:min-h-screen lg:px-8 lg:pt-28 lg:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10 xl:gap-14">
          <div
            data-hero-visual
            className="order-1 flex items-center justify-center lg:order-2"
          >
            <LandingHeroProductStage />
          </div>

          <div data-hero-copy className="order-2 max-w-[560px] lg:order-1">
            <p className="text-primary text-[13px] font-semibold tracking-wide">
              {hero.badge}
            </p>

            <h1 className="text-[#111827] mt-4 text-[2rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.5rem] lg:leading-[1.08] xl:text-[4rem]">
              {hero.headlineLead}{" "}
              <span className="text-primary">{hero.headlineAccent}</span> Even{" "}
              <span className="text-primary">Offline.</span>
            </h1>

            <p className="text-slate-600 mt-5 text-base leading-relaxed text-pretty sm:text-lg">
              {hero.subhead}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-11 w-full px-6 text-[15px] font-semibold sm:w-auto"
              >
                <Link href="/signup">{hero.primaryCta}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 w-full border-primary/40 px-6 text-[15px] font-semibold text-[#111827] sm:w-auto"
              >
                <a href={hero.secondaryHref}>{hero.secondaryCta}</a>
              </Button>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3">
              {hero.trustChips.map((chip) => {
                const Icon = CHIP_ICONS[chip.id] ?? WifiOff;
                return (
                  <li
                    key={chip.id}
                    className="text-slate-700 inline-flex items-center gap-2 text-sm font-medium"
                  >
                    <span className="bg-primary/12 text-primary flex h-8 w-8 items-center justify-center rounded-lg">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    {chip.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
