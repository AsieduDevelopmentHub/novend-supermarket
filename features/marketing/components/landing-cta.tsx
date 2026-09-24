import Image from "next/image";
import Link from "next/link";
import { BRANDING } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import { appEntryHref } from "@/lib/hosting/hosts";

/**
 * Final CTA — onyx conversion panel. Device art sits on a light plate that
 * masks cutout stains, then fades into the default onyx background.
 */
export function LandingCta() {
  const { cta, desktop } = landingCopy;
  const signupHref = appEntryHref("/signup");

  return (
    <section id="contact" className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
      <div id={desktop.id} className="sr-only" aria-hidden>
        Downloads
      </div>

      <div className="mx-auto max-w-[1240px]">
        <div className="landing-cta-panel relative overflow-hidden rounded-[28px] bg-[#071426] text-white sm:rounded-[32px]">
          <div className="landing-cta-glow" aria-hidden />

          <div className="relative z-[1] grid items-stretch lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <div className="flex flex-col justify-center px-6 py-12 sm:px-10 sm:py-14 lg:px-12 lg:py-16">
              <h2 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
                {cta.title}
              </h2>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-pretty text-slate-300 sm:text-lg">
                {cta.subtitle}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <Button
                  asChild
                  size="lg"
                  className="h-12 rounded-full bg-white px-7 text-[15px] font-semibold text-[#0B1220] hover:bg-white/95"
                >
                  <Link href={signupHref}>{cta.primary}</Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-full border-white/30 bg-transparent px-7 text-[15px] font-semibold text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href={cta.secondaryHref}>{cta.secondary}</Link>
                </Button>
              </div>

              <p className="mt-8 text-sm text-slate-400">{cta.platformsLine}</p>
            </div>

            <div className="landing-cta-devices relative flex min-h-[240px] items-end justify-center overflow-hidden sm:min-h-[300px] lg:min-h-[420px] lg:justify-end">
              <div className="landing-cta-device-plate" aria-hidden />
              <div className="landing-cta-device-dent" aria-hidden />
              <div className="landing-cta-devices-frame relative z-[1] w-full max-w-[22rem] px-3 pb-0 sm:max-w-[28rem] sm:px-4 lg:max-w-[36rem] xl:max-w-[40rem] lg:pr-2">
                <Image
                  src={BRANDING.landingCtaDevices}
                  alt="Novend on laptop and mobile"
                  width={1536}
                  height={1024}
                  className="landing-cta-devices-img h-auto w-full object-contain object-bottom"
                  sizes="(max-width: 640px) 88vw, (max-width: 1024px) 70vw, 640px"
                  priority={false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
