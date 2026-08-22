import Link from "next/link";
import { Button } from "@/components/ui/button";
import { GENERAL_SALES_MAILTO, landingCopy } from "@/features/marketing/content";

/** Section 7 final conversion — calm mesh CTA with trust chips. */
export function LandingCta() {
  const { cta } = landingCopy;

  return (
    <section
      id="contact"
      className="scroll-mt-24 bg-[#F8FAFC] px-4 pb-20 pt-4 sm:px-6 sm:pb-28 lg:px-8"
    >
      <div
        data-reveal
        className="landing-cta-mesh landing-shadow-band border-border relative mx-auto max-w-6xl overflow-hidden rounded-[1.5rem] border px-5 py-12 text-center sm:px-12 sm:py-16"
      >
        <h2 className="text-[#111827] text-2xl font-semibold tracking-tight text-balance sm:text-4xl">
          {cta.title}
        </h2>
        <p className="text-slate-600 mx-auto mt-4 max-w-xl text-base leading-relaxed text-pretty sm:text-lg">
          {cta.subtitle}
        </p>

        <div className="mt-8 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-center">
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
            className="landing-shadow-cta-outline h-11 w-full border-slate-200 bg-white/80 px-6 text-[15px] font-semibold text-[#111827] transition-[box-shadow,transform] hover:-translate-y-0.5 active:translate-y-0 sm:w-auto"
          >
            <a href={GENERAL_SALES_MAILTO}>{cta.secondary}</a>
          </Button>
        </div>

        <ul className="mt-8 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
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
    </section>
  );
}
