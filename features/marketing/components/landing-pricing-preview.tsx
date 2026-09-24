"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LandingSection } from "@/features/marketing/components/landing-section";
import { landingCopy } from "@/features/marketing/content";
import {
  formatPlanPriceLabel,
  PLAN_CATALOG,
  priceForCycle,
  SELLABLE_PLAN_KEYS,
  type PlanDefinition,
} from "@/convex/shared/plans";
import { cn } from "@/lib/utils";
import { appEntryHref } from "@/lib/hosting/hosts";

type BillingCycle = "monthly" | "yearly";

const PREVIEW_PLANS = [...SELLABLE_PLAN_KEYS] as const;

function yearlySavings(plan: PlanDefinition): number | null {
  if (plan.monthlyPrice === null || plan.yearlyPrice === null) return null;
  const saved = plan.monthlyPrice * 12 - plan.yearlyPrice;
  return saved > 0 ? saved : null;
}

function planPriceDisplay(plan: PlanDefinition, cycle: BillingCycle) {
  const price = priceForCycle(plan, cycle);
  if (price === null) {
    return { amount: "Talk to us", suffix: "" };
  }
  return {
    amount: formatPlanPriceLabel(price, plan.priceFrom),
    suffix: cycle === "monthly" ? "/ month" : "/ year",
  };
}

/** Homepage pricing preview — sellable plans only; Lifetime is legacy and not marketed. */
export function LandingPricingPreview() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const copy = landingCopy.pricingPreview;

  return (
    <LandingSection
      id="pricing"
      tone="soft"
      className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {copy.eyebrow}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#0F172A] sm:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
            {copy.detail}
          </p>
        </header>

        <div data-reveal className="mt-8 flex flex-col items-center gap-2">
          <div
            className="inline-flex rounded-full border border-slate-200 bg-white p-1"
            role="group"
            aria-label="Billing cycle"
          >
            {(["monthly", "yearly"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={cycle === option}
                onClick={() => setCycle(option)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                  cycle === option
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900",
                )}
              >
                {option === "monthly" ? "Monthly" : "Annual"}
                {option === "yearly" ? (
                  <span
                    className={cn(
                      "ml-1.5 text-[10px] font-bold tracking-wide uppercase",
                      cycle === "yearly" ? "text-white/80" : "text-primary",
                    )}
                  >
                    2 months free
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <ul data-reveal-stagger className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
          {PREVIEW_PLANS.map((key) => {
            const plan = PLAN_CATALOG[key];
            const price = planPriceDisplay(plan, cycle);
            const summary = copy.summaries[key];
            const saved = cycle === "yearly" ? yearlySavings(plan) : null;
            const featured = key === "pro";

            return (
              <li
                key={key}
                className={cn(
                  "flex flex-col rounded-[20px] border p-6",
                  featured
                    ? "border-primary/40 bg-white shadow-[0_20px_50px_-36px_rgba(14,165,233,0.55)]"
                    : "border-slate-200/90 bg-white/90",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold tracking-tight text-[#0F172A]">{plan.name}</p>
                  {featured ? (
                    <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
                      Popular for growing stores
                    </span>
                  ) : null}
                </div>
                <p className="mt-4 text-3xl font-semibold tracking-tight text-[#0F172A]">
                  {price.amount}
                  {price.suffix ? (
                    <span className="ml-1 text-sm font-medium text-slate-500">{price.suffix}</span>
                  ) : null}
                </p>
                {saved != null ? (
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Save GH₵{saved.toLocaleString()} vs monthly
                  </p>
                ) : null}
                <p className="mt-4 text-sm leading-relaxed text-slate-600">{summary}</p>
                <Button asChild className="mt-6 w-full" variant={featured ? "default" : "outline"}>
                  <Link
                    href={
                      key === "enterprise" ? copy.enterpriseHref : appEntryHref("/signup")
                    }
                  >
                    {key === "enterprise" ? "Talk to sales" : "Start free trial"}
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          {copy.lifetime.detail}
        </p>

        <div className="mt-8 text-center">
          <Link
            href="/pricing"
            className="text-primary text-sm font-semibold underline-offset-4 hover:underline"
          >
            {copy.compareCta}
          </Link>
        </div>
      </div>
    </LandingSection>
  );
}
