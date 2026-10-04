/** Tender recorded on a completed sale. Cash is the till default. */
export const PAYMENT_METHODS = ["cash", "mobile_money", "card", "other"] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_OPTIONS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "mobile_money", label: "MoMo" },
  { value: "card", label: "Card" },
  { value: "other", label: "Other" },
];

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
