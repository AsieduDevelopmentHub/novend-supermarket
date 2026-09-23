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
    expect(view.explanation).toMatch(/did not finish on the server/i);
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
    expect(view.explanation).toMatch(/not a permanent rejection/i);
  });
});
