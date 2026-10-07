import type { CompleteSaleOutboxPayload, LocalSaleItem } from "./types";

export type SaleUploadLine = CompleteSaleOutboxPayload["items"][number];

function sameAmount(a: number, b: number) {
  return Math.abs(a - b) < 0.001;
}

/**
 * Older outbox rows stored only the displayed quantity. The receipt lines still
 * have the price and base quantity that were sold, and the upload must send those
 * so a later catalog edit does not reprice or resize the sale.
 */
export function attachSoldLineSnapshots(
  items: SaleUploadLine[],
  saved: LocalSaleItem[],
): SaleUploadLine[] {
  const used = new Set<string>();
  return items.map((item) => {
    if (typeof item.unitPrice === "number" && typeof item.baseQuantity === "number") {
      return item;
    }
    const match = saved.find((line) => {
      if (used.has(line.id) || line.productId !== item.productId) return false;
      const displayed = line.displayedQuantity ?? line.quantity;
      const quantityMatches =
        sameAmount(displayed, item.quantity) || sameAmount(line.quantity, item.quantity);
      return quantityMatches && sameAmount(line.discount, item.discount);
    });
    if (!match) return item;
    used.add(match.id);
    return {
      ...item,
      unitPrice: match.unitPrice,
      baseQuantity: match.quantity,
      sellUnitKey: item.sellUnitKey ?? match.sellUnitKey,
      sellUnitLabel: match.sellUnitLabel,
      factorToBase: match.factorToBase,
      pricingMode: match.pricingMode,
    };
  });
}

/** Copy receipt base quantities onto open sale payloads before a stock snapshot. */
export async function withReceiptQuantities<T extends { type: string; payloadJson: string }>(
  rows: T[],
  loadItems: (localSaleId: string) => Promise<LocalSaleItem[]>,
): Promise<T[]> {
  const next: T[] = [];
  for (const row of rows) {
    if (row.type !== "complete_sale") {
      next.push(row);
      continue;
    }
    try {
      const payload = JSON.parse(row.payloadJson) as CompleteSaleOutboxPayload;
      if (!payload.localSaleId) {
        next.push(row);
        continue;
      }
      const saved = await loadItems(payload.localSaleId);
      next.push({
        ...row,
        payloadJson: JSON.stringify({
          ...payload,
          items: attachSoldLineSnapshots(payload.items ?? [], saved),
        }),
      });
    } catch {
      next.push(row);
    }
  }
  return next;
}
