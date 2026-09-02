import { describe, expect, it } from "vitest";
import {
  applyPendingTransferDisplay,
  pendingOutboundForProduct,
  pendingTransferDisplayAdjustments,
  transferStockKey,
} from "@/lib/offline/pending-transfers";

describe("pending transfer stock display", () => {
  it("builds stable transfer keys", () => {
    expect(transferStockKey("branch_a", "prod_1")).toBe("branch_a:prod_1");
  });

  it("keeps source stock at the pre-transfer snapshot while syncing", () => {
    const displayed = applyPendingTransferDisplay(40, 40, {
      reserved: 10,
      maxSourceSnapshot: 50,
    });
    expect(displayed.stockQuantity).toBe(50);
    expect(displayed.sellableQuantity).toBe(50);
  });

  it("does not inflate stock before the server applies the transfer", () => {
    const displayed = applyPendingTransferDisplay(50, 50, {
      reserved: 10,
      maxSourceSnapshot: 50,
    });
    expect(displayed.stockQuantity).toBe(50);
    expect(displayed.sellableQuantity).toBe(50);
  });

  it("aggregates pending outbound quantities per source branch", async () => {
    const adjustments = await pendingTransferDisplayAdjustments({
      outbox: {
        toArray: async () => [
          {
            type: "transfer_stock",
            status: "pending",
            payloadJson: JSON.stringify({
              fromBranchId: "branch_a",
              toBranchId: "branch_b",
              productId: "prod_1",
              quantity: 4,
              sourceStockSnapshot: 20,
            }),
          },
          {
            type: "transfer_stock",
            status: "syncing",
            payloadJson: JSON.stringify({
              fromBranchId: "branch_a",
              toBranchId: "branch_c",
              productId: "prod_1",
              quantity: 6,
              sourceStockSnapshot: 20,
            }),
          },
          {
            type: "complete_sale",
            status: "pending",
            payloadJson: JSON.stringify({}),
          },
        ],
      },
    } as never);

    const key = transferStockKey("branch_a", "prod_1");
    expect(adjustments.get(key)).toEqual({ reserved: 10, maxSourceSnapshot: 20 });
    expect(pendingOutboundForProduct(new Map([[key, 10]]), "prod_1")).toBe(10);
  });
});
