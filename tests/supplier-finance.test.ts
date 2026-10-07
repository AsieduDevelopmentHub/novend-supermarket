import { describe, expect, it } from "vitest";
import {
  allocateSupplierPayment,
  applySupplierPayment,
  purchaseBalance,
  purchasePaymentStatus,
  resolveDeliveryAmountPaid,
  settledAmount,
} from "@/convex/shared/supplierFinance";

describe("supplier finance", () => {
  it("treats a delivery recorded before balances as paid", () => {
    const legacy = { id: "old", purchasedAt: 1, totalCost: 80, status: "completed" as const };
    expect(settledAmount(legacy)).toBe(80);
    expect(purchaseBalance(legacy)).toBe(0);
    expect(purchasePaymentStatus(legacy)).toBe("paid");
    expect(allocateSupplierPayment([legacy], 10).allocations).toEqual([]);
    expect(allocateSupplierPayment([legacy], 10).unapplied).toBe(10);
  });

  it("keeps an explicit zero as still owed", () => {
    const credit = { id: "new", purchasedAt: 2, totalCost: 50, amountPaid: 0, status: "completed" };
    expect(purchaseBalance(credit)).toBe(50);
    expect(purchasePaymentStatus(credit)).toBe("owed");
  });

  it("marks a partial payment and rejects an overpayment on one delivery", () => {
    const row = { id: "p", purchasedAt: 3, totalCost: 40, amountPaid: 15, status: "completed" };
    expect(purchasePaymentStatus(row)).toBe("partial");
    expect(purchaseBalance(row)).toBe(25);
    expect(allocateSupplierPayment([row], 25, "p").allocations).toEqual([{ id: "p", applied: 25 }]);
    expect(allocateSupplierPayment([row], 26, "p").unapplied).toBe(26);
  });

  it("applies a supplier payment to the oldest open delivery first", () => {
    const rows = [
      { id: "later", purchasedAt: 20, totalCost: 30, amountPaid: 0, status: "completed" },
      { id: "older", purchasedAt: 10, totalCost: 20, amountPaid: 0, status: "completed" },
      { id: "legacy", purchasedAt: 5, totalCost: 100, status: "completed" },
    ];
    const applied = applySupplierPayment(rows, 25);
    expect(applied.unapplied).toBe(0);
    const older = applied.purchases.find((row) => row.id === "older");
    const later = applied.purchases.find((row) => row.id === "later");
    const legacy = applied.purchases.find((row) => row.id === "legacy");
    expect(older?.amountPaid).toBe(20);
    expect(later?.amountPaid).toBe(5);
    expect(legacy?.amountPaid).toBeUndefined();
  });

  it("resolves what was paid when the delivery was recorded", () => {
    expect(resolveDeliveryAmountPaid(48, "paid")).toBe(48);
    expect(resolveDeliveryAmountPaid(48, "owed")).toBe(0);
    expect(resolveDeliveryAmountPaid(48, "partial", 12.5)).toBe(12.5);
    expect(() => resolveDeliveryAmountPaid(48, "partial", 0)).toThrow(/how much/i);
    expect(() => resolveDeliveryAmountPaid(48, "partial", 49)).toThrow(/exceed/i);
  });
});
