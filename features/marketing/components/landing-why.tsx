import { Check, Shield } from "lucide-react";
import { landingCopy } from "@/features/marketing/content";
import { LandingAmbient } from "@/features/marketing/components/landing-ambient";

/**
 * Security & trust — Cloud White / Candy Blue calm enterprise section
 * with generous outer margins and spaced trust cards.
 */
export function LandingWhy() {
  return (
    <section
      id="about"
      className="landing-trust scroll-mt-24 px-5 py-28 sm:px-10 sm:py-36 lg:px-20 lg:py-40"
    >
      <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.25rem] border border-[#BAE6FD]/70 bg-white/70 px-6 py-16 shadow-[0_30px_80px_rgba(14,165,233,0.08)] sm:px-12 sm:py-20 lg:px-16 lg:py-24">
        <LandingAmbient variant="light" />
        <div className="relative z-10">
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
                className="landing-trust-card landing-depth-preserve rounded-[1.5rem] border border-white/90 bg-white/85 p-6 shadow-[0_14px_40px_rgba(15,23,42,0.06)] backdrop-blur-md sm:p-7"
              >
                <span className="bg-primary/15 text-primary inline-flex h-10 w-10 items-center justify-center rounded-2xl">
                  <Check className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="text-foreground mt-5 text-lg font-semibold tracking-tight">
                  {card.title}
                </h3>
                <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">{card.detail}</p>
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
      </div>
    </section>
  );
}
