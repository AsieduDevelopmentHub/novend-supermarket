import { Check } from "lucide-react";
import { landingCopy } from "@/features/marketing/content";
import { LandingAmbient } from "@/features/marketing/components/landing-ambient";

/** Split audience section — lists + copy, soft ambient underlay. */
export function LandingAudience() {
  return (
    <section className="landing-section-soft relative overflow-hidden px-4 py-24 sm:px-6 sm:py-28 lg:px-8">
      <LandingAmbient variant="light" />
      <div className="landing-soft-blob" aria-hidden />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div data-reveal className="max-w-2xl">
          <h2 className="text-foreground text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {landingCopy.audience.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">
            {landingCopy.audience.subtitle}
          </p>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-2 lg:gap-16">
          <div data-reveal className="space-y-10">
            <div>
              <h3 className="text-primary text-sm font-semibold tracking-wide uppercase">
                {landingCopy.audience.forCashiers.title}
              </h3>
              <p className="text-foreground mt-3 text-lg leading-relaxed font-medium">
                {landingCopy.audience.forCashiers.detail}
              </p>
            </div>
            <div>
              <h3 className="text-primary text-sm font-semibold tracking-wide uppercase">
                {landingCopy.audience.forManagers.title}
              </h3>
              <p className="text-foreground mt-3 text-lg leading-relaxed font-medium">
                {landingCopy.audience.forManagers.detail}
              </p>
            </div>
          </div>

          <ul data-reveal className="space-y-4 self-center">
            {landingCopy.audience.highlights.map((line) => (
              <li key={line} className="flex items-start gap-3">
                <span className="bg-primary/15 text-primary mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="text-foreground/90 text-base leading-relaxed">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
