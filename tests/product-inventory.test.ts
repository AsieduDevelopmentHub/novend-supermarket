import { describe, expect, it } from "vitest";
import {
  DEFAULT_BUSINESS_CONFIGURATION,
  configurationFromIndustryPack,
  type OrganizationBusinessConfiguration,
} from "@/convex/shared/businessCapabilities";
import { productTracksInventory } from "@/convex/shared/productInventory";

describe("productTracksInventory", () => {
  const withNonStock: OrganizationBusinessConfiguration = {
    ...DEFAULT_BUSINESS_CONFIGURATION,
    industryProfile: "restaurant",
    enabledCapabilities: ["non_stock_sales"],
  };

  it("tracks stock by default when capability is off", () => {
    expect(productTracksInventory({ tracksInventory: false }, DEFAULT_BUSINESS_CONFIGURATION)).toBe(
      true,
    );
    expect(productTracksInventory({}, DEFAULT_BUSINESS_CONFIGURATION)).toBe(true);
  });

  it("skips stock only when capability is on and tracksInventory is false", () => {
    expect(productTracksInventory({ tracksInventory: false }, withNonStock)).toBe(false);
    expect(productTracksInventory({ tracksInventory: true }, withNonStock)).toBe(true);
    expect(productTracksInventory({}, withNonStock)).toBe(true);
  });

  it("matches restaurant pack behaviour", () => {
    const pack = configurationFromIndustryPack("restaurant", "basic");
    expect(productTracksInventory({ tracksInventory: false }, pack)).toBe(false);
  });
});
