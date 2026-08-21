import Image from "next/image";
import Link from "next/link";
import { BRANDING } from "@/constants/branding";
import { landingCopy } from "@/features/marketing/content";
import { LandingAmbient } from "@/features/marketing/components/landing-ambient";

/** Split hero — editorial copy + 3D product stage. */
export function LandingHero() {
  return (
    <section className="landing-hero relative isolate overflow-hidden px-4 pb-6 sm:px-6 lg:px-8">
      <LandingAmbient variant="light" />
      <div className="landing-hero-blobs" aria-hidden />
      <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-14 pt-8 pb-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pt-12 lg:pb-28">
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
          <h1 className="text-foreground max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-[3.05rem] lg:leading-[1.1]">
            {landingCopy.hero.headlineLead}{" "}
            <span className="text-primary">{landingCopy.hero.headlineAccent}</span>
          </h1>
          <p className="text-muted-foreground mt-5 max-w-lg text-base leading-relaxed text-pretty sm:text-lg">
            {landingCopy.hero.subhead}
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/login" className="landing-pill-btn landing-pill-btn-primary">
              {landingCopy.hero.primaryCta}
            </Link>
            <a href="#contact" className="landing-pill-btn landing-pill-btn-outline">
              {landingCopy.hero.secondaryCta}
            </a>
          </div>
        </div>

        <div
          data-hero-visual
          className="landing-hero-stage landing-perspective relative mx-auto w-full max-w-md lg:max-w-none"
        >
          <div data-hero-orb data-parallax data-parallax-speed="-30" className="landing-hero-orb landing-hero-orb-a" aria-hidden />
          <div data-hero-orb data-parallax data-parallax-speed="24" className="landing-hero-orb landing-hero-orb-b" aria-hidden />
          <div data-hero-orb data-parallax data-parallax-speed="-18" className="landing-hero-orb landing-hero-orb-c" aria-hidden />
          <div className="landing-hero-pedestal" aria-hidden />
          <div
            data-depth-stage
            className="landing-pos-mock landing-depth-preserve relative z-10 mx-auto w-[min(100%,340px)] overflow-hidden rounded-[1.75rem] border border-slate-200/80 bg-white shadow-[0_28px_70px_rgba(15,23,42,0.14)]"
          >
            <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
              <span className="text-muted-foreground ml-2 text-[11px] font-medium tracking-wide">
                Novend POS
              </span>
            </div>
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-foreground text-sm font-semibold">Today&apos;s till</p>
                <span className="bg-primary/15 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                  Synced
                </span>
              </div>
              <div className="rounded-2xl bg-[#111827] px-4 py-3 text-white">
                <p className="text-[11px] tracking-wide text-slate-400 uppercase">Net sales</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight">GH₵ 4,280</p>
                <svg className="landing-hero-mini-chart mt-3 h-10 w-full" viewBox="0 0 200 40" aria-hidden>
                  <path
                    className="landing-hero-mini-chart-line"
                    d="M0 32 L30 28 L55 30 L85 18 L115 22 L145 10 L175 14 L200 6"
                    fill="none"
                  />
                </svg>
              </div>
              <div className="space-y-2">
                {["Malta Guinness × 4", "Panadol Extra × 2", "Indomie Carton × 1"].map((line) => (
                  <div
                    key={line}
                    className="flex items-center justify-between rounded-xl px-1 py-2 text-xs"
                  >
                    <span className="text-foreground font-medium">{line}</span>
                    <span className="text-primary font-semibold">In cart</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="landing-hero-wave" aria-hidden />
    </section>
  );
}
