import { describe, expect, it, vi } from "vitest";
import {
  applyLocalBranchStockChange,
  branchStockId,
  sellableQuantityForBranch,
  syncCatalogStockFromBranch,
} from "@/lib/offline/branch-stock";
import type { MirroredBranchStock, MirroredProduct } from "@/lib/offline/types";

vi.mock("@/constants/runtime", () => ({
  FULLY_OFFLINE: true,
  MILLIES_LOCAL_BRANCH_ID: "millies-main",
  MILLIES_LOCAL_ORG_ID: "millies-local",
  MILLIES_LOCAL_BRANCH_NAME: "Main Store",
}));

vi.mock("@/lib/offline/db", async () => {
  const actual = await vi.importActual<typeof import("@/lib/offline/db")>("@/lib/offline/db");
  return {
    ...actual,
    getMeta: async () => "millies-main",
    META_KEYS: actual.META_KEYS,
  };
});

function memoryDb(seed: {
  product: MirroredProduct;
  stock?: MirroredBranchStock;
}) {
  let product = { ...seed.product };
  let stock = seed.stock ? { ...seed.stock } : undefined;
  return {
    products: {
      get: async (id: string) => (product.id === id ? product : undefined),
      put: async (row: MirroredProduct) => {
        product = { ...row };
      },
    },
    branchStock: {
      get: async (id: string) => (stock?.id === id ? stock : undefined),
      put: async (row: MirroredBranchStock) => {
        stock = { ...row };
      },
    },
    snapshot: () => ({ product, stock }),
  };
}

describe("adjust stock sync (Millie's)", () => {
  it("receive +5 on branch 10 yields branch 15 and catalog 15 (not 20)", async () => {
    const product = {
      id: "p1",
      name: "Water",
      sku: "W",
      categoryId: "c",
      categoryName: "Drinks",
      sellingPrice: 1,
      costPrice: 0.5,
      stockQuantity: 10,
      sellableQuantity: 10,
      unit: "pcs",
      lowStockThreshold: 2,
      status: "active",
      imageUrl: null,
      tracksExpiry: false,
      updatedAt: 1,
    } satisfies MirroredProduct;
    const branchId = "millies-main";
    const stock = {
      id: branchStockId(branchId, product.id),
      branchId,
      productId: product.id,
      quantity: 10,
      sellableQuantity: 10,
      updatedAt: 1,
    } satisfies MirroredBranchStock;
    const db = memoryDb({ product, stock });

    await applyLocalBranchStockChange(db as never, branchId, product.id, 5, product);
    await syncCatalogStockFromBranch(db as never, branchId, product.id);

    const snap = db.snapshot();
    expect(snap.stock?.quantity).toBe(15);
    expect(snap.stock?.sellableQuantity).toBe(15);
    expect(snap.product.stockQuantity).toBe(15);
    expect(snap.product.sellableQuantity).toBe(15);
  });

  it("stale branch 0 + catalog 12 heals for Pay when profile matches Millie's branch", () => {
    const product = {
      tracksExpiry: false,
      stockQuantity: 12,
      sellableQuantity: 12,
    } as MirroredProduct;
    const stock = {
      id: "millies-main:p",
      branchId: "millies-main",
      productId: "p",
      quantity: 0,
      sellableQuantity: 0,
      updatedAt: 0,
    } satisfies MirroredBranchStock;
    expect(
      sellableQuantityForBranch({
        stock,
        product,
        branchId: "millies-main",
        profileBranchId: "millies-main",
      }),
    ).toBe(12);
  });
});
