import { Check } from "lucide-react";
import { landingCopy } from "@/features/marketing/content";
import { LandingAmbient } from "@/features/marketing/components/landing-ambient";

/** Security / trust — generous margins, soft ambient, checklist layout. */
export function LandingWhy() {
  return (
    <section
      id="about"
      className="scroll-mt-24 bg-[#0B1220] px-5 py-28 sm:px-8 sm:py-32 lg:px-16 lg:py-36"
    >
      <div className="landing-trust-shell relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 px-6 py-14 text-white sm:px-10 sm:py-16 lg:px-14 lg:py-20">
        <LandingAmbient variant="dark" />
        <div className="relative z-10 grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-start lg:gap-24">
          <div data-reveal>
            <p className="text-primary text-sm font-semibold tracking-wide">
              {landingCopy.why.eyebrow}
            </p>
            <h2 className="mt-4 max-w-lg text-3xl font-semibold tracking-tight sm:text-4xl">
              {landingCopy.why.title}
            </h2>
            <p className="mt-5 max-w-xl text-base text-pretty text-slate-300 sm:text-lg">
              {landingCopy.why.subtitle}
            </p>
            <p className="mt-12 max-w-xl border-t border-white/10 pt-10 text-sm leading-relaxed text-slate-400 sm:text-base">
              {landingCopy.why.ghanaNote}
            </p>
          </div>

          <div data-reveal className="lg:pt-2">
            <p className="text-xs font-semibold tracking-[0.14em] text-slate-400 uppercase">
              Core safeguards
            </p>
            <ul className="mt-8 space-y-5">
              {landingCopy.why.points.map((point) => (
                <li key={point} className="flex items-start gap-3.5 border-b border-white/10 pb-5">
                  <span className="bg-primary/20 text-primary mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="text-base leading-relaxed text-slate-200 sm:text-[1.05rem]">
                    {point}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
