import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assertLocalWriteAllowed: vi.fn<() => Promise<void>>(),
  getOfflineDb: vi.fn(),
}));

vi.mock("@/lib/offline/license-guard", () => ({
  assertLocalWriteAllowed: mocks.assertLocalWriteAllowed,
  assertLocalCapacity: vi.fn(),
}));

vi.mock("@/lib/offline/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/offline/db")>();
  return { ...actual, getOfflineDb: mocks.getOfflineDb };
});

import { completeSaleLocally, holdSaleLocally } from "@/lib/offline/sales-repository";
import { processReturnLocally } from "@/lib/offline/returns-repository";
import {
  persistBusinessWrite,
  queueCreateUser,
  queueUpsertBranch,
  queueUpsertProduct,
} from "@/lib/offline/replica-writes";

const RECOVERY_ERROR = "Licence recovery is required. Reconnect to restore access.";

describe("local repository licence authority", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.assertLocalWriteAllowed.mockRejectedValue(new Error(RECOVERY_ERROR));
  });

  it("does not create a sale result or printable receipt when authority fails", async () => {
    await expect(
      completeSaleLocally({
        items: [],
        discount: 0,
        paymentMethod: "cash",
      }),
    ).rejects.toThrow(RECOVERY_ERROR);
    expect(mocks.getOfflineDb).not.toHaveBeenCalled();
  });

  it("does not create a return receipt when authority fails", async () => {
    await expect(
      processReturnLocally({
        saleId: "sale_1",
        invoiceNumber: "INV-1",
        saleTotal: 10,
        saleSubtotal: 10,
        saleDiscount: 0,
        alreadyRefunded: 0,
        remainingQty: 1,
        reason: "damaged",
        items: [],
      }),
    ).rejects.toThrow(RECOVERY_ERROR);
    expect(mocks.getOfflineDb).not.toHaveBeenCalled();
  });

  it("blocks held sales and generic business writes before local mutation", async () => {
    const local = vi.fn();
    await expect(
      holdSaleLocally({
        cashierId: "user_1",
        items: [],
        discount: 0,
      }),
    ).rejects.toThrow(RECOVERY_ERROR);
    await expect(
      persistBusinessWrite({
        online: false,
        remote: async () => undefined,
        local,
      }),
    ).rejects.toThrow(RECOVERY_ERROR);
    expect(local).not.toHaveBeenCalled();
  });

  it.each([
    [
      "product",
      () =>
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
        }),
    ],
    [
      "user",
      () =>
        queueCreateUser({
          name: "Cashier",
          email: "cashier@example.com",
          password: "StrongPassword123!",
          role: "cashier",
          branchId: "branch_1",
        }),
    ],
    [
      "branch",
      () =>
        queueUpsertBranch({
          name: "Main",
          code: "MAIN",
        }),
    ],
  ])("blocks local %s repository writes", async (_resource, write) => {
    await expect(write()).rejects.toThrow(RECOVERY_ERROR);
    expect(mocks.getOfflineDb).not.toHaveBeenCalled();
  });
});
