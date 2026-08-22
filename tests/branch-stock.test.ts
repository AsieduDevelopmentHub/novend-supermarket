import { describe, expect, it } from "vitest";
import { branchStockId, sellableFromBranchStock } from "@/lib/offline/branch-stock";
import type { MirroredBranchStock, MirroredProduct } from "@/lib/offline/types";

describe("branch stock mirror", () => {
  it("builds stable branch stock ids", () => {
    expect(branchStockId("branch_a", "prod_1")).toBe("branch_a:prod_1");
  });

  it("uses sellable quantity for expiry-tracked products", () => {
    const product = { tracksExpiry: true, stockQuantity: 10, sellableQuantity: 4 } as MirroredProduct;
    const stock = {
      id: "b:p",
      branchId: "b",
      productId: "p",
      quantity: 10,
      sellableQuantity: 4,
      updatedAt: 0,
    } satisfies MirroredBranchStock;
    expect(sellableFromBranchStock(stock, product)).toBe(4);
  });

  it("falls back to branch quantity when sellable is absent", () => {
    const product = { tracksExpiry: false, stockQuantity: 7, sellableQuantity: 7 } as MirroredProduct;
    const stock = {
      id: "b:p",
      branchId: "b",
      productId: "p",
      quantity: 7,
      sellableQuantity: 7,
      updatedAt: 0,
    } satisfies MirroredBranchStock;
    expect(sellableFromBranchStock(stock, product)).toBe(7);
  });
});
