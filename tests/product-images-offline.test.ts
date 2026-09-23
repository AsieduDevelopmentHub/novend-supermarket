import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRODUCT_IMAGES_DISABLED_MESSAGE } from "@/convex/shared/productImagesPolicy";

const mocks = vi.hoisted(() => ({
  assertLocalWriteAllowed: vi.fn<() => Promise<void>>(),
  assertLocalCapacity: vi.fn<() => Promise<void>>(),
  getOfflineDb: vi.fn(),
  loadProductImagesPolicyCache: vi.fn(),
  putProductImage: vi.fn(),
  deleteProductImage: vi.fn(),
  enqueueOutbox: vi.fn(),
}));

vi.mock("@/lib/offline/license-guard", () => ({
  assertLocalWriteAllowed: mocks.assertLocalWriteAllowed,
  assertLocalCapacity: mocks.assertLocalCapacity,
}));

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return { ...actual, getOfflineDb: mocks.getOfflineDb };
});

vi.mock("@/lib/offline/product-images-policy", () => ({
  loadProductImagesPolicyCache: mocks.loadProductImagesPolicyCache,
  saveProductImagesPolicyCache: vi.fn(),
}));

vi.mock("@/lib/offline/image-cache", () => ({
  putProductImage: mocks.putProductImage,
  deleteProductImage: mocks.deleteProductImage,
}));

vi.mock("@/lib/offline/outbox", () => ({
  enqueueOutbox: mocks.enqueueOutbox,
}));

import { queueUpsertProduct } from "@/lib/offline/replica-writes";

describe("queueUpsertProduct product image policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertLocalWriteAllowed.mockResolvedValue(undefined);
    mocks.assertLocalCapacity.mockResolvedValue(undefined);
    mocks.loadProductImagesPolicyCache.mockResolvedValue({ enabled: true });
    mocks.enqueueOutbox.mockResolvedValue(undefined);
    mocks.getOfflineDb.mockResolvedValue({
      products: {
        get: vi.fn().mockResolvedValue(undefined),
        put: vi.fn().mockResolvedValue(undefined),
        toArray: vi.fn().mockResolvedValue([]),
      },
      branchStock: { put: vi.fn().mockResolvedValue(undefined) },
      lots: { put: vi.fn().mockResolvedValue(undefined) },
      categories: { get: vi.fn().mockResolvedValue({ name: "General" }) },
    });
  });

  it("refuses attaching a new imageBlob when uploads are disabled", async () => {
    mocks.loadProductImagesPolicyCache.mockResolvedValue({ enabled: false });

    await expect(
      queueUpsertProduct({
        name: "Item",
        sku: "SKU-1",
        categoryId: "category_1",
        sellingPrice: 2,
        costPrice: 1,
        stockQuantity: 0,
        unit: "unit",
        lowStockThreshold: 1,
        status: "active",
        imageBlob: new Blob(["x"], { type: "image/jpeg" }),
      }),
    ).rejects.toThrow(PRODUCT_IMAGES_DISABLED_MESSAGE);

    expect(mocks.putProductImage).not.toHaveBeenCalled();
    expect(mocks.enqueueOutbox).not.toHaveBeenCalled();
  });

  it("allows product upsert without a new image when uploads are disabled", async () => {
    mocks.loadProductImagesPolicyCache.mockResolvedValue({ enabled: false });

    await queueUpsertProduct({
      name: "Item",
      sku: "SKU-1",
      categoryId: "category_1",
      sellingPrice: 2,
      costPrice: 1,
      stockQuantity: 0,
      unit: "unit",
      lowStockThreshold: 1,
      status: "active",
    });

    expect(mocks.putProductImage).not.toHaveBeenCalled();
    expect(mocks.enqueueOutbox).toHaveBeenCalled();
  });

  it("allows clearImage when uploads are disabled", async () => {
    mocks.loadProductImagesPolicyCache.mockResolvedValue({ enabled: false });
    mocks.getOfflineDb.mockResolvedValue({
      products: {
        get: vi.fn().mockResolvedValue({
          id: "prod_1",
          stockQuantity: 3,
          sellableQuantity: 3,
          imageUrl: "https://example.com/a.jpg",
        }),
        put: vi.fn().mockResolvedValue(undefined),
        toArray: vi.fn().mockResolvedValue([]),
      },
      branchStock: { put: vi.fn().mockResolvedValue(undefined) },
      lots: { put: vi.fn().mockResolvedValue(undefined) },
      categories: { get: vi.fn().mockResolvedValue({ name: "General" }) },
    });

    await queueUpsertProduct({
      serverId: "prod_1",
      name: "Item",
      sku: "SKU-1",
      categoryId: "category_1",
      sellingPrice: 2,
      costPrice: 1,
      stockQuantity: 0,
      unit: "unit",
      lowStockThreshold: 1,
      status: "active",
      clearImage: true,
    });

    expect(mocks.deleteProductImage).toHaveBeenCalledWith("prod_1");
    expect(mocks.putProductImage).not.toHaveBeenCalled();
    expect(mocks.enqueueOutbox).toHaveBeenCalled();
  });
});
