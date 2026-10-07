import { roundMoney } from "./validation";

export type SupplierSettlement = "paid" | "partial" | "owed";

export type SupplierPurchaseBalanceInput = {
  id: string;
  purchasedAt: number;
  totalCost: number;
  /** Missing on deliveries recorded before balances existed. Those count as paid. */
  amountPaid?: number | null;
  status?: string;
};

export function settledAmount(purchase: { totalCost: number; amountPaid?: number | null }): number {
  if (typeof purchase.amountPaid === "number" && Number.isFinite(purchase.amountPaid)) {
    return roundMoney(purchase.amountPaid);
  }
  return roundMoney(purchase.totalCost);
}

export function purchaseBalance(purchase: {
  totalCost: number;
  amountPaid?: number | null;
}): number {
  return roundMoney(Math.max(0, purchase.totalCost - settledAmount(purchase)));
}

export function purchasePaymentStatus(purchase: {
  totalCost: number;
  amountPaid?: number | null;
}): "paid" | "partial" | "owed" {
  const paid = settledAmount(purchase);
  const balance = roundMoney(purchase.totalCost - paid);
  if (balance <= 0) return "paid";
  if (paid <= 0) return "owed";
  return "partial";
}

export function paymentStatusLabel(status: "paid" | "partial" | "owed"): string {
  if (status === "paid") return "Paid";
  if (status === "partial") return "Part paid";
  return "Owed";
}

/** How much of a delivery was paid at the time it was recorded. */
export function resolveDeliveryAmountPaid(
  totalCost: number,
  settlement: SupplierSettlement,
  partialAmount?: number,
): number {
  const total = roundMoney(totalCost);
  if (settlement === "owed") return 0;
  if (settlement === "paid") return total;
  if (typeof partialAmount !== "number" || !Number.isFinite(partialAmount) || partialAmount <= 0) {
    throw new Error("Enter how much you paid");
  }
  const paid = roundMoney(partialAmount);
  if (paid - total > 0.001) {
    throw new Error("Amount paid cannot exceed the delivery total");
  }
  return paid;
}

export function allocateSupplierPayment(
  purchases: SupplierPurchaseBalanceInput[],
  amount: number,
  purchaseId?: string,
): { allocations: Array<{ id: string; applied: number }>; unapplied: number } {
  const payment = roundMoney(amount);
  if (!Number.isFinite(payment) || payment <= 0) {
    return { allocations: [], unapplied: 0 };
  }
  if (purchaseId) {
    const purchase = purchases.find((row) => row.id === purchaseId && row.status !== "void");
    if (!purchase) return { allocations: [], unapplied: payment };
    const balance = purchaseBalance(purchase);
    if (payment - balance > 0.001) return { allocations: [], unapplied: payment };
    return { allocations: [{ id: purchase.id, applied: payment }], unapplied: 0 };
  }
  const open = purchases
    .filter((row) => row.status !== "void" && purchaseBalance(row) > 0)
    .sort((a, b) => a.purchasedAt - b.purchasedAt);
  let remaining = payment;
  const allocations: Array<{ id: string; applied: number }> = [];
  for (const row of open) {
    if (remaining <= 0) break;
    const applied = roundMoney(Math.min(purchaseBalance(row), remaining));
    if (applied <= 0) continue;
    allocations.push({ id: row.id, applied });
    remaining = roundMoney(remaining - applied);
  }
  return { allocations, unapplied: remaining };
}

/** Add a payment onto purchase rows. Does not change rows the payment does not touch. */
export function applySupplierPayment<T extends SupplierPurchaseBalanceInput>(
  purchases: T[],
  amount: number,
  purchaseId?: string,
): { purchases: T[]; unapplied: number } {
  const allocation = allocateSupplierPayment(purchases, amount, purchaseId);
  if (allocation.allocations.length === 0) {
    return { purchases, unapplied: allocation.unapplied };
  }
  const appliedById = new Map(allocation.allocations.map((row) => [row.id, row.applied]));
  return {
    unapplied: allocation.unapplied,
    purchases: purchases.map((row) => {
      const applied = appliedById.get(row.id);
      if (!applied) return row;
      return { ...row, amountPaid: roundMoney(settledAmount(row) + applied) };
    }),
  };
}
