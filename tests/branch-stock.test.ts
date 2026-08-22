import { describe, expect, it } from "vitest";
import { branchStockId, sellableFromBranchStock, stockFieldsFromAggregate } from "@/lib/offline/branch-stock";
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

  it("aggregates org-wide stock from branch rows", () => {
    const product = {
      tracksExpiry: false,
      stockQuantity: 0,
      sellableQuantity: 0,
      lowStockThreshold: 2,
    } as MirroredProduct;
    const fields = stockFieldsFromAggregate(
      product,
      { quantity: 5, sellableQuantity: 5, isExpiring: false },
      false,
    );
    expect(fields.stockQuantity).toBe(5);
  });

  it("uses legacy product quantities when profile branch has no branchStock row", () => {
    const product = {
      tracksExpiry: false,
      stockQuantity: 12,
      sellableQuantity: 12,
      lowStockThreshold: 2,
    } as MirroredProduct;
    const fields = stockFieldsFromAggregate(product, undefined, true);
    expect(fields.stockQuantity).toBe(12);
  });
});
