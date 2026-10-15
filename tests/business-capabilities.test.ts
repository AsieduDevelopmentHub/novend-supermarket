import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
import {
  opsDisableWarningCopy,
  resolveBusinessTerms,
  resolveNavTitleFromTerms,
  salesViewDescription,
  termsForIndustry,
} from "@/convex/shared/businessTerms";
import { navGroupsForRole, pathAllowedForRole } from "@/config/navigation";

describe("businessCapabilities registry", () => {
  it("defaults to the supermarket pack", () => {
    expect(DEFAULT_BUSINESS_CONFIGURATION.industryProfile).toBe("supermarket");
    expect(DEFAULT_BUSINESS_CONFIGURATION.enabledCapabilities).toEqual([
      "lot_expiry",
      "sell_by_weight",
      "configurable_pos",
    ]);
    expect(DEFAULT_BUSINESS_CONFIGURATION.configurationVersion).toBe(
      BUSINESS_CAPABILITY_CONFIGURATION_VERSION,
    );
    expect(hasBusinessCapability(DEFAULT_BUSINESS_CONFIGURATION, "multi_unit_pricing")).toBe(false);
  });

  it("parses missing or invalid JSON as supermarket defaults", () => {
    expect(parseBusinessConfiguration(undefined).industryProfile).toBe("supermarket");
    expect(parseBusinessConfiguration("{").industryProfile).toBe("supermarket");
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

  it("always provisions supermarket regardless of request or policy", () => {
    expect(resolveIndustryProfileForProvision("custom")).toBe("supermarket");
    expect(resolveIndustryProfileForProvision(undefined, "restaurant")).toBe("supermarket");
    expect(resolveIndustryProfileForProvision("bar")).toBe("supermarket");
    expect(resolveIndustryProfileForProvision("other")).toBe("supermarket");
  });

  it("allows non_stock_sales on Basic", () => {
    expect(planAllowsBusinessCapability("basic", "non_stock_sales")).toBe(true);
  });
});

describe("business terminology", () => {
  it("uses retail-sensible defaults for retail, pharmacy, supermarket, wholesale", () => {
    expect(termsForIndustry("retail").product).toBe("Product");
    expect(termsForIndustry("pharmacy").product).toBe("Medicine");
    expect(termsForIndustry("supermarket").customer).toBe("Customer");
    expect(termsForIndustry("wholesale").customer).toBe("Buyer");
  });

  it("uses hospitality defaults for restaurant, bar, hotel", () => {
    expect(termsForIndustry("restaurant").check).toBe("Check");
    expect(termsForIndustry("restaurant").ticket).toBe("Kitchen ticket");
    expect(termsForIndustry("bar").check).toBe("Tab");
    expect(termsForIndustry("bar").kitchen).toBe("Bar queue");
    expect(termsForIndustry("hotel").folio).toBe("Folio");
    expect(termsForIndustry("hotel").branch).toBe("Property");
  });

  it("merges admin overrides on top of industry defaults", () => {
    const terms = resolveBusinessTerms("bar", { kitchen: "Service bar" });
    expect(terms.kitchen).toBe("Service bar");
    expect(terms.check).toBe("Tab");
  });

  it("resolves industry-sensitive nav titles from terms", () => {
    const bar = termsForIndustry("bar");
    const hotel = termsForIndustry("hotel");
    expect(resolveNavTitleFromTerms("/kitchen", bar, "Kitchen")).toBe("Bar queue");
    expect(resolveNavTitleFromTerms("/floor", bar, "Floor")).toBe("Floor");
    expect(resolveNavTitleFromTerms("/rooms", hotel, "Rooms")).toBe("Rooms");
    expect(resolveNavTitleFromTerms("/products", hotel, "Products")).toBe("Services");
  });

  it("applies hospitality POS copy while keeping retail/wholesale classic wording", () => {
    const retail = termsForIndustry("retail");
    const hotel = termsForIndustry("hotel");
    expect(salesViewDescription("retail", retail)).toBe(
      "Create a new wholesale or retail sale.",
    );
    expect(salesViewDescription("wholesale", retail)).toBe(
      "Create a new wholesale or retail sale.",
    );
    expect(salesViewDescription("hotel", hotel)).toMatch(/folio/i);
  });

  it("warns when disabling ops capabilities", () => {
    expect(opsDisableWarningCopy([])).toBeNull();
    expect(opsDisableWarningCopy(["tables_orders"])).toMatch(/open checks/i);
  });

  it("labels nav groups with saved terms without changing capability gates", () => {
    const barTerms = termsForIndustry("bar");
    const groups = navGroupsForRole(
      "administrator",
      ["tables_orders", "kitchen_tickets"],
      { industryProfile: "bar" },
      barTerms,
    );
    const kitchen = groups.flatMap((g) => g.items).find((i) => i.href === "/kitchen");
    expect(kitchen?.title).toBe("Bar queue");
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

describe("pack save branding safety", () => {
  it("does not reset experienceOverrides inside updateBusinessCapabilities", () => {
    const source = readFileSync(resolve(process.cwd(), "convex/settings.ts"), "utf8");
    const mutationStart = source.indexOf("export const updateBusinessCapabilities");
    expect(mutationStart).toBeGreaterThan(-1);
    const nextExport = source.indexOf("export const getBusinessTerminology", mutationStart);
    const body = source.slice(mutationStart, nextExport > 0 ? nextExport : undefined);
    // Comment may mention branding; assert no code patches brand tokens.
    expect(body).not.toMatch(/experienceOverrides\s*:/);
    expect(body).not.toMatch(/experiencePresetForIndustry\s*\(/);
    expect(body).not.toMatch(/bumpEntitlementVersion\s*\(/);
  });
});
