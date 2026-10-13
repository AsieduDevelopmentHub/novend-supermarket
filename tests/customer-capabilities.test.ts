import { describe, expect, it } from "vitest";
import {
  configurationFromIndustryPack,
  planAllowsBusinessCapability,
  validateBusinessCapabilitySet,
} from "@/convex/shared/businessCapabilities";

describe("customer_credit and customer_pricing capabilities", () => {
  it("are Pro+ only", () => {
    for (const key of ["customer_credit", "customer_pricing"] as const) {
      expect(planAllowsBusinessCapability("basic", key)).toBe(false);
      expect(planAllowsBusinessCapability("pro", key)).toBe(true);
    }
  });

  it("are rejected on Basic when validating a set", () => {
    expect(validateBusinessCapabilitySet(["customer_credit"], "basic").ok).toBe(false);
    expect(validateBusinessCapabilitySet(["customer_pricing"], "basic").ok).toBe(false);
    expect(validateBusinessCapabilitySet(["customer_credit", "customer_pricing"], "pro").ok).toBe(
      true,
    );
  });

  it("are part of the wholesale pack only within plan limits", () => {
    const pro = configurationFromIndustryPack("wholesale", "pro");
    expect(pro.enabledCapabilities).toContain("customer_credit");
    expect(pro.enabledCapabilities).toContain("customer_pricing");
    const basic = configurationFromIndustryPack("wholesale", "basic");
    expect(basic.enabledCapabilities).not.toContain("customer_credit");
    expect(basic.enabledCapabilities).not.toContain("customer_pricing");
    expect(configurationFromIndustryPack("retail", "pro").enabledCapabilities).not.toContain(
      "customer_credit",
    );
  });
});
