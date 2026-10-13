import { v } from "convex/values";

/**
 * Keep in step with `PaymentMethod` in `lib/payments.ts` and
 * `SALE_PAYMENT_METHODS` in `./salePayments.ts`.
 *
 * `on_account` is customer credit (receivable). It is a valid sale tender and
 * refund destination, never a supplier or purchase settlement method.
 */
export const paymentMethodValidator = v.union(
  v.literal("cash"),
  v.literal("card"),
  v.literal("mobile_money"),
  v.literal("on_account"),
);

/**
 * Settlement-only validator for dining, hotel, supplier, and purchase flows that
 * have no customer-credit ledger. Rejects `on_account` at the API boundary.
 */
export const settlementMethodValidator = v.union(
  v.literal("cash"),
  v.literal("card"),
  v.literal("mobile_money"),
);

/** Settlement methods that move real money (excludes customer credit). */
export const SETTLEMENT_PAYMENT_METHODS = ["cash", "card", "mobile_money"] as const;

export function assertSettlementMethod(method: string, label = "Payment method"): void {
  if (!(SETTLEMENT_PAYMENT_METHODS as readonly string[]).includes(method)) {
    throw new Error(`${label} cannot be on account`);
  }
}
