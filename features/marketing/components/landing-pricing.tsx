import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { landingCopy } from "@/features/marketing/content";
import { LandingAmbient } from "@/features/marketing/components/landing-ambient";

/** Premium pricing cards — Pro featured, Coming Soon, future price/feature slots. */
export function LandingPricing() {
  return (
    <section
      id="pricing"
      className="landing-pricing relative scroll-mt-24 overflow-hidden px-4 py-28 sm:px-6 sm:py-32 lg:px-8"
    >
      <LandingAmbient variant="light" />
      <div className="relative z-10 mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.pricing.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">
            {landingCopy.pricing.subtitle}
          </p>
          <span className="text-primary mt-5 inline-flex rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold tracking-wide uppercase">
            {landingCopy.pricing.badge}
          </span>
        </div>

        <ul className="landing-perspective mt-16 grid items-stretch gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {landingCopy.pricing.plans.map((plan) => (
            <li
              key={plan.id}
              data-depth-card
              className={cn(
                "landing-price-card landing-depth-preserve group relative flex flex-col rounded-[1.75rem] border p-6 backdrop-blur-md transition-[transform,box-shadow] duration-300 sm:p-7",
                plan.featured
                  ? "border-primary/40 bg-gradient-to-b from-[#E0F2FE]/95 to-white/95 shadow-[0_24px_60px_rgba(56,189,248,0.22)] xl:-translate-y-2"
                  : "border-white/80 bg-white/85 shadow-[0_18px_50px_rgba(15,23,42,0.08)]",
              )}
            >
              {plan.featured ? (
                <span className="bg-primary text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.14em] uppercase shadow-sm">
                  Recommended
                </span>
              ) : null}
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-foreground text-xl font-semibold tracking-tight">{plan.name}</h3>
                <span className="text-primary text-[10px] font-bold tracking-[0.12em] uppercase">
                  {plan.status}
                </span>
              </div>
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{plan.blurb}</p>

              <div className="mt-6 border-t border-slate-100 pt-5">
                <p className="text-muted-foreground text-xs tracking-wide uppercase">Price</p>
                <p className="text-foreground mt-1 text-3xl font-semibold tracking-tight">—</p>
                <p className="text-muted-foreground mt-1 text-xs">Billing not live yet</p>
              </div>

              <ul className="mt-6 flex-1 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="text-foreground/90 flex items-start gap-2 text-sm">
                    <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <span
                  className={cn(
                    "inline-flex w-full items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold",
                    plan.featured
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  Coming Soon
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
