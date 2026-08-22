import { describe, expect, it } from "vitest";
import {
  PLAN_KEYS,
  PLAN_LIST,
  isPlanKey,
  limitReachedMessage,
  planLimitLines,
  effectivePlanLimits,
  parseCustomBackupGb,
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
    expect(limitReachedMessage("basic", "products", 500)).toBe(
      "Cannot create Product #501 on Basic. Upgrade to add more.",
    );
    expect(limitReachedMessage("basic", "users", 3)).toBe(
      "Cannot create User #4 on Basic. Upgrade to add more.",
    );
    expect(limitReachedMessage("basic", "devices", 3)).toBe(
      "Cannot activate Device #4 on Basic. Deactivate another device or upgrade.",
    );
    expect(limitReachedMessage("basic", "backupBytes", 250 * 1024 * 1024)).toMatch(
      /Local backups continue/,
    );
  });

  it("matches the published commercial limits", () => {
    expect(resolvePlan("basic").limits).toEqual({
      products: 500,
      users: 3,
      branches: 1,
      devices: 3,
      backupBytes: 250 * 1024 * 1024,
    });
    expect(resolvePlan("pro").limits).toEqual({
      products: 5000,
      users: 15,
      branches: 5,
      devices: 15,
      backupBytes: 500 * 1024 * 1024,
    });
    expect(resolvePlan("enterprise").limits.backupBytes).toBeNull();
    expect(resolvePlan("enterprise").variableBackup).toBe(true);
    expect(resolvePlan("enterprise").priceFrom).toBe(true);
    expect(resolvePlan("lifetime").limits.backupBytes).toBe(1024 * 1024 * 1024);
    expect(resolvePlan("lifetime").oneTimePrice).toBe(7990);
    expect(resolvePlan("pro").featured).toBe(true);
    expect(resolvePlan("lifetime").features.some((feature) => feature.includes("1.5 years"))).toBe(
      true,
    );
    expect(planLimitLines(resolvePlan("basic"))).toEqual([
      "500 products",
      "3 users",
      "1 branch",
      "3 devices",
      "250 MB cloud backup",
    ]);
    expect(planLimitLines(resolvePlan("enterprise"))).toContain("Custom cloud backup");
  });

  it("applies an Enterprise backup quota without changing the catalog", () => {
    const enterprise = resolvePlan("enterprise");
    expect(effectivePlanLimits(enterprise).backupBytes).toBeNull();
    expect(effectivePlanLimits(enterprise, 5 * 1024 * 1024 * 1024).backupBytes).toBe(
      5 * 1024 * 1024 * 1024,
    );
    expect(effectivePlanLimits(resolvePlan("pro"), 5 * 1024 * 1024 * 1024).backupBytes).toBe(
      500 * 1024 * 1024,
    );
    expect(parseCustomBackupGb(null)).toBeNull();
    expect(parseCustomBackupGb(8)).toBe(8 * 1024 * 1024 * 1024);
    expect(() => parseCustomBackupGb(0)).toThrow(/whole number of GB/);
    expect(() => parseCustomBackupGb(1.5)).toThrow(/whole number of GB/);
  });
});
