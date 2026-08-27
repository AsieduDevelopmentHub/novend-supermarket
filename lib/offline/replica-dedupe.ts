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

/** Snapshot merge: server rows plus only still-pending optimistic local_* rows. */
export function mergeServerAndLocalById<T extends { id: string }>(
  serverRows: T[],
  localRows: T[],
  pendingIds: Set<string>,
): T[] {
  return [...serverRows, ...keepPendingLocalRows(localRows, pendingIds)];
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
