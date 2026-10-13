import { describe, expect, it } from "vitest";
import {
  agingBucketForAge,
  assertCreditLimit,
  assertPaymentWithinBalance,
  checkCreditLimit,
  creditRefundAmount,
  customerBalance,
  summarizeAging,
} from "@/convex/shared/customerCredit";
import {
  overlayPendingCustomerBalances,
  pendingBalanceDeltas,
} from "@/lib/offline/customer-credit";
import type { MirroredCustomer, OutboxRow, OutboxStatus } from "@/lib/offline/types";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 12);

describe("customer balance and credit limit", () => {
  it("sums signed ledger effects (charges up, payments down)", () => {
    expect(customerBalance([{ amount: 100 }, { amount: -40 }, { amount: 15.5 }])).toBe(75.5);
    expect(customerBalance([])).toBe(0);
  });

  it("allows a charge up to the limit and blocks beyond it", () => {
    expect(checkCreditLimit({ currentBalance: 400, charge: 100, limit: 500 })).toEqual({
      ok: true,
      balanceAfter: 500,
    });
    const over = checkCreditLimit({ currentBalance: 400, charge: 100.01, limit: 500 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.message).toMatch(/credit limit exceeded/i);
    expect(() => assertCreditLimit({ currentBalance: 0, charge: 1, limit: 0 })).toThrow(
      /credit limit exceeded/i,
    );
  });

  it("treats a missing limit as unlimited and a zero limit as no credit", () => {
    expect(checkCreditLimit({ currentBalance: 9_000, charge: 5_000, limit: null }).ok).toBe(true);
    expect(checkCreditLimit({ currentBalance: 0, charge: 5_000, limit: undefined }).ok).toBe(true);
    expect(checkCreditLimit({ currentBalance: 0, charge: 0.01, limit: 0 }).ok).toBe(false);
  });

  it("rejects a payment larger than the balance or non-positive", () => {
    expect(() => assertPaymentWithinBalance(100, 100)).not.toThrow();
    expect(() => assertPaymentWithinBalance(100, 100.5)).toThrow(/more than this customer owes/i);
    expect(() => assertPaymentWithinBalance(100, 0)).toThrow(/valid amount/i);
    expect(() => assertPaymentWithinBalance(100, Number.NaN)).toThrow(/valid amount/i);
  });
});

describe("receivable aging", () => {
  it("buckets by age with the boundaries at 30 and 60 days", () => {
    expect(agingBucketForAge(0)).toBe("current");
    expect(agingBucketForAge(30)).toBe("current");
    expect(agingBucketForAge(31)).toBe("days31to60");
    expect(agingBucketForAge(60)).toBe("days31to60");
    expect(agingBucketForAge(61)).toBe("days61plus");
  });

  it("settles the oldest charges first (FIFO) with payments", () => {
    const aging = summarizeAging(
      [
        { type: "sale_charge", amount: 100, occurredAt: NOW - 70 * DAY },
        { type: "sale_charge", amount: 200, occurredAt: NOW - 40 * DAY },
        { type: "sale_charge", amount: 50, occurredAt: NOW - 5 * DAY },
        { type: "payment", amount: -130, occurredAt: NOW - 2 * DAY },
      ],
      NOW,
    );
    // 130 clears the 100 (61+) and 30 of the 200 (31-60).
    expect(aging).toEqual({ current: 50, days31to60: 170, days61plus: 0, total: 220 });
  });

  it("is empty when everything is paid", () => {
    expect(
      summarizeAging(
        [
          { type: "sale_charge", amount: 80, occurredAt: NOW - 90 * DAY },
          { type: "payment", amount: -80, occurredAt: NOW - DAY },
        ],
        NOW,
      ).total,
    ).toBe(0);
  });
});

describe("creditRefundAmount", () => {
  it("refunds the on-account share pro rata and never beyond what was charged", () => {
    expect(
      creditRefundAmount({
        saleTotal: 100,
        onAccountCharged: 60,
        alreadyCredited: 0,
        refundAmount: 50,
      }),
    ).toBe(30);
    expect(
      creditRefundAmount({
        saleTotal: 100,
        onAccountCharged: 60,
        alreadyCredited: 50,
        refundAmount: 100,
      }),
    ).toBe(10);
    expect(
      creditRefundAmount({
        saleTotal: 100,
        onAccountCharged: 0,
        alreadyCredited: 0,
        refundAmount: 100,
      }),
    ).toBe(0);
  });
});

function outboxRow(
  type: OutboxRow["type"],
  payload: unknown,
  status: OutboxStatus = "pending",
): OutboxRow {
  return {
    id: `row_${Math.random()}`,
    type,
    clientOperationId: "op",
    payloadJson: JSON.stringify(payload),
    status,
    attempts: 0,
    createdAt: 1,
    updatedAt: 1,
  };
}

const customer = (id: string, balance: number): MirroredCustomer => ({
  id,
  name: id,
  phone: null,
  email: null,
  status: "active",
  purchaseCount: 0,
  lastPurchaseAt: null,
  lastPurchaseTotal: null,
  lastInvoiceNumber: null,
  balance,
  updatedAt: 1,
});

describe("offline balance overlay", () => {
  it("adds queued on-account sales and subtracts queued payments", () => {
    const rows = [
      outboxRow("complete_sale", {
        customerId: "c1",
        payments: [
          { method: "cash", amount: 20 },
          { method: "on_account", amount: 80 },
        ],
      }),
      outboxRow("record_customer_payment", { customerId: "c1", amount: 30 }),
      outboxRow("complete_sale", { customerId: "c2", payments: [{ method: "cash", amount: 50 }] }),
    ];
    expect(pendingBalanceDeltas(rows).get("c1")).toBe(50);
    expect(pendingBalanceDeltas(rows).has("c2")).toBe(false);
    const overlaid = overlayPendingCustomerBalances(
      [customer("c1", 100), customer("c2", 10)],
      rows,
    );
    expect(overlaid.map((row) => row.balance)).toEqual([150, 10]);
  });

  it("ignores failed and already-synced rows so a rolled-back sale is not double counted", () => {
    const payload = { customerId: "c1", payments: [{ method: "on_account", amount: 80 }] };
    const rows = [
      outboxRow("complete_sale", payload, "failed"),
      outboxRow("complete_sale", payload, "synced"),
    ];
    expect(pendingBalanceDeltas(rows).size).toBe(0);
  });

  it("counts a syncing sale until the server confirms it", () => {
    const rows = [
      outboxRow(
        "complete_sale",
        { customerId: "c1", payments: [{ method: "on_account", amount: 40 }] },
        "syncing",
      ),
    ];
    expect(pendingBalanceDeltas(rows).get("c1")).toBe(40);
  });
});
