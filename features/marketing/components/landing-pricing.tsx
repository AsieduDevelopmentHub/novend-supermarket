"use client";

import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import { PLAN_LIST, type PlanDefinition } from "@/convex/shared/plans";

type Cycle = "monthly" | "yearly";

function priceLabel(plan: PlanDefinition, cycle: Cycle) {
  if (plan.isLifetime) {
    return { amount: `GH₵${plan.oneTimePrice?.toLocaleString()}`, suffix: "one-time" };
  }
  const amount = cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  if (amount === null) return { amount: "Talk to us", suffix: "" };
  return {
    amount: `${plan.priceFrom ? "From " : ""}GH₵${amount.toLocaleString()}`,
    suffix: cycle === "monthly" ? "per month" : "per year",
  };
}

/** Public pricing, rendered straight from the plan catalog the app enforces. */
export function LandingPricing() {
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <section
      id="pricing"
      className="landing-pricing border-border bg-background scroll-mt-24 border-t px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <h2 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.pricing.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">
            {landingCopy.pricing.subtitle}
          </p>

          <div
            role="group"
            aria-label="Billing cycle"
            className="border-border bg-card mt-7 inline-flex rounded-lg border p-1"
          >
            {(["monthly", "yearly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={cycle === option}
                onClick={() => setCycle(option)}
                className={cn(
                  "focus-visible:ring-ring rounded-md px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  cycle === option
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option === "monthly" ? "Monthly" : "Yearly"}
              </button>
            ))}
          </div>
          <p className="text-muted-foreground mt-2 text-xs">Two months free on yearly billing.</p>
        </div>

        <ul className="landing-perspective mt-10 grid items-stretch gap-5 sm:mt-16 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {PLAN_LIST.map((plan) => {
            const price = priceLabel(plan, cycle);
            return (
              <li
                key={plan.key}
                data-depth-card
                className={cn(
                  "landing-price-card landing-depth-preserve group relative flex flex-col rounded-2xl border p-6 transition-[box-shadow,transform] duration-300 sm:p-7",
                  plan.featured
                    ? "landing-shadow-card-featured border-primary/40 bg-card xl:-translate-y-2"
                    : "landing-shadow-card border-border bg-card",
                )}
              >
                {plan.featured ? (
                  <span className="bg-primary text-primary-foreground landing-shadow-chip absolute -top-3 left-1/2 -translate-x-1/2 rounded-md px-3 py-1 text-[10px] font-bold tracking-[0.12em] uppercase">
                    Recommended
                  </span>
                ) : null}

                <h3 className="text-foreground text-xl font-semibold tracking-tight">{plan.name}</h3>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{plan.tagline}</p>

                <div className="border-border mt-6 border-t pt-5">
                  <p className="text-foreground text-3xl font-semibold tracking-tight">
                    {price.amount}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">{price.suffix || plan.audience}</p>
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
                  <Button
                    asChild
                    variant={plan.featured ? "default" : "secondary"}
                    className={cn(
                      "h-11 w-full font-semibold",
                      plan.featured ? "landing-shadow-cta-primary" : "landing-shadow-chip",
                    )}
                  >
                    <Link href="/signup">{plan.isLifetime ? "Buy lifetime" : "Start free trial"}</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-muted-foreground mt-8 text-center text-sm">
          Every plan starts with a {landingCopy.pricing.badge.toLowerCase()}. You pay from inside the
          app — including Enterprise.
        </p>
      </div>
    </section>
  );
}
