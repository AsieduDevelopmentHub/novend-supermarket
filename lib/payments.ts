/**
 * Tender recorded on a completed sale. Cash is the till default.
 * `on_account` is customer credit (receivable) — a sale tender and refund
 * destination, never a supplier / purchase settlement method.
 * Keep in step with `convex/shared/paymentMethod.ts` and `convex/shared/salePayments.ts`.
 */
export const PAYMENT_METHODS = ["cash", "mobile_money", "card", "on_account"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** Settlement methods: real money moving (suppliers, purchases, customer payments). */
export const SETTLEMENT_METHODS = ["cash", "mobile_money", "card"] as const;
export type SettlementMethod = (typeof SETTLEMENT_METHODS)[number];

export const SETTLEMENT_METHOD_OPTIONS: Array<{ value: SettlementMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "MoMo" },
  { value: "card", label: "Card" },
];

export const ON_ACCOUNT_OPTION = { value: "on_account", label: "On account" } as const;

/** Checkout tenders. `on_account` is only offered when customer credit is available. */
export const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  ...SETTLEMENT_METHOD_OPTIONS,
  ON_ACCOUNT_OPTION,
];

/** A single tender line on a split payment. */
export type PaymentLine = {
  method: PaymentMethod;
  amount: number;
};

/** Gross tender totals for a report period (matches digest `PaymentTotals`). */
export type ReportPaymentTotals = {
  cash: number;
  card: number;
  mobileMoney: number;
  /** Sold on customer credit (not money in the till). Absent on older cached summaries. */
  onAccount?: number;
};

export function emptyReportPaymentTotals(): ReportPaymentTotals {
  return { cash: 0, card: 0, mobileMoney: 0, onAccount: 0 };
}

/** Add tender lines (a split sale) into the report buckets. */
export function addReportPaymentLines(
  totals: ReportPaymentTotals,
  lines: ReadonlyArray<{ method: string; amount: number }>,
): ReportPaymentTotals {
  const next: ReportPaymentTotals = { ...totals, onAccount: totals.onAccount ?? 0 };
  for (const line of lines) {
    if (line.method === "card") next.card += line.amount;
    else if (line.method === "mobile_money") next.mobileMoney += line.amount;
    else if (line.method === "on_account") next.onAccount = (next.onAccount ?? 0) + line.amount;
    else next.cash += line.amount;
  }
  return next;
}

/**
 * Add a sale into the tender buckets. Pass `payments` for split sales; without
 * them the whole total lands in the primary `paymentMethod` bucket.
 */
export function addReportPaymentTotal(
  totals: ReportPaymentTotals,
  paymentMethod: string | undefined,
  amount: number,
  payments?: ReadonlyArray<{ method: string; amount: number }> | null,
): ReportPaymentTotals {
  if (payments && payments.length > 0) return addReportPaymentLines(totals, payments);
  return addReportPaymentLines(totals, [{ method: paymentMethod ?? "cash", amount }]);
}

export function sumReportPaymentTotals(rows: ReportPaymentTotals[]): ReportPaymentTotals {
  return rows.reduce(
    (acc, row) => ({
      cash: acc.cash + row.cash,
      card: acc.card + row.card,
      mobileMoney: acc.mobileMoney + row.mobileMoney,
      onAccount: (acc.onAccount ?? 0) + (row.onAccount ?? 0),
    }),
    emptyReportPaymentTotals(),
  );
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

export function isSettlementMethod(value: string): value is SettlementMethod {
  return (SETTLEMENT_METHODS as readonly string[]).includes(value);
}

/** Short tag for orders, receipts, and reports. */
export function paymentMethodLabel(value: string): string {
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label ??
    value.replace(/_/g, " ")
  );
}
