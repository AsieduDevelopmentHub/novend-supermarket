import { describe, expect, it } from "vitest";
import { describeOutboxEvent, outboxFixPath, outboxOpLabel } from "@/lib/offline/outbox-labels";
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
