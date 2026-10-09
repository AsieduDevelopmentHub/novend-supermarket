"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_LIST_PRICE_MARKUP_PERCENT,
  formatPlanBytes,
  formatPlanPriceLabel,
  listPriceFromReal,
  PLAN_CATALOG,
  SELLABLE_PLAN_LIST,
  type PlanDefinition,
} from "@/convex/shared/plans";
import type { PublicPlanCard } from "@/convex/shared/planCatalog";
import { appEntryHref } from "@/lib/hosting/hosts";
import { cn } from "@/lib/utils";

export type BillingCycle = "monthly" | "yearly";

function seedAsPublicCards(markup: number): PublicPlanCard[] {
  return SELLABLE_PLAN_LIST.map((plan) => ({
    key: plan.key,
    name: plan.name,
    tagline: plan.tagline,
    audience: plan.audience,
    monthlyPrice: plan.monthlyPrice,
    yearlyPrice: plan.yearlyPrice,
    listMonthlyPrice:
      plan.monthlyPrice != null ? listPriceFromReal(plan.monthlyPrice, markup) : null,
    listYearlyPrice:
      plan.yearlyPrice != null ? listPriceFromReal(plan.yearlyPrice, markup) : null,
    priceFrom: plan.priceFrom,
    featured: plan.featured,
    homepageHighlight: plan.homepageHighlight,
    sortOrder: plan.sortOrder,
    limits: plan.limits,
    features: plan.features,
    variableBackup: plan.variableBackup,
    selfServe: plan.selfServe,
  }));
}

export function usePublicPlanCatalog() {
  const remote = useQuery(api.billing.publicCatalog);
  return useMemo(() => {
    if (remote) return remote;
    const markup = DEFAULT_LIST_PRICE_MARKUP_PERCENT;
    const plans = seedAsPublicCards(markup);
    return {
      listPriceMarkupPercent: markup,
      currency: "GHS",
      plans,
      homepagePlans: plans.filter((p) => p.homepageHighlight).slice(0, 3),
    };
  }, [remote]);
}

