import { Check, Shield } from "lucide-react";
import { landingCopy } from "@/features/marketing/content";
import { LandingAmbient } from "@/features/marketing/components/landing-ambient";

/**
 * Security & trust — light section chrome; onyx cards only.
 */
export function LandingWhy() {
  return (
    <section
      id="about"
      className="landing-trust relative scroll-mt-24 overflow-hidden px-5 py-28 sm:px-10 sm:py-36 lg:px-20 lg:py-40"
    >
      <LandingAmbient variant="light" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <span className="bg-primary/15 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
            <Shield className="h-3.5 w-3.5" aria-hidden />
            {landingCopy.why.eyebrow}
          </span>
          <h2 className="text-foreground mt-6 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem]">
            {landingCopy.why.title}
          </h2>
          <p className="text-muted-foreground mt-5 text-base text-pretty sm:text-lg">
            {landingCopy.why.subtitle}
          </p>
        </div>

        <ul className="landing-perspective mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {landingCopy.why.cards.map((card) => (
            <li
              key={card.title}
              data-depth-card
              className="landing-trust-card landing-depth-preserve rounded-[1.5rem] border border-white/10 bg-[#0B1220] p-6 text-white shadow-[0_22px_50px_rgba(11,18,32,0.28)] sm:p-7"
            >
              <span className="bg-primary/20 text-primary inline-flex h-10 w-10 items-center justify-center rounded-2xl">
                <Check className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-5 text-lg font-semibold tracking-tight text-white">{card.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-slate-300">{card.detail}</p>
            </li>
          ))}
        </ul>

        <p
          data-reveal
          className="text-muted-foreground mx-auto mt-16 max-w-3xl border-t border-sky-100 pt-10 text-center text-sm leading-relaxed sm:text-base"
        >
          {landingCopy.why.ghanaNote}
        </p>
      </div>
    </section>
  );
}
