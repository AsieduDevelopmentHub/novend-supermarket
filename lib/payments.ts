/** Tender recorded on a completed sale. Cash is the till default. */
export const PAYMENT_METHODS = ["cash", "mobile_money", "card"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "MoMo" },
  { value: "card", label: "Card" },
];

/** Gross tender totals for a report period (matches digest `PaymentTotals`). */
export type ReportPaymentTotals = {
  cash: number;
  card: number;
  mobileMoney: number;
};

export function emptyReportPaymentTotals(): ReportPaymentTotals {
  return { cash: 0, card: 0, mobileMoney: 0 };
}

/** Add a whole-sale total into the tender bucket (no split payments). */
export function addReportPaymentTotal(
  totals: ReportPaymentTotals,
  paymentMethod: string | undefined,
  amount: number,
): ReportPaymentTotals {
  const next = { ...totals };
  if (paymentMethod === "card") next.card += amount;
  else if (paymentMethod === "mobile_money") next.mobileMoney += amount;
  else next.cash += amount;
  return next;
}

export function sumReportPaymentTotals(rows: ReportPaymentTotals[]): ReportPaymentTotals {
  return rows.reduce(
    (acc, row) => ({
      cash: acc.cash + row.cash,
      card: acc.card + row.card,
      mobileMoney: acc.mobileMoney + row.mobileMoney,
    }),
    emptyReportPaymentTotals(),
  );
}

export function isPaymentMethod(value: string): value is PaymentMethod {
  return (PAYMENT_METHODS as readonly string[]).includes(value);
}

/** Short tag for orders, receipts, and reports. */
export function paymentMethodLabel(value: string): string {
  return (
    PAYMENT_METHOD_OPTIONS.find((option) => option.value === value)?.label ??
    value.replace(/_/g, " ")
  );
}
