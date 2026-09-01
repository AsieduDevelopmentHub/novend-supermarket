const OPEN_OUTBOX_STATUSES = new Set(["pending", "syncing", "failed"]);

const LOCAL_ID_KEYS = ["localId", "localSaleId", "localReturnId"] as const;

/** Local Dexie ids still waiting on an open outbox row. */
export function pendingLocalIdsFromOutbox(
  rows: Array<{ status: string; payloadJson: string }>,
): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    if (!OPEN_OUTBOX_STATUSES.has(row.status)) continue;
    try {
      const payload = JSON.parse(row.payloadJson) as Record<string, unknown>;
      for (const key of LOCAL_ID_KEYS) {
        const value = payload[key];
        if (typeof value === "string" && value.startsWith("local_")) ids.add(value);
      }
    } catch {
      /* ignore malformed payloads */
    }
  }
  return ids;
}

export function keepPendingLocalRows<T extends { id: string }>(
  localRows: T[],
  pendingIds: Set<string>,
): T[] {
  return localRows.filter((row) => pendingIds.has(row.id));
}

/**
 * Snapshot merge: server rows plus only still-pending optimistic local_* rows.
 * `isSame` drops a pending local row when Convex already has the same operation
 * (outbox still open, server id already in the snapshot).
 */
export function mergeServerAndLocalById<T extends { id: string }>(
  serverRows: T[],
  localRows: T[],
  pendingIds: Set<string>,
  isSame?: (server: T, local: T) => boolean,
): T[] {
  const pending = keepPendingLocalRows(localRows, pendingIds);
  const extra = isSame
    ? pending.filter((local) => !serverRows.some((server) => isSame(server, local)))
    : pending;
  return [...serverRows, ...extra];
}

export function sameWholesalePurchase(
  a: { supplierId: string; purchasedAt: number; totalCost: number; invoiceNumber?: string | null },
  b: { supplierId: string; purchasedAt: number; totalCost: number; invoiceNumber?: string | null },
): boolean {
  if (a.invoiceNumber && b.invoiceNumber) {
    return a.supplierId === b.supplierId && a.invoiceNumber === b.invoiceNumber;
  }
  return (
    a.supplierId === b.supplierId && a.purchasedAt === b.purchasedAt && a.totalCost === b.totalCost
  );
}

export function sameWholesaleTransfer(
  a: { productName: string; branchName: string; quantity: number; createdAt: number },
  b: { productName: string; branchName: string; quantity: number; createdAt: number },
): boolean {
  return (
    a.productName === b.productName &&
    a.branchName === b.branchName &&
    a.quantity === b.quantity &&
    Math.abs(a.createdAt - b.createdAt) < 15_000
  );
}

export function sameReturnNumber(
  a: { returnNumber: string },
  b: { returnNumber: string },
): boolean {
  return Boolean(a.returnNumber) && a.returnNumber === b.returnNumber;
}

export function sameExpense(
  a: { amount: number; occurredAt: number; category: string },
  b: { amount: number; occurredAt: number; category: string },
): boolean {
  return a.amount === b.amount && a.occurredAt === b.occurredAt && a.category === b.category;
}

export function sameInvoiceNumber(
  a: { invoiceNumber: string },
  b: { invoiceNumber: string },
): boolean {
  return Boolean(a.invoiceNumber) && a.invoiceNumber === b.invoiceNumber;
}

/** List guard: hide optimistic local_* rows once the server copy is present. */
export function dropLocalDuplicates<T extends { id: string }>(
  rows: T[],
  isSame: (a: T, b: T) => boolean,
): T[] {
  const server = rows.filter((row) => !row.id.startsWith("local_"));
  const local = rows.filter((row) => row.id.startsWith("local_"));
  return [...server, ...local.filter((row) => !server.some((item) => isSame(item, row)))];
}

/**
 * Wholesale stock is per product. A pending local_* row must not sit beside the
 * server row for the same SKU or quantities double in summaries.
 */
export function mergeWholesaleStock<T extends { id: string; productId: string }>(
  serverRows: T[],
  localRows: T[],
  pendingIds: Set<string>,
): T[] {
  const pendingLocal = keepPendingLocalRows(localRows, pendingIds);
  const serverProductIds = new Set(serverRows.map((row) => row.productId));
  return [...serverRows, ...pendingLocal.filter((row) => !serverProductIds.has(row.productId))];
}

type OpenOutboxRow = { status: string; type: string; payloadJson: string };

function isOpenOutbox(row: { status: string }) {
  return OPEN_OUTBOX_STATUSES.has(row.status);
}

function bumpQty<T extends { productId: string; quantity: number }>(
  rows: T[],
  productId: string,
  delta: number,
): T[] {
  return rows.map((row) =>
    row.productId === productId ? { ...row, quantity: row.quantity + delta } : row,
  );
}

/**
 * Re-apply queued wholesale writes after a snapshot so an in-flight issue/purchase
 * is not wiped by stale server quantities.
 */
export function overlayPendingWholesaleStock<T extends { productId: string; quantity: number }>(
  stock: T[],
  outbox: OpenOutboxRow[],
): T[] {
  let next = stock;
  for (const row of outbox) {
    if (!isOpenOutbox(row)) continue;
    try {
      const payload = JSON.parse(row.payloadJson) as {
        productId?: string;
        quantity?: number;
        items?: Array<{ productId: string; quantity: number }>;
      };
      if (row.type === "wholesale_transfer" && payload.productId) {
        next = bumpQty(next, payload.productId, -(Number(payload.quantity) || 0));
      }
      if (row.type === "record_wholesale_purchase") {
        for (const item of payload.items ?? []) {
          next = bumpQty(next, item.productId, Number(item.quantity) || 0);
        }
      }
    } catch {
      /* ignore malformed payloads */
    }
  }
  return next;
}

export function overlayPendingBranchStock<
  T extends { branchId: string; productId: string; quantity: number; sellableQuantity: number },
>(stock: T[], outbox: OpenOutboxRow[]): T[] {
  let next = stock;
  for (const row of outbox) {
    if (!isOpenOutbox(row) || row.type !== "wholesale_transfer") continue;
    try {
      const payload = JSON.parse(row.payloadJson) as {
        productId?: string;
        branchId?: string;
        quantity?: number;
      };
      const qty = Number(payload.quantity) || 0;
      if (!payload.productId || !payload.branchId || qty === 0) continue;
      next = next.map((item) =>
        item.productId === payload.productId && item.branchId === payload.branchId
          ? {
              ...item,
              quantity: item.quantity + qty,
              sellableQuantity: item.sellableQuantity + qty,
            }
          : item,
      );
    } catch {
      /* ignore */
    }
  }
  return next;
}

/** Last-line UI guard: one stock row per product, prefer the server id. */
export function dedupeByProductId<T extends { id: string; productId: string }>(rows: T[]): T[] {
  const byProduct = new Map<string, T>();
  for (const row of rows) {
    const current = byProduct.get(row.productId);
    if (!current) {
      byProduct.set(row.productId, row);
      continue;
    }
    const preferIncoming = !row.id.startsWith("local_") && current.id.startsWith("local_");
    if (preferIncoming) byProduct.set(row.productId, row);
  }
  return [...byProduct.values()];
}
