import { describe, expect, it } from "vitest";
import {
  describeOutboxConflict,
  describeOutboxEvent,
  outboxFixPath,
  outboxOpLabel,
} from "@/lib/offline/outbox-labels";
import type { OutboxRow } from "@/lib/offline/types";

function row(partial: Partial<OutboxRow> & Pick<OutboxRow, "type" | "payloadJson">): OutboxRow {
  return {
    id: "outbox_1",
    clientOperationId: "op_1",
    status: "pending",
    attempts: 1,
    createdAt: 1,
    updatedAt: 1,
    ...partial,
  };
}

describe("describeOutboxEvent", () => {
  it("labels a sale with invoice, customer, and payment", () => {
    const copy = describeOutboxEvent(
      row({
        type: "complete_sale",
        payloadJson: JSON.stringify({
          invoiceNumber: "INV-AABBCCDDEEFF0011",
          customerName: "Ama",
          paymentMethod: "mobile_money",
        }),
      }),
    );
    expect(copy.title).toBe("Sale");
    expect(copy.detail).toMatch(/INV-AABBCCDDEEFF0011/);
    expect(copy.detail).toMatch(/Ama/);
    expect(copy.detail).toMatch(/mobile money/);
  });

  it("falls back for unknown types", () => {
    expect(outboxOpLabel("not_a_real_op")).toBe("Sync event");
  });

  it("labels a stock adjustment with product, quantity, and reason", () => {
    const copy = describeOutboxEvent(
      row({
        type: "adjust_stock",
        payloadJson: JSON.stringify({
          productName: "Rice 5kg",
          quantityChange: -2,
          reason: "damage",
          note: "Broken bag",
        }),
      }),
    );
    expect(copy.title).toBe("Stock adjustment");
    expect(copy.detail).toBe("Rice 5kg · -2 · Damage · Broken bag");
  });

  it("labels a branch", () => {
    expect(outboxOpLabel("upsert_branch")).toBe("Branch");
  });

  it("links a product outbox row to the product screen", () => {
    expect(
      outboxFixPath(
        row({
          type: "upsert_product",
          payloadJson: JSON.stringify({ localId: "local_abc", name: "Juice" }),
        }),
      ),
    ).toBe("/products/local_abc");
  });
});

describe("describeOutboxConflict", () => {
  it("explains a stock-rejected sale without calling it a generic tech error", () => {
    const view = describeOutboxConflict(
      row({
        type: "complete_sale",
        status: "failed",
        lastError: "Insufficient stock for Water 500ml",
        payloadJson: JSON.stringify({
          invoiceNumber: "INV-STOCK01",
          customerName: "Kofi",
          productName: "Water 500ml",
          quantity: 12,
          availableQuantity: 3,
        }),
      }),
    );
    expect(view.kind).toBe("business");
    expect(view.permanent).toBe(true);
    expect(view.headline).toMatch(/not enough stock/i);
    expect(view.explanation).toMatch(/INV-STOCK01/);
    expect(view.explanation).toMatch(/post the receipt/i);
    expect(view.canPostShortage).toBe(true);
    expect(view.explanation).not.toMatch(/something went wrong/i);
  });

  it("marks connectivity failures as retryable network conflicts", () => {
    const view = describeOutboxConflict(
      row({
        type: "complete_sale",
        status: "failed",
        lastError: "Failed to fetch",
        payloadJson: JSON.stringify({ invoiceNumber: "INV-NET01" }),
      }),
    );
    expect(view.kind).toBe("network");
    expect(view.permanent).toBe(false);
    expect(view.explanation).toMatch(/Failed to fetch/);
    expect(view.explanation).toMatch(/not a product conflict/i);
  });

  it("shows a stock rejection without the Convex wrapper", () => {
    const view = describeOutboxConflict(
      row({
        type: "complete_sale",
        status: "failed",
        lastError:
          "[CONVEX M(sales:completeSale)] [Request ID: 09643f3a123d1a6e] Server Error\nUncaught Error: Not enough stock for Mahama Ibrahim. Available: 0. Another till sold these units before this sale uploaded.\n    at handler (../convex/sales.ts:578:16)",
        payloadJson: JSON.stringify({ invoiceNumber: "INV-5DA017981D8B44B4" }),
      }),
    );
    expect(view.headline).toBe("Not enough stock");
    expect(view.explanation).toMatch(/Mahama Ibrahim/);
    expect(view.explanation).not.toMatch(/CONVEX|Request ID|at handler/i);
    expect(view.canPostShortage).toBe(true);
  });

  it("shows the Convex dump when the upload failed without a business reason", () => {
    const view = describeOutboxConflict(
      row({
        type: "adjust_stock",
        status: "pending",
        lastError: "[CONVEX M(inventory:adjustStock)] [Request ID: req_123] Server Error",
        payloadJson: JSON.stringify({
          productName: "Rice 5kg",
          quantityChange: 4,
          reason: "receive",
        }),
      }),
    );
    expect(view.headline).toBe("Upload failed");
    expect(view.explanation).toMatch(/Request ID: req_123/);
    expect(view.explanation).toMatch(/Rice 5kg/);
    expect(view.permanent).toBe(false);
  });
});
