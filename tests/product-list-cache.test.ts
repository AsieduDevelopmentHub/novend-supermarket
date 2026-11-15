import { afterEach, describe, expect, it } from "vitest";
import {
  clearProductListCache,
  getCachedListProducts,
  getCachedListProductsByBarcode,
  getCachedProductListIndex,
  lotsForProduct,
  branchStockRowsForProduct,
} from "@/lib/offline/product-list-cache";
import { bumpReplicaWriteEpoch, notifyReplicaChanged } from "@/lib/offline/replica-events";

function memoryListDb(args: {
  products: Array<{
    id: string;
    status: string;
    name?: string;
    sku: string;
    barcode?: string | null;
    sellUnits?: Array<{ key: string; barcode?: string; active?: boolean }> | null;
  }>;
  lots?: Array<{
    id: string;
    productId: string;
    branchId: string;
    quantity: number;
    expiryDate?: string;
    lotCode?: string;
    receivedAt?: number;
  }>;
  branchStock?: Array<{
    id: string;
    productId: string;
    branchId: string;
    quantity: number;
    sellableQuantity: number;
  }>;
  branches?: Array<{ id: string; name: string }>;
}) {
  return {
    products: {
      toArray: async () => args.products,
      get: async (id: string) => args.products.find((row) => row.id === id),
    },
    lots: {
      toArray: async () => args.lots ?? [],
    },
    branchStock: {
      toArray: async () => args.branchStock ?? [],
      where: (field: string) => ({
        equals: (value: unknown) => ({
          toArray: async () =>
            (args.branchStock ?? []).filter(
              (row) => (row as Record<string, unknown>)[field] === value,
            ),
        }),
      }),
    },
    branches: {
      toArray: async () => args.branches ?? [],
    },
  };
}

describe("product list warm cache", () => {
  afterEach(() => {
    clearProductListCache();
  });

  it("indexes barcodes and SKUs for O(1) admin list lookup", async () => {
    const db = memoryListDb({
      products: [
        {
          id: "p1",
          status: "active",
          name: "Water",
          sku: "WATER",
          barcode: "111",
          sellUnits: [{ key: "pack", barcode: "999888", active: true }],
        },
        {
          id: "p2",
          status: "inactive",
          name: "Soap",
          sku: "SOAP",
          barcode: "222",
        },
        {
          id: "p3",
          status: "archived",
          name: "Gone",
          sku: "GONE",
          barcode: "333",
        },
      ],
    }) as never;

    const active = await getCachedListProducts(db, false);
    expect(active.map((p) => p.id)).toEqual(["p1"]);

    const nonArchived = await getCachedListProducts(db, true);
    expect(nonArchived.map((p) => p.id).sort()).toEqual(["p1", "p2"]);

    const packHits = await getCachedListProductsByBarcode(db, "999888");
    expect(packHits.map((p) => p.id)).toEqual(["p1"]);

    const inactiveSku = await getCachedListProductsByBarcode(db, "soap");
    expect(inactiveSku.map((p) => p.id)).toEqual(["p2"]);
  });

  it("indexes lots and branch stock by product for Map joins", async () => {
    const db = memoryListDb({
      products: [{ id: "p1", status: "active", name: "Milk", sku: "MILK", barcode: "1" }],
      lots: [
        {
          id: "l1",
          productId: "p1",
          branchId: "b1",
          quantity: 4,
          expiryDate: "2099-01-01",
          lotCode: "A",
          receivedAt: 1,
        },
        {
          id: "l2",
          productId: "p1",
          branchId: "b2",
          quantity: 0,
          expiryDate: "2099-01-01",
          lotCode: "B",
          receivedAt: 1,
        },
        {
          id: "l3",
          productId: "p2",
          branchId: "b1",
          quantity: 9,
          expiryDate: "2099-01-01",
          lotCode: "C",
          receivedAt: 1,
        },
      ],
      branchStock: [
        { id: "b1:p1", productId: "p1", branchId: "b1", quantity: 4, sellableQuantity: 4 },
        { id: "b2:p1", productId: "p1", branchId: "b2", quantity: 1, sellableQuantity: 1 },
      ],
      branches: [
        { id: "b1", name: "Main" },
        { id: "b2", name: "Side" },
      ],
    }) as never;

    const index = await getCachedProductListIndex(db);
    expect(lotsForProduct(index, "p1", null)).toHaveLength(1);
    expect(lotsForProduct(index, "p1", "b1").map((l) => l.id)).toEqual(["l1"]);
    expect(lotsForProduct(index, "p1", "b2")).toHaveLength(0);
    expect(branchStockRowsForProduct(index, "p1")).toHaveLength(2);
  });

  it("warms once until replica write epoch bumps", async () => {
    let reads = 0;
    const db = {
      products: {
        toArray: async () => {
          reads += 1;
          return [{ id: "p1", status: "active", name: "A", sku: "A", barcode: "1" }];
        },
      },
      lots: { toArray: async () => [] },
      branchStock: { toArray: async () => [] },
      branches: { toArray: async () => [] },
    } as never;

    await getCachedListProducts(db, false);
    await getCachedListProducts(db, false);
    expect(reads).toBe(1);

    notifyReplicaChanged({ silent: true, imagesOnly: true });
    await getCachedListProducts(db, false);
    expect(reads).toBe(1);

    bumpReplicaWriteEpoch();
    await getCachedListProducts(db, false);
    expect(reads).toBe(2);
  });
});
