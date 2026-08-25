"use client";

import Link from "next/link";
import { useState } from "react";
import { BadgeCheck, Ban, RefreshCw, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import {
  formatPlanBytes,
  formatPlanPriceLabel,
  PLAN_CATALOG,
  priceForCycle,
  type PlanDefinition,
  type PlanKey,
} from "@/convex/shared/plans";
import { cn } from "@/lib/utils";

type BillingCycle = "monthly" | "yearly";

const PLAN_ORDER: PlanKey[] = ["basic", "pro", "enterprise", "lifetime"];

/** Yearly is priced as ~10 months — two months free vs paying monthly. */
function yearlySavings(plan: PlanDefinition): number | null {
  if (plan.monthlyPrice === null || plan.yearlyPrice === null) return null;
  const saved = plan.monthlyPrice * 12 - plan.yearlyPrice;
  return saved > 0 ? saved : null;
}

function planPriceDisplay(plan: PlanDefinition, cycle: BillingCycle) {
  if (plan.isLifetime) {
    return {
      amount: `GH₵${plan.oneTimePrice?.toLocaleString()}`,
      suffix: "one-time",
      savings: null as number | null,
    };
  }

  const price = priceForCycle(plan, cycle);
  if (price === null) {
    return { amount: "Talk to us", suffix: "", savings: null as number | null };
  }

  return {
    amount: formatPlanPriceLabel(price, plan.priceFrom),
    suffix: cycle === "monthly" ? "/ month" : "/ year",
    savings: cycle === "yearly" ? yearlySavings(plan) : null,
  };
}

const TRUST_ICONS = [BadgeCheck, Ban, ShieldCheck, RefreshCw] as const;

function limitLabel(value: number | null, kind: "count" | "bytes"): string {
  if (value === null) return "Unlimited";
  if (kind === "bytes") return formatPlanBytes(value);
  return value.toLocaleString();
}

function planFeatureLines(key: PlanKey): string[] {
  const cards = landingCopy.pricing.cards;
  switch (key) {
    case "basic":
      return [...cards.basic.included];
    case "pro":
      return [...cards.pro.additional];
    case "lifetime":
      return [...cards.lifetime.includes];
    case "enterprise":
      return [...PLAN_CATALOG.enterprise.features.slice(0, 5)];
  }
}

function planCta(key: PlanKey): { label: string; href: string } {
  const cards = landingCopy.pricing.cards;
  switch (key) {
    case "basic":
      return { label: cards.basic.cta, href: cards.basic.href };
    case "pro":
      return { label: cards.pro.cta, href: cards.pro.href };
    case "enterprise":
      return { label: cards.enterprise.cta, href: cards.enterprise.href };
    case "lifetime":
      return { label: cards.lifetime.cta, href: cards.lifetime.href };
  }
}

function planDescription(key: PlanKey): string {
  return landingCopy.pricing.cards[key].description;
}

function planBadge(key: PlanKey): string {
  return landingCopy.pricing.cards[key].badge;
}

/** V3 pricing — 4 plans, Pro featured, Lifetime gold, trust row under cards. */
export function LandingPricing() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const copy = landingCopy.pricing;

  return (
    <section
      id="pricing"
      className="landing-pricing-v2 border-border scroll-mt-24 border-t bg-white px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
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

          <BillingToggle cycle={cycle} onChange={setCycle} />
        </header>

        <PricingCards cycle={cycle} />

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
    </section>
  );
}

function BillingToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}) {
  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <div
        role="group"
        aria-label="Billing cycle"
        className="inline-flex rounded-full border border-slate-200 bg-[#F8FAFC] p-1 shadow-sm"
      >
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={cycle === option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              cycle === option ? "bg-primary text-white" : "text-slate-600 hover:text-[#111827]",
            )}
          >
            {option === "monthly" ? "Monthly" : "Yearly"}
            {option === "yearly" ? (
              <span
                className={cn(
                  "ml-1.5 text-[10px] font-bold tracking-wide uppercase",
                  cycle === "yearly" ? "text-white/90" : "text-primary",
                )}
              >
                −2 mo
              </span>
            ) : null}
          </button>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        {cycle === "yearly"
          ? "Billed once a year — two months free versus monthly."
          : "Switch to yearly anytime to lock in two months free."}
      </p>
    </div>
  );
}

