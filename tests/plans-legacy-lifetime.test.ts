import { describe, expect, it } from "vitest";
import {
  DEFAULT_PLAN_KEY,
  PLAN_CATALOG,
  PLAN_KEYS,
  SELLABLE_PLAN_KEYS,
  isPlanKey,
  isSellablePlanKey,
  resolvePlan,
} from "@/convex/shared/plans";

describe("legacy lifetime and secure plan fallback", () => {
  it("defaults unknown plan data to basic, never lifetime", () => {
    expect(DEFAULT_PLAN_KEY).toBe("basic");
    expect(resolvePlan("standard").key).toBe("basic");
    expect(resolvePlan(undefined).key).toBe("basic");
    expect(resolvePlan(null).key).toBe("basic");
    expect(resolvePlan("enterprise-plus").key).toBe("basic");
  });

  it("still resolves historical lifetime rows with full catalog entitlements", () => {
    expect(isPlanKey("lifetime")).toBe(true);
    expect(PLAN_KEYS).toContain("lifetime");
    const lifetime = resolvePlan("lifetime");
    expect(lifetime.key).toBe("lifetime");
    expect(lifetime.isLifetime).toBe(true);
    expect(lifetime.legacy).toBe(true);
    expect(lifetime.selfServe).toBe(false);
    expect(lifetime.limits.products).toBeNull();
    expect(lifetime.oneTimePrice).toBe(7990);
  });

  it("excludes lifetime from sellable plan keys while keeping it in the catalog", () => {
    expect(SELLABLE_PLAN_KEYS).toContain("starter");
    expect(SELLABLE_PLAN_KEYS).toContain("pro");
    expect(SELLABLE_PLAN_KEYS).toContain("enterprise");
    expect(SELLABLE_PLAN_KEYS).not.toContain("lifetime");
    expect(isSellablePlanKey("lifetime")).toBe(false);
    expect(isSellablePlanKey("basic")).toBe(true);
    expect(isSellablePlanKey("starter")).toBe(true);
    expect(PLAN_CATALOG.lifetime.legacy).toBe(true);
    expect(PLAN_CATALOG.basic.legacy).toBeUndefined();
  });
});
