import { describe, expect, it } from "vitest";
import {
  assertSellableProduct,
  catalogDisplayName,
  formatVariantLabel,
  isSellableCatalogProduct,
  sanitizeCustomValues,
  sanitizeVariantAttributes,
} from "@/convex/shared/productVariants";
import {
  configurationFromIndustryPack,
  hasBusinessCapability,
  INDUSTRY_PACKS,
} from "@/convex/shared/businessCapabilities";

describe("product variants", () => {
  it("formats and sanitizes attributes", () => {
    expect(formatVariantLabel([{ key: "Color", value: "Red" }, { key: "Size", value: "M" }])).toBe(
      "Red / M",
    );
    expect(
      sanitizeVariantAttributes([
        { key: "  Color ", value: " Red " },
        { key: "", value: "x" },
        { key: "Size", value: "" },
      ]),
    ).toEqual([{ key: "Color", value: "Red" }]);
  });

  it("blocks selling parents and labels children", () => {
    expect(() => assertSellableProduct({ isVariantParent: true, name: "Tee" })).toThrow(
      /variant/i,
    );
    expect(catalogDisplayName({ name: "Tee", variantLabel: "Red / M" })).toBe("Tee · Red / M");
    expect(isSellableCatalogProduct({ status: "active", isVariantParent: true })).toBe(false);
    expect(isSellableCatalogProduct({ status: "active", isVariantParent: false })).toBe(true);
  });

  it("sanitizes custom fields", () => {
    expect(
      sanitizeCustomValues([
        { key: " Shade ", value: " Nude " },
        { key: "", value: "x" },
      ]),
    ).toEqual([{ key: "Shade", value: "Nude" }]);
  });
});

describe("new industry packs", () => {
  it("includes fashion cosmetics convenience hardware stationery", () => {
    expect(INDUSTRY_PACKS.fashion).toContain("product_variants");
    expect(INDUSTRY_PACKS.cosmetics).toEqual(
      expect.arrayContaining(["product_variants", "lot_expiry", "custom_fields"]),
    );
    expect(INDUSTRY_PACKS.convenience).toEqual(
      expect.arrayContaining(["multi_unit_pricing", "lot_expiry"]),
    );
    expect(INDUSTRY_PACKS.hardware).toContain("serial_tracking");
    expect(INDUSTRY_PACKS.stationery).toContain("product_variants");
    expect(INDUSTRY_PACKS.supermarket).toContain("sell_by_weight");
    expect(INDUSTRY_PACKS.supermarket).not.toContain("multi_unit_pricing");
  });

  it("keeps pharmacy lot_expiry and custom_fields", () => {
    const pack = configurationFromIndustryPack("pharmacy", "pro");
    expect(hasBusinessCapability(pack, "lot_expiry")).toBe(true);
    expect(hasBusinessCapability(pack, "custom_fields")).toBe(true);
  });

  it("gates product_variants behind Pro+", () => {
    const basic = configurationFromIndustryPack("fashion", "basic");
    expect(hasBusinessCapability(basic, "product_variants")).toBe(false);
    const pro = configurationFromIndustryPack("fashion", "pro");
    expect(hasBusinessCapability(pro, "product_variants")).toBe(true);
  });
});
