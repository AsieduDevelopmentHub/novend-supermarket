import { describe, expect, it } from "vitest";
import {
  BUSINESS_CAPABILITY_CONFIGURATION_VERSION,
  DEFAULT_BUSINESS_CONFIGURATION,
  configurationFromIndustryPack,
  hasBusinessCapability,
  parseBusinessConfiguration,
  planAllowsBusinessCapability,
  resolveIndustryProfileForProvision,
  stockOpsVisibleForIndustry,
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
    expect(restaurant.enabledCapabilities).toContain("tables_orders");
    expect(restaurant.enabledCapabilities).toContain("kitchen_tickets");
    expect(restaurant.enabledCapabilities).toContain("modifiers");

    const hotel = configurationFromIndustryPack("hotel", "basic");
    expect(hotel.enabledCapabilities).toContain("non_stock_sales");
    expect(hotel.enabledCapabilities).toContain("rooms_folio");
    expect(hotel.enabledCapabilities).toContain("reservations");
    expect(hotel.enabledCapabilities).not.toContain("tables_orders");
  });

  it("expands reservations dependency on rooms_folio", () => {
    const result = validateBusinessCapabilitySet(["reservations"], "basic");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.keys).toContain("rooms_folio");
      expect(result.keys).toContain("reservations");
    }
  });

  it("applies bar pack like restaurant dining", () => {
    const bar = configurationFromIndustryPack("bar", "basic");
    expect(bar.enabledCapabilities).toContain("tables_orders");
    expect(bar.enabledCapabilities).toContain("kitchen_tickets");
  });

  it("resolves provision industry with custom → retail and policy default", () => {
    expect(resolveIndustryProfileForProvision("custom")).toBe("retail");
    expect(resolveIndustryProfileForProvision(undefined, "restaurant")).toBe("restaurant");
    expect(resolveIndustryProfileForProvision("bar")).toBe("bar");
    expect(resolveIndustryProfileForProvision("other")).toBe("retail");
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

  it("hides stock-ops nav for restaurant, hotel, and bar profiles", () => {
    expect(stockOpsVisibleForIndustry("restaurant")).toBe(false);
    expect(stockOpsVisibleForIndustry("hotel")).toBe(false);
    expect(stockOpsVisibleForIndustry("bar")).toBe(false);
    expect(stockOpsVisibleForIndustry("retail")).toBe(true);

    const restaurantNav = navGroupsForRole("administrator", [], {
      industryProfile: "restaurant",
    });
    const hrefs = restaurantNav.flatMap((g) => g.items.map((i) => i.href));
    expect(hrefs).toContain("/products");
    expect(hrefs).not.toContain("/inventory");
    expect(hrefs).not.toContain("/wholesale");
    expect(hrefs).not.toContain("/suppliers");
    expect(
      pathAllowedForRole("/inventory", "administrator", [], { industryProfile: "hotel" }),
    ).toBe(false);
  });
});

describe("Cap More menu hospitality routes", () => {
  it("lists Floor and Kitchen when dining capabilities are on", async () => {
    const { moreSectionsForRole } = await import("@/config/mobile-navigation");
    const sections = moreSectionsForRole("administrator", ["tables_orders", "kitchen_tickets"], {
      industryProfile: "restaurant",
    });
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/floor");
    expect(hrefs).toContain("/kitchen");
    expect(hrefs).not.toContain("/rooms");
  });

  it("lists Rooms and Reservations when hotel capabilities are on", async () => {
    const { moreSectionsForRole } = await import("@/config/mobile-navigation");
    const sections = moreSectionsForRole("administrator", ["rooms_folio", "reservations"], {
      industryProfile: "hotel",
    });
    const hrefs = sections.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).toContain("/rooms");
    expect(hrefs).toContain("/reservations");
    expect(hrefs).not.toContain("/floor");
  });
});
