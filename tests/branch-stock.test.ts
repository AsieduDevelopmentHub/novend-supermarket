import { describe, expect, it } from "vitest";
import {
  branchStockId,
  catalogSellableQuantity,
  sellableFromBranchStock,
  sellableQuantityForBranch,
  stockFieldsFromAggregate,
} from "@/lib/offline/branch-stock";
import type { MirroredBranchStock, MirroredProduct } from "@/lib/offline/types";

describe("branch stock mirror", () => {
  it("builds stable branch stock ids", () => {
    expect(branchStockId("branch_a", "prod_1")).toBe("branch_a:prod_1");
  });

  it("heals zero branch rows from catalog qty on the profile branch", () => {
    const product = {
      tracksExpiry: false,
      stockQuantity: 12,
      sellableQuantity: 12,
    } as MirroredProduct;
    const stock = {
      id: "main:p",
      branchId: "main",
      productId: "p",
      quantity: 0,
      sellableQuantity: 0,
      updatedAt: 0,
    } satisfies MirroredBranchStock;
    expect(
      sellableQuantityForBranch({
        stock,
        product,
        branchId: "main",
        profileBranchId: "main",
      }),
    ).toBe(12);
    expect(
      sellableQuantityForBranch({
        stock,
        product,
        branchId: "other",
        profileBranchId: "main",
      }),
    ).toBe(0);
  });

  it("uses sellable quantity for expiry-tracked products", () => {
    const product = {
      tracksExpiry: true,
      stockQuantity: 10,
      sellableQuantity: 4,
    } as MirroredProduct;
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

  it("treats physical on-hand as sellable for non-dated products", () => {
    const product = {
      tracksExpiry: false,
      stockQuantity: 7,
      sellableQuantity: 7,
    } as MirroredProduct;
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

  it("does not let a stale sellableQuantity of 0 hide positive on-hand", () => {
    const product = {
      tracksExpiry: false,
      stockQuantity: 2,
      sellableQuantity: 0,
    } as MirroredProduct;
    const stock = {
      id: "main:p",
      branchId: "main",
      productId: "p",
      quantity: 2,
      sellableQuantity: 0,
      updatedAt: 0,
    } satisfies MirroredBranchStock;

    expect(sellableFromBranchStock(stock, product)).toBe(2);
    expect(catalogSellableQuantity(product)).toBe(2);
    expect(
      sellableQuantityForBranch({
        stock,
        product,
        branchId: "main",
        profileBranchId: "main",
      }),
    ).toBe(2);
    expect(stockFieldsFromAggregate(product, stock, false)).toMatchObject({
      stockQuantity: 2,
      sellableQuantity: 2,
    });
  });

  it("keeps expired dated stock unsellable even when on-hand remains", () => {
    const product = {
      tracksExpiry: true,
      stockQuantity: 2,
      sellableQuantity: 0,
    } as MirroredProduct;
    const stock = {
      id: "main:p",
      branchId: "main",
      productId: "p",
      quantity: 2,
      sellableQuantity: 0,
      updatedAt: 0,
    } satisfies MirroredBranchStock;
    expect(sellableFromBranchStock(stock, product)).toBe(0);
    expect(
      sellableQuantityForBranch({
        stock,
        product,
        branchId: "main",
        profileBranchId: "main",
      }),
    ).toBe(0);
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
