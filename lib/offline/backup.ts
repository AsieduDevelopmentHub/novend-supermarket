import { getOfflineDb } from "./db";

const BACKUP_VERSION = 1;

export type OfflineBackupPayload = {
  version: number;
  exportedAt: number;
  tables: Record<string, unknown[]>;
};

const TABLE_NAMES = [
  "meta",
  "products",
  "categories",
  "customers",
  "orders",
  "orderItems",
  "heldSales",
  "localSales",
  "localSaleItems",
  "localReceipts",
  "localReturns",
  "localReturnItems",
  "outbox",
] as const;

/** Export all Dexie tables to a portable JSON backup. */
export async function exportOfflineBackup(): Promise<OfflineBackupPayload> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local database is not available on this device");

  const tables: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    tables[name] = await db.table(name).toArray();
  }

  return {
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    tables,
  };
}

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function downloadOfflineBackup() {
  const payload = await exportOfflineBackup();
  const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10);
  downloadJson(`novend-offline-backup-${stamp}.json`, payload);
  return payload;
}

/** Replace local Dexie contents from a backup file. */
export async function importOfflineBackup(payload: OfflineBackupPayload) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local database is not available on this device");
  if (payload.version !== BACKUP_VERSION) {
    throw new Error("Unsupported backup version");
  }

  await db.transaction("rw", TABLE_NAMES, async () => {
    for (const name of TABLE_NAMES) {
      const rows = payload.tables[name];
      const table = db.table(name);
      await table.clear();
      if (Array.isArray(rows) && rows.length > 0) {
        await table.bulkPut(rows);
      }
    }
  });
}

export async function readBackupFile(file: File): Promise<OfflineBackupPayload> {
  const text = await file.text();
  const parsed = JSON.parse(text) as OfflineBackupPayload;
  if (!parsed || typeof parsed !== "object" || !parsed.tables) {
    throw new Error("Invalid backup file");
  }
  return parsed;
}
