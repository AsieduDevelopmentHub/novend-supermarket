import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import { LandingHeroProductStage } from "@/features/marketing/components/landing-hero-product-stage";
import { appEntryHref } from "@/lib/hosting/hosts";

/** Hero — asymmetric split with POS monitor visual (brief §3A.2). */
export function LandingHero() {
  const { hero } = landingCopy;
  const signupHref = appEntryHref("/signup");

  return (
    <section className="relative isolate overflow-hidden bg-[#F8FAFC] px-4 pt-[80px] pb-10 sm:px-6 sm:pt-[88px] lg:px-8 lg:pb-14">
      <div className="mx-auto max-w-[1240px]">
        <div className="landing-editorial-hero-panel relative overflow-hidden rounded-[32px]">
          <div className="landing-editorial-hero-wash" aria-hidden />
          <div className="landing-editorial-hero-grid" aria-hidden />

          <div className="relative z-10 grid items-center gap-10 px-6 py-12 sm:px-10 sm:py-14 lg:grid-cols-[minmax(0,0.46fr)_minmax(0,0.54fr)] lg:gap-8 lg:px-14 lg:py-16 xl:min-h-[720px]">
            <div data-hero-copy className="max-w-[580px]">
              <p className="border-primary/25 bg-primary/10 text-primary inline-flex rounded-full border px-3 py-1 text-[12px] font-semibold tracking-wide">
                {hero.eyebrow}
              </p>

              <h1 className="mt-5 text-[2.5rem] leading-[1.04] font-semibold tracking-tight text-balance text-[#0B1220] sm:text-5xl lg:text-[4.25rem] lg:leading-[1.02]">
                {hero.headlineLead} <span className="text-[#0284C7]">{hero.headlineAccent}</span>
                {hero.headlineTrail}
              </h1>

              <p className="mt-5 max-w-[580px] text-base leading-relaxed text-pretty text-[#526174] sm:text-lg">
                {hero.subhead}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="h-12 w-full rounded-full px-7 text-[15px] font-semibold sm:w-auto"
                >
                  <Link href={signupHref}>{hero.primaryCta}</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 w-full rounded-full border-[rgba(11,18,32,0.12)] bg-white/90 px-7 text-[15px] font-semibold text-[#0B1220] sm:w-auto"
                >
                  <Link href={hero.secondaryHref}>{hero.secondaryCta}</Link>
                </Button>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2.5">
                {hero.proofRow.map((item) => (
                  <li
                    key={item}
                    className="inline-flex items-center gap-2 text-sm font-medium text-[#0B1220]"
                  >
                    <span className="bg-primary/15 text-primary flex h-5 w-5 items-center justify-center rounded-full">
                      <Check className="h-3 w-3" strokeWidth={2.75} aria-hidden />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div
              data-hero-visual
              className="relative flex items-center justify-center lg:justify-end"
            >
              <LandingHeroProductStage />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
