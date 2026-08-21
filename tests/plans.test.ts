import { describe, expect, it } from "vitest";
import {
  PLAN_KEYS,
  PLAN_LIST,
  isPlanKey,
  limitReachedMessage,
  priceForCycle,
  resolvePlan,
  supportsCycle,
} from "@/convex/shared/plans";

describe("plan catalog", () => {
  it("exposes every plan exactly once, in display order", () => {
    expect(PLAN_LIST.map((plan) => plan.key)).toEqual([...PLAN_KEYS]);
    const sortOrders = PLAN_LIST.map((plan) => plan.sortOrder);
    expect([...sortOrders].sort((a, b) => a - b)).toEqual(sortOrders);
  });

  it("prices yearly below twelve months so the discount is real", () => {
    for (const plan of PLAN_LIST) {
      if (plan.monthlyPrice === null || plan.yearlyPrice === null) continue;
      expect(plan.yearlyPrice).toBeLessThan(plan.monthlyPrice * 12);
    }
  });

  it("gives every paid cycle a price", () => {
    for (const plan of PLAN_LIST) {
      for (const cycle of ["monthly", "yearly", "lifetime"] as const) {
        if (!supportsCycle(plan, cycle)) continue;
        expect(priceForCycle(plan, cycle)).toBeGreaterThan(0);
      }
    }
  });

  it("sells lifetime plans only as a one-time purchase", () => {
    const lifetime = PLAN_LIST.filter((plan) => plan.isLifetime);
    expect(lifetime.length).toBeGreaterThan(0);
    for (const plan of lifetime) {
      expect(supportsCycle(plan, "lifetime")).toBe(true);
      expect(supportsCycle(plan, "monthly")).toBe(false);
      expect(supportsCycle(plan, "yearly")).toBe(false);
    }
  });

  it("never sells a recurring plan on a lifetime cycle", () => {
    for (const plan of PLAN_LIST) {
      if (plan.isLifetime) continue;
      expect(supportsCycle(plan, "lifetime")).toBe(false);
    }
  });

  it("prices lifetime above a year of every subscription", () => {
    const lifetimePrice = resolvePlan("lifetime").oneTimePrice;
    expect(lifetimePrice).toBeGreaterThan(0);
    for (const plan of PLAN_LIST) {
      if (plan.isLifetime || plan.yearlyPrice === null) continue;
      expect(lifetimePrice).toBeGreaterThan(plan.yearlyPrice);
    }
  });

  it("sells enterprise on the same checkout as basic and pro", () => {
    const enterprise = resolvePlan("enterprise");
    expect(enterprise.selfServe).toBe(true);
    expect(supportsCycle(enterprise, "monthly")).toBe(true);
    expect(supportsCycle(enterprise, "yearly")).toBe(true);
    expect(supportsCycle(enterprise, "lifetime")).toBe(false);
  });

  it("grows limits as plans get more expensive", () => {
    const basic = resolvePlan("basic");
    const pro = resolvePlan("pro");
    expect(pro.limits.products!).toBeGreaterThan(basic.limits.products!);
    expect(pro.limits.users!).toBeGreaterThan(basic.limits.users!);
    expect(pro.limits.branches!).toBeGreaterThan(basic.limits.branches!);
  });

  it("falls back to a usable plan for legacy or unknown values", () => {
    expect(isPlanKey("standard")).toBe(false);
    expect(resolvePlan("standard").key).toBe(resolvePlan(undefined).key);
    expect(resolvePlan(null).limits).toBeDefined();
  });

  it("explains every limit in plain language", () => {
    for (const resource of ["products", "users", "branches", "devices", "backupBytes"] as const) {
      const message = limitReachedMessage("basic", resource, 5);
      expect(message.length).toBeGreaterThan(10);
      expect(message.endsWith(".")).toBe(true);
    }
  });
});
