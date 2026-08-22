import Link from "next/link";
import {
  Cloud,
  Monitor,
  ScanBarcode,
  Store,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import { LandingHeroProductStage } from "@/features/marketing/components/landing-hero-product-stage";

const TRUST_ICONS = [WifiOff, Monitor, Store, ScanBarcode] as const;
const METRIC_ICONS = [WifiOff, Store, ScanBarcode, Cloud] as const;

/** V2 hero — 100vh canvas, 6/6 split, dashboard product stage. */
export function LandingHero() {
  return (
    <section className="landing-v2-hero relative isolate min-h-dvh lg:min-h-screen">
      <div className="landing-v2-hero-mesh" aria-hidden />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-7xl flex-col justify-center px-4 pt-24 pb-16 sm:px-6 lg:min-h-screen lg:px-8 lg:pt-28 lg:pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-10 xl:gap-14">
          {/* Product stage first on tablet/mobile for visual impact */}
          <div
            data-hero-visual
            className="order-1 lg:order-2 flex items-center justify-center"
          >
            <LandingHeroProductStage />
          </div>

          <div data-hero-copy className="order-2 lg:order-1 max-w-[560px]">
            <p className="text-primary inline-flex items-center rounded-full border border-[#38BDF8]/30 bg-[#38BDF8]/10 px-3 py-1 text-[13px] font-semibold tracking-wide">
              {landingCopy.hero.badge}
            </p>

            <h1 className="text-[#111827] mt-5 text-[2rem] leading-[1.08] font-semibold tracking-tight text-balance sm:text-5xl lg:text-[4rem] lg:leading-[1.06] xl:text-[4.5rem]">
              {landingCopy.hero.headline}
            </h1>

            <p className="text-slate-600 mt-5 text-base leading-relaxed text-pretty sm:text-lg lg:text-xl">
              {landingCopy.hero.subhead}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Button
                asChild
                size="lg"
                className="h-11 w-full px-6 text-[15px] font-semibold sm:w-auto"
              >
                <Link href="/signup">{landingCopy.hero.primaryCta}</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="h-11 w-full px-6 text-[15px] font-semibold sm:w-auto"
              >
                <a href="#analytics">{landingCopy.hero.secondaryCta}</a>
              </Button>
            </div>

            <ul className="mt-6 flex flex-wrap gap-2">
              {landingCopy.hero.trustBadges.map((label, index) => {
                const Icon = TRUST_ICONS[index] ?? WifiOff;
                return (
                  <li
                    key={label}
                    className="border-border bg-card text-slate-700 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium shadow-sm"
                  >
                    <Icon className="text-primary h-3.5 w-3.5 shrink-0" aria-hidden />
                    {label}
                  </li>
                );
              })}
            </ul>

            <ul className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {landingCopy.hero.metrics.map((metric, index) => {
                const Icon = METRIC_ICONS[index] ?? Cloud;
                return (
                  <li
                    key={metric.value}
                    className="border-border bg-card rounded-xl border p-3 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <Icon className="text-primary mb-2 h-4 w-4" aria-hidden />
                    <p className="text-[#111827] text-xs font-semibold">{metric.value}</p>
                    <p className="text-muted-foreground mt-0.5 text-[10px] leading-snug">
                      {metric.label}
                    </p>
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
