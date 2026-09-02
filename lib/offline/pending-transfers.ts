import type { NovendOfflineDb } from "./db";
import type { TransferStockPayload } from "./types";

export type PendingTransferKey = `${string}:${string}`;

const OPEN_STATUSES = new Set(["pending", "syncing", "failed"]);

export function transferStockKey(fromBranchId: string, productId: string): PendingTransferKey {
  return `${fromBranchId}:${productId}`;
}

export type PendingTransferDisplay = {
  reserved: number;
  maxSourceSnapshot: number;
};

/** Sum outbound quantities still waiting to upload for each source branch + product. */
export async function pendingOutboundTransferQuantities(
  db: NovendOfflineDb,
): Promise<Map<PendingTransferKey, number>> {
  const details = await pendingTransferDisplayAdjustments(db);
  const map = new Map<PendingTransferKey, number>();
  for (const [key, value] of details) {
    map.set(key, value.reserved);
  }
  return map;
}

/** Pending transfer metadata used to keep source-branch stock readable while syncing. */
export async function pendingTransferDisplayAdjustments(
  db: NovendOfflineDb,
): Promise<Map<PendingTransferKey, PendingTransferDisplay>> {
  const rows = await db.outbox.toArray();
  const map = new Map<PendingTransferKey, PendingTransferDisplay>();

  for (const row of rows) {
    if (row.type !== "transfer_stock" || !OPEN_STATUSES.has(row.status)) continue;
    try {
      const payload = JSON.parse(row.payloadJson) as TransferStockPayload;
      if (!payload.fromBranchId || !payload.productId || !Number.isFinite(payload.quantity)) {
        continue;
      }
      const key = transferStockKey(payload.fromBranchId, payload.productId);
      const current = map.get(key) ?? { reserved: 0, maxSourceSnapshot: 0 };
      current.reserved += payload.quantity;
      if (Number.isFinite(payload.sourceStockSnapshot)) {
        current.maxSourceSnapshot = Math.max(
          current.maxSourceSnapshot,
          payload.sourceStockSnapshot ?? 0,
        );
      }
      map.set(key, current);
    } catch {
      /* ignore corrupt payload */
    }
  }

  return map;
}

/** Org-wide pending outbound totals per product (all source branches). */
export function pendingOutboundForProduct(
  pending: Map<PendingTransferKey, number>,
  productId: string,
): number {
  let total = 0;
  for (const [key, quantity] of pending) {
    if (key.endsWith(`:${productId}`)) total += quantity;
  }
  return total;
}

function applyPendingTransferDisplay(
  stockQuantity: number,
  sellableQuantity: number,
  adjustment: PendingTransferDisplay | undefined,
): { stockQuantity: number; sellableQuantity: number } {
  if (!adjustment || adjustment.maxSourceSnapshot <= 0) {
    return { stockQuantity, sellableQuantity };
  }
  const nextSellable = Math.max(sellableQuantity, adjustment.maxSourceSnapshot);
  const nextStock = Math.max(stockQuantity, adjustment.maxSourceSnapshot);
  return { stockQuantity: nextStock, sellableQuantity: nextSellable };
}

export { applyPendingTransferDisplay };
