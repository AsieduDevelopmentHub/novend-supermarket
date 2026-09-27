import { describe, expect, it } from "vitest";
import {
  BUSINESS_CAPABILITY_CONFIGURATION_VERSION,
  DEFAULT_BUSINESS_CONFIGURATION,
  configurationFromIndustryPack,
  hasBusinessCapability,
  parseBusinessConfiguration,
  planAllowsBusinessCapability,
  validateBusinessCapabilitySet,
} from "@/convex/shared/businessCapabilities";
import { navGroupsForRole, pathAllowedForRole } from "@/config/navigation";

describe("businessCapabilities registry", () => {
  it("defaults to retail with no capabilities enabled", () => {
    expect(DEFAULT_BUSINESS_CONFIGURATION.enabledCapabilities).toEqual([]);
    expect(DEFAULT_BUSINESS_CONFIGURATION.industryProfile).toBe("retail");
    expect(DEFAULT_BUSINESS_CONFIGURATION.configurationVersion).toBe(
      BUSINESS_CAPABILITY_CONFIGURATION_VERSION,
    );
    expect(hasBusinessCapability(DEFAULT_BUSINESS_CONFIGURATION, "multi_unit_pricing")).toBe(false);
  });

  it("parses missing or invalid JSON as defaults", () => {
    expect(parseBusinessConfiguration(undefined).enabledCapabilities).toEqual([]);
    expect(parseBusinessConfiguration("{").industryProfile).toBe("retail");
  });

  it("gates multi_unit_pricing behind Pro+", () => {
    expect(planAllowsBusinessCapability("basic", "multi_unit_pricing")).toBe(false);
    expect(planAllowsBusinessCapability("pro", "multi_unit_pricing")).toBe(true);
    expect(planAllowsBusinessCapability("basic", "configurable_pos")).toBe(true);
  });

  it("expands scale_hardware dependency on sell_by_weight", () => {
    const result = validateBusinessCapabilitySet(["scale_hardware"], "pro");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.keys).toContain("sell_by_weight");
      expect(result.keys).toContain("scale_hardware");
    }
  });

  it("rejects Pro capabilities on Basic when validating a set", () => {
    const result = validateBusinessCapabilitySet(["multi_unit_pricing"], "basic");
    expect(result.ok).toBe(false);
  });

  it("applies cold_store pack within plan limits", () => {
    const basic = configurationFromIndustryPack("cold_store", "basic");
    expect(basic.enabledCapabilities).not.toContain("sell_by_weight");
    expect(basic.enabledCapabilities).toContain("configurable_pos");

    const pro = configurationFromIndustryPack("cold_store", "pro");
    expect(pro.enabledCapabilities).toContain("sell_by_weight");
    expect(pro.enabledCapabilities).toContain("scale_hardware");
  });

  it("applies restaurant and hotel packs with non_stock_sales on Basic", () => {
    const restaurant = configurationFromIndustryPack("restaurant", "basic");
    expect(restaurant.enabledCapabilities).toContain("non_stock_sales");
    expect(restaurant.enabledCapabilities).toContain("configurable_pos");

    const hotel = configurationFromIndustryPack("hotel", "basic");
    expect(hotel.enabledCapabilities).toContain("non_stock_sales");
  });

  it("allows non_stock_sales on Basic", () => {
    expect(planAllowsBusinessCapability("basic", "non_stock_sales")).toBe(true);
  });
});

describe("navigation capability gates", () => {
  it("keeps existing routes when no capability flags are set on items", () => {
    const admin = navGroupsForRole("administrator");
    const cashier = navGroupsForRole("cashier");
    expect(admin.some((g) => g.items.some((i) => i.href === "/sales"))).toBe(true);
    expect(cashier.some((g) => g.items.some((i) => i.href === "/wholesale"))).toBe(false);
    expect(pathAllowedForRole("/sales", "cashier")).toBe(true);
  });
});
