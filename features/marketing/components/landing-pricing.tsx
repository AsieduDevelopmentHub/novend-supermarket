"use client";

import { useState } from "react";
import { BadgeCheck, Ban, RefreshCw, ShieldCheck } from "lucide-react";
import { landingCopy } from "@/features/marketing/content";
import { LandingSection } from "@/features/marketing/components/landing-section";
import {
  BillingCycleToggle,
  PlanComparisonTable,
  PlanNeuCard,
  type BillingCycle,
  usePublicPlanCatalog,
} from "@/features/marketing/components/plan-pricing-cards";

const TRUST_ICONS = [BadgeCheck, Ban, ShieldCheck, RefreshCw] as const;

/** Full pricing — every marketing-visible plan + comparison matrix. */
export function LandingPricing() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const catalog = usePublicPlanCatalog();
  const copy = landingCopy.pricing;
  const plans = catalog.plans;

  return (
    <LandingSection
      id="pricing"
      tone="soft"
      className="landing-pricing-v2 px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[700px] text-center">
          <p className="text-primary text-[13px] font-semibold tracking-[0.14em] uppercase">
            {copy.badge}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance text-[#111827] sm:text-4xl">
            {copy.title}
          </h2>
          <p className="mt-4 text-base leading-relaxed text-pretty text-slate-600 sm:text-lg">
            {copy.subtitle}
          </p>

          <div className="mt-8 flex flex-col items-center gap-2">
            <BillingCycleToggle cycle={cycle} onChange={setCycle} />
            <p className="text-xs text-slate-500">
              {cycle === "yearly"
                ? "Billed once a year, two months free versus monthly."
                : "Switch to Annual anytime to lock in two months free."}
            </p>
          </div>
        </header>

        <ul
          data-reveal
          className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {plans.map((plan) => (
            <li key={plan.key}>
              <PlanNeuCard plan={plan} cycle={cycle} />
            </li>
          ))}
        </ul>

        <div data-reveal className="mt-16 space-y-4">
          <h3 className="text-center text-xl font-semibold tracking-tight text-[#111827]">
            Compare every plan
          </h3>
          <p className="mx-auto max-w-2xl text-center text-sm text-slate-600">
            Limits and features side by side. Strikethrough prices show the list rate before the
            current price drop.
          </p>
          <PlanComparisonTable plans={plans} cycle={cycle} />
        </div>

        <ul
          data-reveal
          className="mt-12 grid gap-4 border-t border-slate-200/80 pt-10 sm:mt-14 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4"
        >
          {copy.trust.map((item, index) => {
            const Icon = TRUST_ICONS[index] ?? ShieldCheck;
            return (
              <li key={item.title} className="flex items-start gap-3 sm:justify-center">
                <span className="bg-primary/10 text-primary mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{item.title}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{item.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </LandingSection>
  );
}
