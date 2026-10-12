"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingSection } from "@/features/marketing/components/landing-section";
import {
  BillingCycleToggle,
  PlanNeuCard,
  type BillingCycle,
  usePublicPlanCatalog,
} from "@/features/marketing/components/plan-pricing-cards";
import { landingCopy } from "@/features/marketing/content";

/** Homepage pricing preview — Starter / Pro / Enterprise (homepageHighlight). */
export function LandingPricingPreview() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const catalog = usePublicPlanCatalog();
  const copy = landingCopy.pricingPreview;
  const plans = catalog.homepagePlans.length > 0 ? catalog.homepagePlans : catalog.plans.slice(0, 3);

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
          <BillingCycleToggle cycle={cycle} onChange={setCycle} />
        </div>

        <ul data-reveal-stagger className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((plan) => (
            <li key={plan.key}>
              <PlanNeuCard plan={plan} cycle={cycle} />
            </li>
          ))}
        </ul>

        <div className="mt-10 flex flex-col items-center gap-3 text-center">
          <Button asChild size="lg" className="min-w-[220px] gap-2 text-base">
            <Link href="/pricing">
              View all pricing
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <p className="text-muted-foreground max-w-md text-sm">
            See every plan, limits, and a full feature comparison, including Shop, Growth, and
            Business.
          </p>
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
          {copy.lifetime.detail}
        </p>
      </div>
    </LandingSection>
  );
}