function PricingCards({ cycle }: { cycle: BillingCycle }) {
  return (
    <ul
      data-reveal
      className="landing-price-carousel mt-10 sm:mt-14 sm:grid sm:grid-cols-2 sm:gap-5 xl:grid-cols-4 xl:gap-5"
    >
      {PLAN_ORDER.map((key) => {
        const plan = PLAN_CATALOG[key];
        const isLifetime = plan.isLifetime;
        const isFeatured = plan.featured;
        const isGold = isLifetime;
        const featureLines = planFeatureLines(key);
        const cta = planCta(key);
        const external = cta.href.startsWith("mailto:");
        const price = planPriceDisplay(plan, cycle);
        const ctaHref =
          external || plan.isLifetime ? cta.href : `${cta.href}?plan=${key}&cycle=${cycle}`;

        const limitLines = [
          `${limitLabel(plan.limits.products, "count")} Products`,
          `${limitLabel(plan.limits.users, "count")} Users`,
          `${limitLabel(plan.limits.branches, "count")} ${plan.limits.branches === 1 ? "Branch" : "Branches"}`,
          `${limitLabel(plan.limits.devices, "count")} Devices`,
          plan.variableBackup
            ? "Custom Cloud Backup"
            : `${limitLabel(plan.limits.backupBytes, "bytes")} Cloud Backup`,
        ];

        const mobileOrderClass = {
          basic: "order-2 sm:order-none",
          pro: "order-1 sm:order-none",
          enterprise: "order-3 sm:order-none",
          lifetime: "order-4 sm:order-none",
        }[key];

        return (
          <li
            key={key}
            className={cn(
              "landing-price-card-v2 group relative flex min-w-[82%] snap-center flex-col rounded-3xl border bg-[#F8FAFC] p-6 transition-[transform,box-shadow,border-color] duration-300 sm:min-w-0 sm:bg-white sm:p-7",
              mobileOrderClass,
              isFeatured &&
                "landing-price-card-featured border-primary/45 bg-white shadow-[0_24px_48px_-28px_rgba(56,189,248,0.55)] sm:z-10 xl:-translate-y-2",
              isGold && "landing-price-card-lifetime border-amber-300/70 bg-white",
              !isFeatured && !isGold && "border-slate-200/90 shadow-sm",
            )}
          >
            <span
              className={cn(
                "mb-3 inline-flex self-start rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.12em] uppercase sm:absolute sm:-top-3 sm:left-1/2 sm:mb-0 sm:-translate-x-1/2 sm:self-auto",
                isFeatured && "bg-primary text-white",
                isGold && "border border-amber-300 bg-amber-50 text-amber-900",
                !isFeatured && !isGold && "border border-slate-200 bg-white text-slate-700",
              )}
            >
              {planBadge(key)}
            </span>

            <h3 className="text-xl font-semibold tracking-tight text-[#111827] sm:mt-2">
              {plan.name}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{planDescription(key)}</p>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-3xl font-semibold tracking-tight text-[#111827]">{price.amount}</p>
              <p className="mt-1 text-xs text-slate-500">{price.suffix}</p>
              {price.savings !== null ? (
                <p className="text-primary mt-2 text-xs font-semibold">
                  Save GH₵{price.savings.toLocaleString()} / year
                </p>
              ) : null}
            </div>

            <ul className="mt-5 space-y-1.5 text-xs text-slate-600">
              {limitLines.map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <span className="h-1 w-1 shrink-0 rounded-full bg-slate-300" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>

            <ul className="mt-5 flex-1 space-y-2">
              {featureLines.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-slate-800">
                  <span
                    className={cn(
                      "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                      isGold ? "bg-amber-500" : "bg-primary",
                    )}
                  />
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-7">
              <Button
                asChild
                variant={isFeatured ? "default" : "outline"}
                className={cn(
                  "h-11 w-full font-semibold",
                  isFeatured && "landing-shadow-cta-primary",
                  isGold &&
                    "border-amber-400 bg-amber-500 text-white hover:bg-amber-600 hover:text-white",
                )}
              >
                {external ? (
                  <a href={ctaHref}>{cta.label}</a>
                ) : (
                  <Link href={ctaHref}>{cta.label}</Link>
                )}
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
