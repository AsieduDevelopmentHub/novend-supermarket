import { describe, expect, it } from "vitest";
import { nextCatalogPrices } from "@/lib/wholesale/purchase-prices";

describe("wholesale purchase catalog prices", () => {
  it("always applies unit cost and keeps selling when omitted", () => {
    expect(
      nextCatalogPrices({ unitCost: 12.5, currentSelling: 18 }),
    ).toEqual({ costPrice: 12.5, sellingPrice: 18 });
  });

  it("updates selling when the purchase includes a new price", () => {
    expect(
      nextCatalogPrices({ unitCost: 14, sellingPrice: 20, currentSelling: 18 }),
    ).toEqual({ costPrice: 14, sellingPrice: 20 });
  });
});
