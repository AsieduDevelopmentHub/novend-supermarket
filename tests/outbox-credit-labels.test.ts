import { describe, expect, it } from "vitest";
import {
  classifyCreditConflict,
  describeOutboxConflict,
  describeOutboxEvent,
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

describe("classifyCreditConflict", () => {
  it("recognises the three credit rejections and ignores others", () => {
    expect(classifyCreditConflict("Credit limit exceeded. Balance would be GHS 900")).toBe(
      "credit_limit",
    );
    expect(classifyCreditConflict("Customer credit is not enabled for this workspace")).toBe(
      "credit_disabled",
    );
    expect(classifyCreditConflict("Choose a customer to sell on account")).toBe(
      "customer_required",
    );
    expect(classifyCreditConflict("Insufficient stock for Water")).toBeNull();
  });
});

describe("credit outbox copy", () => {
  it("labels the new credit and pricing operations", () => {
    expect(outboxOpLabel("record_customer_payment")).not.toBe("Sync event");
    expect(outboxOpLabel("upsert_customer_group")).not.toBe("Sync event");
    expect(outboxOpLabel("upsert_price_rule")).not.toBe("Sync event");
  });

  it("summarises split and on-account tenders on a queued sale", () => {
    const copy = describeOutboxEvent(
      row({
        type: "complete_sale",
        payloadJson: JSON.stringify({
          invoiceNumber: "INV-1",
          payments: [
            { method: "cash", amount: 20 },
            { method: "on_account", amount: 80 },
          ],
        }),
      }),
    );
    expect(copy.detail).toMatch(/cash/i);
    expect(copy.detail).toMatch(/on account/i);
  });

  it("describes a queued customer payment", () => {
    const copy = describeOutboxEvent(
      row({
        type: "record_customer_payment",
        payloadJson: JSON.stringify({ amount: 45, method: "mobile_money" }),
      }),
    );
    expect(copy.detail).toBe("GHS 45.00 · mobile money");
  });

  it.each([
    ["Credit limit exceeded. Balance would be 900", "Credit limit exceeded"],
    ["Customer credit is not enabled", "Customer credit is not enabled"],
    ["Choose a customer to sell on account", "Choose a customer to sell on account"],
  ])("shows %s as a permanent business conflict", (lastError, headline) => {
    const view = describeOutboxConflict(
      row({
        type: "complete_sale",
        status: "failed",
        lastError,
        payloadJson: JSON.stringify({ invoiceNumber: "INV-CR" }),
      }),
    );
    expect(view.kind).toBe("business");
    expect(view.permanent).toBe(true);
    expect(view.headline).toBe(headline);
  });
});
