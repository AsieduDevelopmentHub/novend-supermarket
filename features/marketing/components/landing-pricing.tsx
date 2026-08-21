import { landingCopy } from "@/features/marketing/content";
import { LandingAmbient } from "@/features/marketing/components/landing-ambient";

/** Pricing cards with light ambient depth. */
export function LandingPricing() {
  return (
    <section
      id="pricing"
      className="landing-pricing relative scroll-mt-24 overflow-hidden px-4 py-24 sm:px-6 sm:py-28 lg:px-8"
    >
      <LandingAmbient variant="light" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
              {landingCopy.pricing.title}
            </h2>
            <p className="text-muted-foreground mt-3 text-base text-pretty sm:text-lg">
              {landingCopy.pricing.subtitle}
            </p>
          </div>
          <span className="text-primary rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold tracking-wide uppercase">
            {landingCopy.pricing.badge}
          </span>
        </div>

        <ul className="landing-perspective mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {landingCopy.pricing.plans.map((plan) => (
            <li
              key={plan.id}
              data-depth-card
              className="landing-price-card landing-depth-preserve flex min-h-[220px] flex-col rounded-[1.6rem] border border-white/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.08)] backdrop-blur-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-foreground text-xl font-semibold tracking-tight">{plan.name}</h3>
                <span className="text-primary text-[10px] font-bold tracking-[0.12em] uppercase">
                  {plan.status}
                </span>
              </div>
              <p className="text-muted-foreground mt-4 flex-1 text-sm leading-relaxed">{plan.blurb}</p>
              <p className="text-muted-foreground mt-8 text-xs tracking-wide uppercase">
                Activate later
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
