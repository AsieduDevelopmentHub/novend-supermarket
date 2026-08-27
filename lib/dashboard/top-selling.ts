export type TopSellingMetric = "quantity" | "amount";

export type TopSellingProduct = {
  id: string;
  name: string;
  quantity: number;
  total: number;
};

export const TOP_SELLING_METRIC_KEY = "novend.topSellingMetric";

export function parseTopSellingMetric(value: unknown): TopSellingMetric {
  return value === "amount" ? "amount" : "quantity";
}

function compareTopSelling(a: TopSellingProduct, b: TopSellingProduct, metric: TopSellingMetric) {
  if (metric === "quantity") {
    return b.quantity - a.quantity || b.total - a.total;
  }
  return b.total - a.total || b.quantity - a.quantity;
}

/** Rank sold products. Keeps enough rows that Quantity and Amount toggles stay accurate. */
export function collectTopSellingCandidates(
  products: TopSellingProduct[],
  perMetric = 40,
): TopSellingProduct[] {
  const sold = products.filter((row) => row.quantity > 0);
  if (sold.length <= perMetric) return sold;
  const byQuantity = [...sold].sort((a, b) => compareTopSelling(a, b, "quantity")).slice(0, perMetric);
  const byAmount = [...sold].sort((a, b) => compareTopSelling(a, b, "amount")).slice(0, perMetric);
  const merged = new Map<string, TopSellingProduct>();
  for (const row of [...byQuantity, ...byAmount]) merged.set(row.id, row);
  return [...merged.values()];
}

export function sortTopSelling(
  products: TopSellingProduct[],
  metric: TopSellingMetric,
  limit = 5,
): TopSellingProduct[] {
  return [...products]
    .filter((row) => row.quantity > 0)
    .sort((a, b) => compareTopSelling(a, b, metric))
    .slice(0, limit);
}
