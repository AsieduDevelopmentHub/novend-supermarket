import { describe, expect, it } from "vitest";
import { catalogAvailableQuantity } from "@/hooks/use-offline-catalog";

describe("catalogAvailableQuantity", () => {
  it("uses on-hand stock when inventory is tracked", () => {
    expect(catalogAvailableQuantity({ stockQuantity: 4, tracksInventory: true })).toBe(4);
    expect(catalogAvailableQuantity({ stockQuantity: 0 })).toBe(0);
  });

  it("treats non-stock catalogue items as unlimited", () => {
    expect(catalogAvailableQuantity({ stockQuantity: 0, tracksInventory: false })).toBe(
      Number.POSITIVE_INFINITY,
    );
  });

  it("returns 0 when the product is missing", () => {
    expect(catalogAvailableQuantity(undefined)).toBe(0);
  });
});
