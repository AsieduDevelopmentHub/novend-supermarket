import { describe, expect, it } from "vitest";
import {
  describeReturnUploadBlock,
  mapReturnLinesToServerSaleItems,
} from "@/lib/offline/returns-repository";
import { syncFailureMessage } from "@/lib/offline/sync-errors";

describe("mapReturnLinesToServerSaleItems", () => {
  const localItems = [
    { id: "litem_a", productId: "prod_rice", quantity: 4 },
    { id: "litem_b", productId: "prod_oil", quantity: 1 },
    { id: "litem_c", productId: "prod_rice", quantity: 2 },
  ];
  const serverItems = [
    { id: "sitem_a", productId: "prod_rice", quantity: 4 },
    { id: "sitem_b", productId: "prod_oil", quantity: 1 },
    { id: "sitem_c", productId: "prod_rice", quantity: 2 },
  ];

  it("maps a device sale line onto the matching server line", () => {
    const mapped = mapReturnLinesToServerSaleItems(
      [
        {
          saleItemId: "litem_c",
          quantity: 1,
          productId: "prod_rice",
          soldQuantity: 2,
        },
      ],
      localItems,
      serverItems,
    );
    expect(mapped).toEqual([{ saleItemId: "sitem_c", quantity: 1 }]);
  });

  it("uses the local sale item when the outbox line has no product id", () => {
    const mapped = mapReturnLinesToServerSaleItems(
      [{ saleItemId: "litem_b", quantity: 1 }],
      localItems,
      serverItems,
    );
    expect(mapped).toEqual([{ saleItemId: "sitem_b", quantity: 1 }]);
  });

  it("does not upload a return until the device sale has a server id", () => {
    expect(
      describeReturnUploadBlock({
        saleId: "lsale_1",
        serverSaleId: null,
        saleUpload: { status: "pending", lastError: null },
      }),
    ).toBe("Waiting for the sale to finish syncing.");
    expect(
      describeReturnUploadBlock({
        saleId: "lsale_1",
        serverSaleId: "sale_server",
        saleUpload: { status: "synced" },
      }),
    ).toBeNull();
  });

  it("tells the cashier when the sale upload itself failed", () => {
    expect(
      describeReturnUploadBlock({
        saleId: "lsale_1",
        saleUpload: { status: "failed", lastError: "Not enough stock for Rice. Available: 0." },
      }),
    ).toContain("Not enough stock for Rice");
  });

  it("keeps a usable server reason instead of Sync failed", () => {
    const error = new Error(
      "[CONVEX M(sales:completeSale)] [Request ID: abc] Server Error\nUncaught Error: This invoice number is already used\n    at handler (convex/sales.ts:1:1)",
    );
    expect(syncFailureMessage(error, "Sync failed")).toContain("already used");
  });

  it("reads a ConvexError data message instead of Sync failed", () => {
    const error = new Error("[CONVEX M(inventory:adjustStock)] Server Error");
    (error as Error & { data: string }).data = "Inventory cannot become negative";
    expect(syncFailureMessage(error, "Sync failed")).toBe("Inventory cannot become negative");
  });

  it("drops a Convex wrapper when the server sent no business sentence", () => {
    const error = new Error("[CONVEX M(inventory:adjustStock)] [Request ID: req_9] Server Error");
    expect(syncFailureMessage(error, "Sync failed")).toBe("Sync failed");
  });

  it("returns null when a line cannot be matched", () => {
    expect(
      mapReturnLinesToServerSaleItems(
        [{ saleItemId: "missing", quantity: 1, productId: "prod_gone", soldQuantity: 1 }],
        localItems,
        serverItems,
      ),
    ).toBeNull();
  });
});
