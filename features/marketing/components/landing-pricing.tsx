"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Boxes,
  CloudOff,
  FileBarChart,
  Package,
  Printer,
  RefreshCw,
  ScanBarcode,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { landingCopy } from "@/features/marketing/content";
import {
  formatPlanBytes,
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
    amount: `${plan.priceFrom ? "From " : ""}GH₵${price.toLocaleString()}`,
    suffix: cycle === "monthly" ? "/ month" : "/ year",
    savings: cycle === "yearly" ? yearlySavings(plan) : null,
  };
}

const CAPACITY_METRICS = [
  { key: "products" as const, label: "Products" },
  { key: "users" as const, label: "Users" },
  { key: "devices" as const, label: "Devices" },
];

const INCLUDED_ICONS = [
  ShoppingCart,
  ScanBarcode,
  Printer,
  Boxes,
  Users,
  Truck,
  RefreshCw,
  FileBarChart,
] as const;

const TRUST_ICONS = [ShieldCheck, CloudOff, Zap] as const;

function limitLabel(value: number | null, kind: "count" | "bytes"): string {
  if (value === null) return "Unlimited";
  if (kind === "bytes") return formatPlanBytes(value);
  return value.toLocaleString();
}

function capacityRatioFor(
  key: "products" | "users" | "devices",
  value: number | null,
): number {
  if (value === null) return 1;
  const max = key === "products" ? 5000 : 15;
  return Math.min(1, Math.max(0.1, value / max));
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

/** Section 6 — conversion pricing rebuilt for growth-focused SaaS UX. */
export function LandingPricing() {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const copy = landingCopy.pricing;

  return (
    <section
      id="pricing"
      className="landing-pricing-v2 scroll-mt-24 border-t border-border bg-[#F8FAFC] px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <header data-reveal className="mx-auto max-w-[700px] text-center">
          <p className="text-primary text-[13px] font-semibold tracking-wide">{copy.badge}</p>
          <h2 className="text-[#111827] mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {copy.title}
          </h2>
          <p className="text-slate-600 mt-4 text-base leading-relaxed text-pretty sm:text-lg">
            {copy.subtitle}
          </p>

          <BillingToggle cycle={cycle} onChange={setCycle} />
        </header>

        <PricingCards cycle={cycle} />

        <CapacityComparison />

        <div data-reveal className="mt-14 text-center sm:mt-16">
          <h3 className="text-[#111827] text-xl font-semibold tracking-tight sm:text-2xl">
            Included in Every Novend Plan
          </h3>
          <ul className="mt-6 flex flex-wrap justify-center gap-2.5 sm:gap-3">
            {copy.includedEveryPlan.map((item, index) => {
              const Icon = INCLUDED_ICONS[index] ?? Package;
              return (
                <li
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm"
                >
                  <Icon className="text-primary h-4 w-4" aria-hidden />
                  {item}
                </li>
              );
            })}
          </ul>
        </div>

        <ul
          data-reveal
          className="mt-12 grid gap-4 border-t border-slate-200/80 pt-10 sm:mt-14 sm:grid-cols-3 sm:gap-6"
        >
          {copy.trust.map((item, index) => {
            const Icon = TRUST_ICONS[index] ?? ShieldCheck;
            return (
              <li key={item.title} className="flex items-start gap-3 sm:justify-center">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <p className="text-[#111827] text-sm font-semibold">{item.title}</p>
                  <p className="text-slate-500 mt-0.5 text-sm">{item.detail}</p>
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
        className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm"
      >
        {(["monthly", "yearly"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={cycle === option}
            onClick={() => onChange(option)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
              cycle === option
                ? "bg-primary text-white"
                : "text-slate-600 hover:text-[#111827]",
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
      <p className="text-slate-500 text-xs">
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
          external || plan.isLifetime
            ? cta.href
            : `${cta.href}?plan=${key}&cycle=${cycle}`;

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
              "landing-price-card-v2 group relative flex min-w-[82%] snap-center flex-col rounded-3xl border bg-white p-6 transition-[transform,box-shadow,border-color] duration-300 sm:min-w-0 sm:p-7",
              mobileOrderClass,
              isFeatured &&
                "landing-price-card-featured border-primary/45 shadow-[0_24px_48px_-28px_rgba(56,189,248,0.55)] sm:z-10 xl:-translate-y-2",
              isGold && "landing-price-card-lifetime border-amber-300/70",
              !isFeatured && !isGold && "border-slate-200/90 shadow-sm",
            )}
          >
            <span
              className={cn(
                "mb-3 inline-flex self-start rounded-full px-3 py-1 text-[10px] font-bold tracking-[0.12em] uppercase sm:absolute sm:-top-3 sm:left-1/2 sm:mb-0 sm:-translate-x-1/2 sm:self-auto",
                isFeatured && "bg-primary text-white",
                isGold && "border border-amber-300 bg-amber-50 text-amber-900",
                !isFeatured &&
                  !isGold &&
                  "border border-slate-200 bg-white text-slate-700",
              )}
            >
              {planBadge(key)}
            </span>

            <h3 className="text-[#111827] text-xl font-semibold tracking-tight sm:mt-2">
              {plan.name}
            </h3>
            <p className="text-slate-600 mt-3 text-sm leading-relaxed">{planDescription(key)}</p>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="text-[#111827] text-3xl font-semibold tracking-tight">{price.amount}</p>
              <p className="text-slate-500 mt-1 text-xs">{price.suffix}</p>
              {price.savings !== null ? (
                <p className="text-primary mt-2 text-xs font-semibold">
                  Save GH₵{price.savings.toLocaleString()} / year
                </p>
              ) : null}
            </div>

            <ul className="mt-5 space-y-1.5 text-xs text-slate-600">
              {limitLines.map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <span className="bg-slate-300 h-1 w-1 shrink-0 rounded-full" aria-hidden />
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
                variant={isFeatured ? "default" : "secondary"}
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

function CapacityComparison() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setActive(true);
      },
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      data-reveal
      className="landing-shadow-card mt-12 rounded-3xl border border-slate-200/80 bg-white p-5 sm:mt-14 sm:p-8"
    >
      <h3 className="text-[#111827] text-lg font-semibold tracking-tight sm:text-xl">
        Visual Capacity Comparison
      </h3>
      <p className="text-slate-500 mt-1 text-sm">
        See how capacity grows as you move from Basic to Enterprise.
      </p>

      <div className="mt-6 space-y-6">
        {CAPACITY_METRICS.map((metric) => (
          <div key={metric.key}>
            <p className="text-[#111827] text-sm font-semibold">{metric.label}</p>
            <ul className="mt-3 space-y-2.5">
              {(["basic", "pro", "enterprise"] as const).map((key) => {
                const plan = PLAN_CATALOG[key];
                const value = plan.limits[metric.key];
                const ratio = capacityRatioFor(metric.key, value);
                return (
                  <li key={key} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3">
                    <span className="text-xs font-medium text-slate-500">{plan.name}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          "landing-capacity-fill h-full rounded-full",
                          key === "pro" ? "bg-primary" : "bg-slate-400",
                          active && "landing-capacity-fill-on",
                        )}
                        style={
                          {
                            "--capacity": `${Math.round(ratio * 100)}%`,
                          } as CSSProperties
                        }
                      />
                    </div>
                    <span className="min-w-[4.5rem] text-right text-xs font-semibold tabular-nums text-slate-700">
                      {limitLabel(value, "count")}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
