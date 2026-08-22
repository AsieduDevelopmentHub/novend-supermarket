import Image from "next/image";
import Link from "next/link";
import { BRANDING } from "@/constants/branding";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";

/** V3 final CTA — dual CTAs + reference laptop & mobile device mock. */
export function LandingCta() {
  const { cta } = landingCopy;

  return (
    <section
      id="contact"
      className="scroll-mt-24 bg-white px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div
        data-reveal
        className="landing-cta-mesh landing-shadow-band border-border relative mx-auto grid max-w-6xl overflow-hidden rounded-[1.5rem] border lg:grid-cols-2 lg:items-center"
      >
        <div className="px-5 py-12 text-center sm:px-12 sm:py-16 lg:text-left">
          <h2 className="text-[#111827] text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
            {cta.title}
          </h2>
          <p className="text-slate-600 mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty sm:text-lg lg:mx-0">
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
              className="landing-shadow-cta-outline h-11 w-full border-primary/40 bg-white/80 px-6 text-[15px] font-semibold text-[#111827] transition-[box-shadow,transform] hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
            >
              <a href={cta.secondaryHref}>{cta.secondary}</a>
            </Button>
          </div>

          <ul className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5 lg:justify-start">
            {cta.chips.map((chip) => (
              <li
                key={chip}
                className="rounded-full border border-slate-200/90 bg-white/75 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-700 backdrop-blur-sm"
              >
                {chip}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex min-h-[220px] items-center justify-center px-6 pb-10 pt-2 sm:px-10 lg:min-h-[320px] lg:pb-12">
          <Image
            src={BRANDING.landingCtaDevices}
            alt="Novend on laptop and mobile"
            width={1280}
            height={720}
            className="h-auto w-full max-w-lg object-contain drop-shadow-[0_24px_48px_rgba(15,23,42,0.2)]"
            sizes="(max-width: 1024px) 90vw, 480px"
          />
        </div>
      </div>
    </section>
  );
}
