/**
 * Customer credit (accounts receivable) pure logic.
 * Balance = sum of ledger amounts. Positive = customer owes the business.
 *   sale_charge  → positive
 *   payment      → negative
 *   adjustment   → signed (refund to account is negative)
 */

import { roundMoney } from "./validation";

export const CUSTOMER_LEDGER_TYPES = ["sale_charge", "payment", "adjustment"] as const;
export type CustomerLedgerType = (typeof CUSTOMER_LEDGER_TYPES)[number];

export type LedgerEntryLike = {
  type: CustomerLedgerType;
  /** Signed effect on what the customer owes. */
  amount: number;
  occurredAt: number;
};

export function customerBalance(entries: Array<Pick<LedgerEntryLike, "amount">>): number {
  return roundMoney(entries.reduce((acc, row) => acc + row.amount, 0));
}

export type CreditLimitCheck =
  | { ok: true; balanceAfter: number }
  | { ok: false; message: string; balanceAfter: number; limit: number };

/**
 * `limit` null/undefined means "no limit configured" — charges are allowed.
 * A limit of 0 blocks any new on-account charge.
 */
export function checkCreditLimit(input: {
  currentBalance: number;
  charge: number;
  limit: number | null | undefined;
}): CreditLimitCheck {
  const balanceAfter = roundMoney(input.currentBalance + input.charge);
  if (input.limit === null || input.limit === undefined) {
    return { ok: true, balanceAfter };
  }
  if (balanceAfter - input.limit > 0.001) {
    return {
      ok: false,
      balanceAfter,
      limit: input.limit,
      message: `Credit limit exceeded. Balance would be ${balanceAfter.toFixed(2)} against a limit of ${input.limit.toFixed(2)}.`,
    };
  }
  return { ok: true, balanceAfter };
}

export function assertCreditLimit(input: {
  currentBalance: number;
  charge: number;
  limit: number | null | undefined;
}): number {
  const result = checkCreditLimit(input);
  if (!result.ok) throw new Error(result.message);
  return result.balanceAfter;
}

export const AGING_BUCKETS = ["current", "days31to60", "days61plus"] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];
export type AgingSummary = Record<AgingBucket, number> & { total: number };

const DAY_MS = 24 * 60 * 60 * 1000;

export function agingBucketForAge(ageDays: number): AgingBucket {
  if (ageDays <= 30) return "current";
  if (ageDays <= 60) return "days31to60";
  return "days61plus";
}

/**
 * FIFO aging: payments and credits settle the oldest charges first, so the
 * remaining open charges are bucketed by their own age (0-30 / 31-60 / 61+).
 */
export function summarizeAging(entries: LedgerEntryLike[], now: number): AgingSummary {
  const ordered = [...entries].sort((a, b) => a.occurredAt - b.occurredAt);
  const open: Array<{ occurredAt: number; remaining: number }> = [];
  let credit = 0;
  for (const row of ordered) {
    if (row.amount > 0) {
      open.push({ occurredAt: row.occurredAt, remaining: row.amount });
    } else if (row.amount < 0) {
      credit += -row.amount;
    }
  }
  for (const charge of open) {
    if (credit <= 0) break;
    const applied = Math.min(charge.remaining, credit);
    charge.remaining = roundMoney(charge.remaining - applied);
    credit = roundMoney(credit - applied);
  }
  const summary: AgingSummary = { current: 0, days31to60: 0, days61plus: 0, total: 0 };
  for (const charge of open) {
    if (charge.remaining <= 0.001) continue;
    const ageDays = Math.max(0, Math.floor((now - charge.occurredAt) / DAY_MS));
    const bucket = agingBucketForAge(ageDays);
    summary[bucket] = roundMoney(summary[bucket] + charge.remaining);
    summary.total = roundMoney(summary.total + charge.remaining);
  }
  return summary;
}

/**
 * How much of a refund goes back onto the customer's account instead of cash.
 * The on-account share of the sale is refunded pro rata, never beyond what the
 * sale charged to the account (minus credits already issued for it).
 */
export function creditRefundAmount(input: {
  saleTotal: number;
  onAccountCharged: number;
  alreadyCredited: number;
  refundAmount: number;
}): number {
  if (input.onAccountCharged <= 0 || input.saleTotal <= 0 || input.refundAmount <= 0) return 0;
  const share = input.onAccountCharged / input.saleTotal;
  const proRata = roundMoney(input.refundAmount * share);
  const room = roundMoney(Math.max(0, input.onAccountCharged - input.alreadyCredited));
  return roundMoney(Math.min(proRata, room, input.refundAmount));
}

/** Payment cannot exceed what the customer owes. */
export function assertPaymentWithinBalance(balance: number, amount: number): void {
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Enter a valid amount");
  if (amount - balance > 0.001) {
    throw new Error("That payment is more than this customer owes");
  }
}
