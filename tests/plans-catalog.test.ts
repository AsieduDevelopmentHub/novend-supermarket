import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIST_PRICE_MARKUP_PERCENT,
  MIN_MONTHLY_PRICE_GHS,
  MIN_PRODUCT_LIMIT,
  PLAN_CATALOG,
  PRO_CAPABILITY_MIN_SORT_ORDER,
  SELLABLE_PLAN_KEYS,
  SELLABLE_PLAN_LIST,
  clampListPriceMarkupPercent,
  collectComparablePlanFeatures,
  listPriceFromReal,
  resolvePlanFeatures,
  yearlyPriceFromMonthly,
} from "@/convex/shared/plans";
import { planCapabilities } from "@/convex/shared/capabilities";

describe("multi-plan catalog seed", () => {
  it("starts at 100 products and GH₵99 floor", () => {
    expect(PLAN_CATALOG.starter.limits.products).toBe(MIN_PRODUCT_LIMIT);
    expect(PLAN_CATALOG.starter.monthlyPrice).toBe(MIN_MONTHLY_PRICE_GHS);
    for (const plan of SELLABLE_PLAN_LIST) {
      expect(plan.monthlyPrice).toBeGreaterThanOrEqual(MIN_MONTHLY_PRICE_GHS);
      if (plan.limits.products !== null) {
        expect(plan.limits.products).toBeGreaterThanOrEqual(MIN_PRODUCT_LIMIT);
      }
      expect(plan.yearlyPrice).toBe(yearlyPriceFromMonthly(plan.monthlyPrice!));
    }
  });

  it("homepage highlights Starter, Pro, and Enterprise only", () => {
    const highlights = SELLABLE_PLAN_LIST.filter((plan) => plan.homepageHighlight).map(
      (plan) => plan.key,
    );
    expect(highlights).toEqual(["starter", "pro", "enterprise"]);
  });

  it("marks Pro as recommended and unlocks Pro capabilities by sort order", () => {
    expect(PLAN_CATALOG.pro.featured).toBe(true);
    expect(PLAN_CATALOG.pro.sortOrder).toBe(PRO_CAPABILITY_MIN_SORT_ORDER);
    expect(planCapabilities("growth").canExportXlsx).toBe(false);
    expect(planCapabilities("pro").canExportXlsx).toBe(true);
    expect(planCapabilities("business").canUseCustomerDisplay).toBe(true);
  });

  it("exposes seven sellable keys and keeps lifetime non-marketing", () => {
    expect(SELLABLE_PLAN_KEYS).toHaveLength(7);
    expect(PLAN_CATALOG.lifetime.marketingVisible).toBe(false);
    expect(PLAN_CATALOG.lifetime.selfServe).toBe(false);
    expect(PLAN_CATALOG.lifetime.legacy).toBe(true);
  });
});

describe("list-price markup psychology", () => {
  it("ceils real × (1 + pct/100) and clamps percent", () => {
    expect(listPriceFromReal(99, DEFAULT_LIST_PRICE_MARKUP_PERCENT)).toBe(119);
    expect(listPriceFromReal(459, 20)).toBe(551);
    expect(clampListPriceMarkupPercent(20)).toBe(20);
    expect(clampListPriceMarkupPercent(-5)).toBe(0);
    expect(clampListPriceMarkupPercent(200)).toBe(90);
  });
});

describe("plan feature inheritance for comparison", () => {
  it("expands Everything-in lines so Offline POS is on every sellable tier", () => {
    for (const plan of SELLABLE_PLAN_LIST) {
      const resolved = resolvePlanFeatures(plan, SELLABLE_PLAN_LIST);
      expect(resolved).toContain("Offline POS");
      expect(resolved.some((feature) => feature.startsWith("Everything in "))).toBe(false);
    }
  });

  it("marks inherited features present for higher plans in the matrix", () => {
    const { rows, resolvedByKey } = collectComparablePlanFeatures(SELLABLE_PLAN_LIST);
    expect(rows).toContain("Offline POS");
    expect(rows).not.toContain("Everything in Starter");
    for (const plan of SELLABLE_PLAN_LIST) {
      expect(resolvedByKey.get(plan.key)?.has("Offline POS")).toBe(true);
    }
    expect(resolvedByKey.get("pro")?.has("Wholesale inventory")).toBe(true);
    expect(resolvedByKey.get("starter")?.has("Wholesale inventory")).toBe(false);
  });

  it("lists SMS capabilities on the ladder for pricing compare", () => {
    const { rows, resolvedByKey } = collectComparablePlanFeatures(SELLABLE_PLAN_LIST);
    expect(rows).toContain("SMS notifications");
    expect(rows).toContain("SMS to cashiers & staff");
    expect(rows).toContain("Customer SMS");
    expect(rows).toContain("Payment & commission SMS alerts");
    expect(rows).toContain("Organization SMS configuration");
    for (const plan of SELLABLE_PLAN_LIST) {
      expect(resolvedByKey.get(plan.key)?.has("SMS notifications")).toBe(true);
    }
    expect(resolvedByKey.get("pro")?.has("Payment & commission SMS alerts")).toBe(true);
    expect(resolvedByKey.get("starter")?.has("Payment & commission SMS alerts")).toBe(false);
    expect(resolvedByKey.get("business")?.has("Organization SMS configuration")).toBe(true);
  });
});
