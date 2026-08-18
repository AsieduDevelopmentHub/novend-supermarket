const GHS = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  minimumFractionDigits: 2,
});

export function formatCurrency(amount: number) {
  return GHS.format(amount);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GH").format(value);
}

/** Round to 2 decimal places for money amounts. */
export function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
