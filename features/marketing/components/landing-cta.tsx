import Image from "next/image";
import Link from "next/link";
import { MonitorSmartphone } from "lucide-react";
import { BRANDING } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";

/**
 * Final CTA — trial + downloads in one composition.
 * Absorbs the former Apps & Downloads band so the page has a single close.
 */
export function LandingCta() {
  const { cta, desktop } = landingCopy;

  return (
    <section id="contact" className="scroll-mt-24 bg-white px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
      {/* Keep #desktop anchors working after the standalone downloads section was removed */}
      <div id={desktop.id} className="sr-only" aria-hidden>
        Downloads
      </div>
      <div
        data-reveal
        className="border-border relative mx-auto grid max-w-6xl overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-[#F8FAFC] lg:grid-cols-2 lg:items-center"
      >
        <div className="px-5 py-12 text-center sm:px-12 sm:py-16 lg:text-left">
          <h2 className="text-2xl font-semibold tracking-tight text-balance text-[#111827] sm:text-4xl">
            {cta.title}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty text-slate-600 sm:text-lg lg:mx-0">
            {cta.subtitle}
          </p>

          <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
            <Button
              asChild
              size="lg"
              className="landing-shadow-cta-primary h-11 w-full px-6 text-[15px] font-semibold transition-[box-shadow,transform] hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
            >
              <Link href="/signup">{cta.primary}</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="landing-shadow-cta-outline border-primary/40 h-11 w-full bg-white/80 px-6 text-[15px] font-semibold text-[#111827] transition-[box-shadow,transform] hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
            >
              <Link href={cta.secondaryHref}>{cta.secondary}</Link>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 lg:justify-start">
            {cta.chips.map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-700"
              >
                {chip}
              </li>
            ))}
          </ul>

          <div className="mt-10 border-t border-slate-200/90 pt-8 text-left">
            <div className="flex items-start gap-3">
              <span className="bg-primary/12 text-primary mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                <MonitorSmartphone className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-primary text-[12px] font-semibold tracking-[0.12em] uppercase">
                  {desktop.badge}
                </p>
                <p className="mt-1 text-sm font-semibold tracking-tight text-[#111827] sm:text-base">
                  {desktop.title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{desktop.detail}</p>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {desktop.platforms.map((platform) => (
                    <li
                      key={platform.id}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
                    >
                      {platform.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="landing-cta-devices relative flex min-h-[240px] items-end justify-center px-4 pt-4 pb-6 sm:px-8 lg:min-h-[340px] lg:pb-8">
          <div className="landing-cta-devices-frame">
            <Image
              src={BRANDING.landingCtaDevices}
              alt="Novend on laptop and mobile"
              width={1536}
              height={1024}
              className="landing-cta-devices-img h-auto w-full max-w-lg object-contain"
              sizes="(max-width: 1024px) 90vw, 480px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
