/**
 * Compact business snapshot for `snapshot_only` organizations.
 *
 * Smaller than a full Dexie dump: curated tables, recent sales window, no
 * product image blobs, empty outbox on restore. Uses the same encrypted
 * envelope as full backups so restore tooling stays shared.
 */

import { getOfflineDb } from "./db";
import type { OfflineBackupPayload } from "./backup";

/** Sales / returns older than this are omitted from compact snapshots. */
export const COMPACT_SNAPSHOT_HISTORY_MS = 90 * 24 * 60 * 60 * 1000;

const SNAPSHOT_VERSION = 1;

const ALWAYS_TABLES = [
  "meta",
  "products",
  "branchStock",
  "categories",
  "customers",
  "heldSales",
  "suppliers",
  "wholesaleStock",
  "wholesalePurchases",
  "supplierPayments",
  "wholesaleTransfers",
  "branches",
  "users",
  "expenses",
  "lots",
] as const;

const TIME_FILTERED_TABLES = [
  "localSales",
  "localSaleItems",
  "localReceipts",
  "localReturns",
  "localReturnItems",
  "orders",
  "orderItems",
  "returns",
] as const;

function rowTime(row: unknown): number {
  if (!row || typeof row !== "object") return 0;
  const record = row as Record<string, unknown>;
  for (const key of ["completedAt", "createdAt", "updatedAt", "soldAt", "returnedAt"]) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

function filterRecent(rows: unknown[], now: number): unknown[] {
  const cutoff = now - COMPACT_SNAPSHOT_HISTORY_MS;
  return rows.filter((row) => {
    const at = rowTime(row);
    return at === 0 || at >= cutoff;
  });
}

/** Build a compact OfflineBackupPayload suitable for snapshot_only uploads. */
export async function exportCompactSnapshot(): Promise<OfflineBackupPayload> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local database is not available on this device");

  const now = Date.now();
  const tables: Record<string, unknown[]> = {};

  for (const name of ALWAYS_TABLES) {
    try {
      tables[name] = await db.table(name).toArray();
    } catch {
      tables[name] = [];
    }
  }

  for (const name of TIME_FILTERED_TABLES) {
    try {
      const rows = await db.table(name).toArray();
      tables[name] = filterRecent(rows, now);
    } catch {
      tables[name] = [];
    }
  }

  // Never ship pending outbox or product image blobs in compact snapshots.
  tables.outbox = [];
  tables.productImages = [];

  return {
    version: 2,
    exportedAt: now,
    organizationId:
      typeof window !== "undefined"
        ? (window.localStorage.getItem("novend.offlineOrganizationId") ?? undefined)
        : undefined,
    userId:
      typeof window !== "undefined"
        ? (window.localStorage.getItem("novend.offlineUserId") ?? undefined)
        : undefined,
    tables,
    snapshotVersion: SNAPSHOT_VERSION,
  };
}
