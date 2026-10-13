/**
 * Offline FEFO for warehouse (wholesale) dated lots.
 * Mirrors convex/wholesale.ts: receive adds / merges a lot by expiry date,
 * issue takes the earliest-expiring lots first and moves them to the branch.
 */

import type {
  MirroredLot,
  MirroredWholesaleLot,
  OutboxRow,
  RecordWholesalePurchasePayload,
  WholesaleTransferPayload,
} from "./types";

export type LotAllocation = { lotId: string; quantity: number; expiryDate: string };

/** Earliest expiry first; ties by earliest receipt. */
function fefoOrder(a: MirroredWholesaleLot, b: MirroredWholesaleLot): number {
  const byExpiry = a.expiryDate.localeCompare(b.expiryDate);
  return byExpiry !== 0 ? byExpiry : a.receivedAt - b.receivedAt;
}

export function takeWholesaleLotsFefo(
  lots: ReadonlyArray<MirroredWholesaleLot>,
  productId: string,
  quantity: number,
): { lots: MirroredWholesaleLot[]; taken: LotAllocation[] } {
  const next = lots.map((lot) => ({ ...lot }));
  const candidates = next
    .filter((lot) => lot.productId === productId && lot.quantity > 0)
    .sort(fefoOrder);
  let remaining = quantity;
  const taken: LotAllocation[] = [];
  for (const lot of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(lot.quantity, remaining);
    lot.quantity -= take;
    remaining -= take;
    taken.push({ lotId: lot.id, quantity: take, expiryDate: lot.expiryDate });
  }
  if (remaining > 0) throw new Error("Insufficient dated wholesale stock");
  return { lots: next.filter((lot) => lot.quantity > 0), taken };
}

export function addWholesaleLot(
  lots: ReadonlyArray<MirroredWholesaleLot>,
  input: {
    id: string;
    productId: string;
    quantity: number;
    expiryDate: string;
    receivedAt: number;
  },
): MirroredWholesaleLot[] {
  const match = lots.find(
    (lot) =>
      lot.productId === input.productId && lot.expiryDate === input.expiryDate && lot.quantity > 0,
  );
  if (match) {
    return lots.map((lot) =>
      lot.id === match.id ? { ...lot, quantity: lot.quantity + input.quantity } : lot,
    );
  }
  return [
    ...lots,
    {
      id: input.id,
      productId: input.productId,
      quantity: input.quantity,
      expiryDate: input.expiryDate,
      receivedAt: input.receivedAt,
      lotCode: input.expiryDate,
    },
  ];
}

function addBranchLot(
  lots: ReadonlyArray<MirroredLot>,
  input: {
    id: string;
    productId: string;
    branchId: string;
    branchName: string | null;
    quantity: number;
    expiryDate: string;
    receivedAt: number;
  },
): MirroredLot[] {
  const match = lots.find(
    (lot) =>
      lot.productId === input.productId &&
      lot.branchId === input.branchId &&
      lot.expiryDate === input.expiryDate,
  );
  if (match) {
    return lots.map((lot) =>
      lot.id === match.id ? { ...lot, quantity: lot.quantity + input.quantity } : lot,
    );
  }
  return [
    ...lots,
    {
      id: input.id,
      productId: input.productId,
      branchId: input.branchId,
      branchName: input.branchName,
      quantity: input.quantity,
      expiryDate: input.expiryDate,
      lotCode: input.expiryDate,
      receivedAt: input.receivedAt,
    },
  ];
}

const OPEN = new Set(["pending", "syncing", "failed"]);

/**
 * Re-apply warehouse operations Convex has not confirmed yet on top of a fresh
 * snapshot so a pull cannot resurrect stock an offline issue already removed.
 */
export function replayPendingWarehouseLots(input: {
  warehouseLots: ReadonlyArray<MirroredWholesaleLot>;
  branchLots: ReadonlyArray<MirroredLot>;
  outbox: ReadonlyArray<OutboxRow>;
  datedProductIds: ReadonlySet<string>;
  branchName: (branchId: string) => string | null;
}): { warehouseLots: MirroredWholesaleLot[]; branchLots: MirroredLot[] } {
  let warehouseLots = [...input.warehouseLots];
  let branchLots = [...input.branchLots];
  const ordered = [...input.outbox]
    .filter((row) => OPEN.has(row.status))
    .filter((row) => row.type === "record_wholesale_purchase" || row.type === "wholesale_transfer")
    .sort((a, b) => a.createdAt - b.createdAt);
  for (const row of ordered) {
    try {
      if (row.type === "record_wholesale_purchase") {
        const payload = JSON.parse(row.payloadJson) as RecordWholesalePurchasePayload;
        for (const item of payload.items) {
          if (!item.expiryDate || !input.datedProductIds.has(item.productId)) continue;
          warehouseLots = addWholesaleLot(warehouseLots, {
            id: `local_lot_${payload.localId}_${item.productId}_${item.expiryDate}`,
            productId: item.productId,
            quantity: item.quantity,
            expiryDate: item.expiryDate,
            receivedAt: payload.purchasedAt,
          });
        }
      } else {
        const payload = JSON.parse(row.payloadJson) as WholesaleTransferPayload;
        if (!input.datedProductIds.has(payload.productId)) continue;
        const { lots, taken } = takeWholesaleLotsFefo(
          warehouseLots,
          payload.productId,
          payload.quantity,
        );
        warehouseLots = lots;
        for (const allocation of taken) {
          branchLots = addBranchLot(branchLots, {
            id: `local_lot_${payload.localId}_${allocation.expiryDate}`,
            productId: payload.productId,
            branchId: payload.branchId,
            branchName: input.branchName(payload.branchId),
            quantity: allocation.quantity,
            expiryDate: allocation.expiryDate,
            receivedAt: row.createdAt,
          });
        }
      }
    } catch {
      // A transfer that cannot be satisfied offline is rejected at queue time;
      // skip a malformed or stale row rather than corrupt the mirror.
    }
  }
  return { warehouseLots, branchLots };
}

export { addBranchLot };
