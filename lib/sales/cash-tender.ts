import { roundMoney } from "@/lib/currency";

export function parseCashTenderInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export type ReceiptCashTender = {
  amountPaid: number;
  changeGiven: number;
};

/**
 * Build amount-paid / change for the receipt.
 * When `defaultExactCash` is true and the cashier left Paid blank, records exact tender
 * (paid = total, change = 0) so cash receipts still show both lines.
 */
export function buildReceiptCashTender(
  saleTotal: number,
  amountPaidRaw: number | null | undefined,
  options?: { defaultExactCash?: boolean },
): ReceiptCashTender | null {
  const total = roundMoney(Math.max(0, saleTotal));
  if (amountPaidRaw != null && Number.isFinite(amountPaidRaw)) {
    const amountPaid = roundMoney(Math.max(0, amountPaidRaw));
    if (amountPaid + 0.001 < total) return null;
    return { amountPaid, changeGiven: roundMoney(Math.max(0, amountPaid - total)) };
  }
  if (options?.defaultExactCash) {
    return { amountPaid: total, changeGiven: 0 };
  }
  return null;
}
