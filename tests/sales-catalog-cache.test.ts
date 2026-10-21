import { afterEach, describe, expect, it } from "vitest";
import {
  clearSalesCatalogCache,
  getCachedActiveCatalogProducts,
  getCachedProductsByBarcode,
} from "@/lib/offline/sales-catalog-cache";
import { bumpReplicaWriteEpoch, notifyReplicaChanged } from "@/lib/offline/replica-events";

function memoryProductsDb(
  rows: Array<{
    id: string;
    status: string;
    sku: string;
    barcode?: string | null;
    isVariantParent?: boolean;
    sellUnits?: Array<{ key: string; barcode?: string; active?: boolean }> | null;
  }>,
) {
  return {
    products: {
      where: (field: string) => ({
        equals: (value: unknown) => ({
          toArray: async () => rows.filter((row) => (row as Record<string, unknown>)[field] === value),
        }),
      }),
      get: async (id: string) => rows.find((row) => row.id === id),
    },
  };
}

describe("sales catalog warm cache", () => {
  afterEach(() => {
    clearSalesCatalogCache();
  });

  it("indexes sell-unit barcodes so pack scans skip a full active scan", async () => {
    const db = memoryProductsDb([
      {
        id: "p1",
        status: "active",
        sku: "WATER",
        barcode: "111",
        sellUnits: [{ key: "pack", barcode: "999888", active: true }],
      },
      {
        id: "p2",
        status: "active",
        sku: "SOAP",
        barcode: "222",
      },
    ]) as never;

    const active = await getCachedActiveCatalogProducts(db);
    expect(active).toHaveLength(2);

    const packHits = await getCachedProductsByBarcode(db, "999888");
    expect(packHits.map((p) => p.id)).toEqual(["p1"]);

    const skuHits = await getCachedProductsByBarcode(db, "soap");
    expect(skuHits.map((p) => p.id)).toEqual(["p2"]);
  });

  it("keeps warm catalog across image-only events; rebuilds after writes", async () => {
    let reads = 0;
    const db = {
      products: {
        where: () => ({
          equals: () => ({
            toArray: async () => {
              reads += 1;
              return [{ id: "p1", status: "active", sku: "A", barcode: "1" }];
            },
          }),
        }),
      },
    } as never;

    await getCachedActiveCatalogProducts(db);
    await getCachedActiveCatalogProducts(db);
    expect(reads).toBe(1);

    // Image puts use silent + imagesOnly — must not bump the write epoch.
    notifyReplicaChanged({ silent: true, imagesOnly: true });
    await getCachedActiveCatalogProducts(db);
    expect(reads).toBe(1);

    bumpReplicaWriteEpoch();
    await getCachedActiveCatalogProducts(db);
    expect(reads).toBe(2);
  });
});
