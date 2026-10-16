/**
 * Offline branch lot adjustments (dated products).
 * Mirrors convex/shared/lots.ts increaseLot / decreaseLots for Dexie.
 */

import { newClientId, type NovendOfflineDb } from "./db";
import type { MirroredLot } from "./types";

function fefoOrder(a: MirroredLot, b: MirroredLot): number {
  const byExpiry = a.expiryDate.localeCompare(b.expiryDate);
  return byExpiry !== 0 ? byExpiry : a.receivedAt - b.receivedAt;
}

/**
 * Apply a stock delta to dated lots for a branch product.
 * - Positive: requires expiryDate (merge/create lot).
 * - Negative: prefers lotId; otherwise FEFO across lots with quantity.
 */
export async function applyLocalDatedLotDelta(
  db: NovendOfflineDb,
  args: {
    branchId: string;
    productId: string;
    quantityChange: number;
    lotId?: string;
    expiryDate?: string;
  },
): Promise<void> {
  const change = Math.trunc(args.quantityChange);
  if (change === 0) return;

  if (change > 0) {
    const expiryDate = args.expiryDate?.trim();
    if (!expiryDate) throw new Error("Expiry date is required for dated products");
    const existing = (await db.lots.where("productId").equals(args.productId).toArray()).find(
      (lot) =>
        lot.branchId === args.branchId && lot.expiryDate === expiryDate && lot.quantity > 0,
    );
    if (existing) {
      await db.lots.put({ ...existing, quantity: existing.quantity + change });
      return;
    }
    await db.lots.put({
      id: newClientId("lot"),
      productId: args.productId,
      branchId: args.branchId,
      quantity: change,
      expiryDate,
      lotCode: expiryDate,
      receivedAt: Date.now(),
    });
    return;
  }

  const need = -change;
  if (args.lotId) {
    const lot = await db.lots.get(args.lotId);
    if (!lot || lot.branchId !== args.branchId || lot.productId !== args.productId) {
      throw new Error("Lot not found for this product");
    }
    if (lot.quantity < need) {
      throw new Error("Insufficient quantity in the selected lot");
    }
    await db.lots.put({ ...lot, quantity: lot.quantity - need });
    return;
  }

  const candidates = (await db.lots.where("productId").equals(args.productId).toArray())
    .filter((lot) => lot.branchId === args.branchId && lot.quantity > 0)
    .sort(fefoOrder);

  let remaining = need;
  for (const lot of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    await db.lots.put({ ...lot, quantity: lot.quantity - take });
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error("Insufficient stock in dated lots. Pick a specific expiry lot.");
  }
}
