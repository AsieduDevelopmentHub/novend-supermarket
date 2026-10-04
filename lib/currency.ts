const GHS = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
});

const MONEY_AMOUNT = new Intl.NumberFormat("en-GH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(amount: number) {
  return GHS.format(amount);
}

/** Currency symbol on its own (e.g. `GH₵`) for labels that carry the unit. */
export const CURRENCY_SYMBOL =
  GHS.formatToParts(0).find((part) => part.type === "currency")?.value ?? "GH₵";

/** Money amount without the symbol — pair with `CURRENCY_SYMBOL` in the label. */
export function formatMoneyAmount(amount: number) {
  return MONEY_AMOUNT.format(amount);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GH").format(value);
}

/** Round to 2 decimal places for money amounts. */
export function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