export function BillingCycleToggle({
  cycle,
  onChange,
}: {
  cycle: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}) {
  return (
    <div
      className="inline-flex rounded-full border border-slate-200/80 bg-[#EEF2F7] p-1"
      role="group"
      aria-label="Billing cycle"
    >
      {(["monthly", "yearly"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={cycle === option}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-colors",
            cycle === option
              ? "bg-white text-slate-900 shadow-[4px_4px_10px_rgba(15,23,42,0.08),-3px_-3px_8px_rgba(255,255,255,0.9)]"
              : "text-slate-600 hover:text-slate-900",
          )}
        >
          {option === "monthly" ? "Monthly" : "Annual"}
          {option === "yearly" ? (
            <span
              className={cn(
                "ml-1.5 text-[10px] font-bold tracking-wide uppercase",
                cycle === "yearly" ? "text-primary" : "text-primary/80",
              )}
            >
              2 months free
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

function priceBlock(plan: PublicPlanCard, cycle: BillingCycle) {
  const real = cycle === "monthly" ? plan.monthlyPrice : plan.yearlyPrice;
  const list = cycle === "monthly" ? plan.listMonthlyPrice : plan.listYearlyPrice;
  if (real === null) {
    return { amount: "Talk to us", suffix: "", list: null as string | null, savePct: null as number | null };
  }
  const savePct =
    list != null && list > real ? Math.round(((list - real) / list) * 100) : null;
  return {
    amount: formatPlanPriceLabel(real, plan.priceFrom),
    suffix: cycle === "monthly" ? "/ month" : "/ year",
    list: list != null ? formatPlanPriceLabel(list, plan.priceFrom) : null,
    savePct,
  };
}

export function PlanNeuCard({
  plan,
  cycle,
  className,
}: {
  plan: PublicPlanCard;
  cycle: BillingCycle;
  className?: string;
}) {
  const price = priceBlock(plan, cycle);
  const ctaHref =
    plan.key === "enterprise"
      ? "mailto:hello@novendpos.app?subject=Enterprise%20plan"
      : appEntryHref(`/signup?plan=${encodeURIComponent(plan.key)}&cycle=${cycle}`);
  const ctaLabel = plan.key === "enterprise" ? "Talk to sales" : "Start free trial";

  return (
    <article
      className={cn(
        "plan-card-neu flex flex-col p-6",
        plan.featured && "plan-card-neu-featured",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold tracking-tight text-[#0F172A]">{plan.name}</p>
          <p className="mt-1 text-xs text-slate-500">{plan.audience}</p>
        </div>
        {plan.featured ? (
          <span className="bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-semibold">
            Recommended
          </span>
        ) : null}
      </div>

      <div className="mt-5">
        {price.list ? (
          <p className="text-sm text-slate-400 line-through">{price.list}</p>
        ) : null}
        <p className="text-3xl font-semibold tracking-tight text-[#0F172A]">
          {price.amount}
          {price.suffix ? (
            <span className="ml-1 text-sm font-medium text-slate-500">{price.suffix}</span>
          ) : null}
        </p>
        {price.savePct != null ? (
          <p className="text-primary mt-1 text-xs font-semibold">
            Price drop · Save {price.savePct}%
          </p>
        ) : null}
      </div>

      <p className="mt-4 text-sm leading-relaxed text-slate-600">{plan.tagline}</p>

      <ul className="mt-5 space-y-1.5 text-sm text-slate-600">
        <li>
          {plan.limits.products === null
            ? "Unlimited products"
            : `${plan.limits.products.toLocaleString()} products`}
        </li>
        <li>
          {plan.limits.users === null
            ? "Unlimited users"
            : `${plan.limits.users.toLocaleString()} users`}
        </li>
        <li>
          {plan.limits.branches === null
            ? "Unlimited branches"
            : `${plan.limits.branches.toLocaleString()} ${plan.limits.branches === 1 ? "branch" : "branches"}`}
        </li>
        <li>
          {plan.variableBackup
            ? "Custom cloud backup"
            : plan.limits.backupBytes == null
              ? "Unlimited cloud backup"
              : `${formatPlanBytes(plan.limits.backupBytes)} cloud backup`}
        </li>
      </ul>

      <Button asChild className="mt-6 w-full" variant={plan.featured ? "default" : "outline"}>
        <Link href={ctaHref}>{ctaLabel}</Link>
      </Button>
    </article>
  );
}

export function PlanComparisonTable({
  plans,
  cycle,
}: {
  plans: PublicPlanCard[];
  cycle: BillingCycle;
}) {
  if (plans.length === 0) return null;

  const rows: Array<{
    label: string;
    value: (plan: PublicPlanCard) => string;
  }> = [
    {
      label: "Monthly / annual price",
      value: (plan) => priceBlock(plan, cycle).amount,
    },
    {
      label: "Products",
      value: (plan) =>
        plan.limits.products === null ? "Unlimited" : plan.limits.products.toLocaleString(),
    },
    {
      label: "Users",
      value: (plan) =>
        plan.limits.users === null ? "Unlimited" : plan.limits.users.toLocaleString(),
    },
    {
      label: "Branches",
      value: (plan) =>
        plan.limits.branches === null ? "Unlimited" : plan.limits.branches.toLocaleString(),
    },
    {
      label: "Devices",
      value: (plan) =>
        plan.limits.devices === null ? "Unlimited" : plan.limits.devices.toLocaleString(),
    },
    {
      label: "Cloud backup",
      value: (plan) =>
        plan.variableBackup
          ? "Custom"
          : plan.limits.backupBytes == null
            ? "Unlimited"
            : formatPlanBytes(plan.limits.backupBytes),
    },
  ];

  // Union of feature strings across plans for a simple presence matrix
  const featureSet = new Set<string>();
  for (const plan of plans) {
    for (const feature of plan.features) featureSet.add(feature);
  }
  const featureRows = Array.from(featureSet).slice(0, 24);

  return (
    <div className="plan-card-neu overflow-x-auto p-2 sm:p-4">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead>
          <tr>
            <th className="text-muted-foreground sticky left-0 bg-[#EEF2F7] px-3 py-3 font-medium">
              Compare
            </th>
            {plans.map((plan) => (
              <th key={plan.key} className="px-3 py-3 font-semibold text-[#0F172A]">
                {plan.name}
                {plan.featured ? (
                  <span className="text-primary ml-1 text-[10px] font-bold uppercase">
                    Recommended
                  </span>
                ) : null}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-slate-200/70">
              <th className="sticky left-0 bg-[#EEF2F7] px-3 py-2.5 text-left font-medium text-slate-600">
                {row.label}
              </th>
              {plans.map((plan) => (
                <td key={plan.key} className="px-3 py-2.5 text-slate-700">
                  {row.value(plan)}
                </td>
              ))}
            </tr>
          ))}
          {featureRows.map((feature) => (
            <tr key={feature} className="border-t border-slate-200/50">
              <th className="sticky left-0 bg-[#EEF2F7] px-3 py-2 text-left text-xs font-normal text-slate-500">
                {feature}
              </th>
              {plans.map((plan) => (
                <td key={plan.key} className="px-3 py-2 text-center text-slate-700">
                  {plan.features.includes(feature) ? "✓" : "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Homepage-safe summaries when content.ts lacks a key. */
export function planFallbackSummary(plan: PublicPlanCard): string {
  const seed = PLAN_CATALOG[plan.key as keyof typeof PLAN_CATALOG] as PlanDefinition | undefined;
  return plan.tagline || seed?.tagline || plan.audience;
}
