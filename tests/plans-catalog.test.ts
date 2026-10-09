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
  listPriceFromReal,
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
