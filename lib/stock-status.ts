/** Shared low-stock math for dashboard KPIs and inventory lists. */

export function availableStockQuantity(args: {
  tracksExpiry?: boolean;
  stockQuantity: number;
  sellableQuantity?: number;
}): number {
  if (args.tracksExpiry) return args.sellableQuantity ?? 0;
  return args.sellableQuantity ?? args.stockQuantity;
}

export function isBelowLowStockThreshold(available: number, threshold: number): boolean {
  return available <= threshold;
}

/** True when any branch row is at or below the product threshold. */
export function isLowStockAtAnyBranch(
  threshold: number,
  tracksExpiry: boolean | undefined,
  rows: ReadonlyArray<{ quantity: number; sellableQuantity?: number }>,
  fallback: { stockQuantity: number; sellableQuantity?: number },
): boolean {
  if (rows.length === 0) {
    return isBelowLowStockThreshold(
      availableStockQuantity({
        tracksExpiry,
        stockQuantity: fallback.stockQuantity,
        sellableQuantity: fallback.sellableQuantity,
      }),
      threshold,
    );
  }
  return rows.some((row) =>
    isBelowLowStockThreshold(
      availableStockQuantity({
        tracksExpiry,
        stockQuantity: row.quantity,
        sellableQuantity: row.sellableQuantity,
      }),
      threshold,
    ),
  );
}
