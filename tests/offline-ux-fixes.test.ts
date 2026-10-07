import { describe, expect, it } from "vitest";
import { withTimeout } from "@/lib/async/with-timeout";
import { overlayPendingBranchStock } from "@/lib/offline/replica-dedupe";

describe("withTimeout", () => {
  it("resolves when the promise settles in time", async () => {
    await expect(withTimeout(Promise.resolve(7), 100)).resolves.toBe(7);
  });

  it("rejects when the promise hangs past the budget", async () => {
    await expect(withTimeout(new Promise(() => undefined), 20, "timed out")).rejects.toThrow(
      "timed out",
    );
  });
});

describe("overlayPendingBranchStock adjust_stock", () => {
  it("applies pending stock adjustments onto snapshot rows", () => {
    const overlaid = overlayPendingBranchStock(
      [
        {
          branchId: "br_1",
          productId: "prod_1",
          quantity: 4,
          sellableQuantity: 4,
        },
      ],
      [
        {
          status: "pending",
          type: "adjust_stock",
          payloadJson: JSON.stringify({
            productId: "prod_1",
            branchId: "br_1",
            quantityChange: 6,
          }),
        },
      ],
    );
    expect(overlaid[0]?.quantity).toBe(10);
    expect(overlaid[0]?.sellableQuantity).toBe(10);
  });

  it("keeps unsynced sales deducted after a cloud refresh", () => {
    const overlaid = overlayPendingBranchStock(
      [
        {
          branchId: "br_1",
          productId: "prod_1",
          quantity: 10,
          sellableQuantity: 10,
        },
      ],
      [
        {
          status: "pending",
          type: "complete_sale",
          payloadJson: JSON.stringify({
            branchId: "br_1",
            items: [{ productId: "prod_1", quantity: 1, baseQuantity: 6 }],
          }),
        },
        {
          status: "failed",
          type: "complete_sale",
          payloadJson: JSON.stringify({
            branchId: "br_1",
            items: [{ productId: "prod_1", quantity: 2 }],
          }),
        },
        {
          status: "synced",
          type: "complete_sale",
          payloadJson: JSON.stringify({
            branchId: "br_1",
            items: [{ productId: "prod_1", baseQuantity: 9 }],
          }),
        },
        {
          status: "pending",
          type: "process_return",
          payloadJson: JSON.stringify({
            branchId: "br_1",
            items: [{ productId: "prod_1", quantity: 1 }],
          }),
        },
      ],
    );
    expect(overlaid[0]?.quantity).toBe(3);
    expect(overlaid[0]?.sellableQuantity).toBe(3);
  });
});
