import type { NovendOfflineDb } from "./db";
import { getMeta, META_KEYS, setMeta } from "./db";

const DEFAULT_SYNCED_OUTBOX_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_SYNCED_SALE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Prune stale synced outbox rows and old synced local sales/receipts.
 * Keeps IndexedDB lean during long offline / multi-day operation.
 */
export async function cleanupStaleOfflineRecords(
  db: NovendOfflineDb,
  options?: {
    syncedOutboxMaxAgeMs?: number;
    syncedSaleMaxAgeMs?: number;
  },
): Promise<{ outboxRemoved: number; salesRemoved: number; receiptsRemoved: number }> {
  const outboxMaxAge = options?.syncedOutboxMaxAgeMs ?? DEFAULT_SYNCED_OUTBOX_MAX_AGE_MS;
  const saleMaxAge = options?.syncedSaleMaxAgeMs ?? DEFAULT_SYNCED_SALE_MAX_AGE_MS;
  const now = Date.now();

  const syncedOutbox = await db.outbox.where("status").equals("synced").toArray();
  const staleOutbox = syncedOutbox.filter((row) => now - row.updatedAt > outboxMaxAge);
  if (staleOutbox.length > 0) {
    await db.outbox.bulkDelete(staleOutbox.map((row) => row.id));
  }

  const syncedSales = await db.localSales.where("syncStatus").equals("synced").toArray();
  const staleSales = syncedSales.filter((sale) => now - sale.completedAt > saleMaxAge);
  let receiptsRemoved = 0;
  if (staleSales.length > 0) {
    const saleIds = staleSales.map((s) => s.id);
    const receipts = await db.localReceipts.where("localSaleId").anyOf(saleIds).toArray();
    if (receipts.length > 0) {
      await db.localReceipts.bulkDelete(receipts.map((r) => r.id));
      receiptsRemoved = receipts.length;
    }
    const items = await db.localSaleItems.where("localSaleId").anyOf(saleIds).toArray();
    if (items.length > 0) {
      await db.localSaleItems.bulkDelete(items.map((i) => i.id));
    }
    await db.localSales.bulkDelete(saleIds);
  }

  const syncedReturns = await db.localReturns.where("syncStatus").equals("synced").toArray();
  const staleReturns = syncedReturns.filter((row) => now - row.completedAt > saleMaxAge);
  if (staleReturns.length > 0) {
    const returnIds = staleReturns.map((row) => row.id);
    const returnItems = await db.localReturnItems.where("localReturnId").anyOf(returnIds).toArray();
    if (returnItems.length > 0) {
      await db.localReturnItems.bulkDelete(returnItems.map((item) => item.id));
    }
    await db.localReturns.bulkDelete(returnIds);
  }

  await setMeta(db, META_KEYS.lastCleanupAt, String(now));

  return {
    outboxRemoved: staleOutbox.length,
    salesRemoved: staleSales.length,
    receiptsRemoved,
  };
}

/** Recover rows left in `syncing` after a crash / tab kill. */
export async function recoverInterruptedSync(db: NovendOfflineDb): Promise<number> {
  const stuck = await db.outbox.where("status").equals("syncing").toArray();
  if (stuck.length === 0) return 0;
  const now = Date.now();
  await db.outbox.bulkPut(
    stuck.map((row) => ({
      ...row,
      status: "pending" as const,
      lastError: row.lastError || "Recovered after interrupted sync",
      updatedAt: now,
    })),
  );
  return stuck.length;
}

export async function recordSyncDiagnostics(
  db: NovendOfflineDb,
  stats: { processed: number; failed: number; error?: string | null },
) {
  const now = Date.now();
  await setMeta(db, META_KEYS.lastSyncAt, String(now));
  await setMeta(db, META_KEYS.lastSyncProcessed, String(stats.processed));
  await setMeta(db, META_KEYS.lastSyncFailed, String(stats.failed));
  if (stats.error) {
    await setMeta(db, META_KEYS.lastSyncError, stats.error);
  } else {
    const existing = await getMeta(db, META_KEYS.lastSyncError);
    if (existing) await setMeta(db, META_KEYS.lastSyncError, "");
  }
}
