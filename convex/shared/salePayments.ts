/**
 * Split-tender normalization for completed sales.
 * Sum of payments must equal sale total. Primary tender is largest amount (ties → first).
 */

import { roundMoney } from "./validation";

export const SALE_PAYMENT_METHODS = ["cash", "card", "mobile_money", "on_account"] as const;
export type SalePaymentMethod = (typeof SALE_PAYMENT_METHODS)[number];

export type SalePaymentLine = {
  method: SalePaymentMethod;
  amount: number;
};

export function isSalePaymentMethod(value: string): value is SalePaymentMethod {
  return (SALE_PAYMENT_METHODS as readonly string[]).includes(value);
}

/** Collapse duplicate methods and drop zero amounts. */
export function normalizeSalePayments(
  payments: SalePaymentLine[] | undefined,
  fallbackMethod: SalePaymentMethod,
  total: number,
): SalePaymentLine[] {
  const expected = roundMoney(total);
  if (!payments || payments.length === 0) {
    return expected <= 0 ? [] : [{ method: fallbackMethod, amount: expected }];
  }

  const byMethod = new Map<SalePaymentMethod, number>();
  for (const row of payments) {
    if (!isSalePaymentMethod(row.method)) {
      throw new Error("Invalid payment method");
    }
    if (!Number.isFinite(row.amount) || row.amount < 0) {
      throw new Error("Invalid payment amount");
    }
    const amount = roundMoney(row.amount);
    if (amount <= 0) continue;
    byMethod.set(row.method, roundMoney((byMethod.get(row.method) ?? 0) + amount));
  }

  const normalized = [...byMethod.entries()].map(([method, amount]) => ({ method, amount }));
  if (normalized.length === 0) {
    if (expected <= 0) return [];
    throw new Error("At least one payment is required");
  }

  const sum = roundMoney(normalized.reduce((acc, row) => acc + row.amount, 0));
  if (Math.abs(sum - expected) > 0.001) {
    throw new Error(
      `Payments (${sum}) must equal the sale total (${expected}).`,
    );
  }
  return normalized;
}

export function primarySalePaymentMethod(payments: SalePaymentLine[]): SalePaymentMethod {
  if (payments.length === 0) return "cash";
  let best = payments[0]!;
  for (const row of payments) {
    if (row.amount > best.amount) best = row;
  }
  return best.method;
}

export function onAccountAmount(payments: SalePaymentLine[]): number {
  return roundMoney(
    payments.filter((row) => row.method === "on_account").reduce((acc, row) => acc + row.amount, 0),
  );
}
