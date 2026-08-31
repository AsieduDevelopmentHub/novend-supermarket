import { describe, expect, it } from "vitest";
import {
  availableStockQuantity,
  isBelowLowStockThreshold,
  isLowStockAtAnyBranch,
} from "@/lib/stock-status";

describe("stock status", () => {
  it("uses sellable quantity for expiry-tracked products", () => {
    expect(
      availableStockQuantity({
        tracksExpiry: true,
        stockQuantity: 20,
        sellableQuantity: 2,
      }),
    ).toBe(2);
  });

  it("treats on-hand as available when expiry is not tracked", () => {
    expect(
      availableStockQuantity({
        tracksExpiry: false,
        stockQuantity: 8,
        sellableQuantity: 8,
      }),
    ).toBe(8);
  });

  it("flags low stock at or below the threshold", () => {
    expect(isBelowLowStockThreshold(4, 10)).toBe(true);
    expect(isBelowLowStockThreshold(10, 10)).toBe(true);
    expect(isBelowLowStockThreshold(11, 10)).toBe(false);
  });

  it("flags All-branches as low when any location is short", () => {
    expect(
      isLowStockAtAnyBranch(
        5,
        false,
        [
          { quantity: 40, sellableQuantity: 40 },
          { quantity: 2, sellableQuantity: 2 },
        ],
        { stockQuantity: 42, sellableQuantity: 42 },
      ),
    ).toBe(true);
  });

  it("does not flag All-branches as low when every location is healthy", () => {
    expect(
      isLowStockAtAnyBranch(
        5,
        false,
        [
          { quantity: 12, sellableQuantity: 12 },
          { quantity: 8, sellableQuantity: 8 },
        ],
        { stockQuantity: 20, sellableQuantity: 20 },
      ),
    ).toBe(false);
  });
});
