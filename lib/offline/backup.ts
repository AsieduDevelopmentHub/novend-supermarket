import { brandedDocumentName } from "@/lib/export-filenames";
import { getOfflineDb } from "./db";
import { Hardware, isCapacitor } from "@novend/hardware";

const TABLE_NAMES = [
  "meta",
  "products",
  "branchStock",
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
  "suppliers",
  "wholesaleStock",
  "wholesalePurchases",
  "wholesaleTransfers",
  "branches",
  "users",
  "expenses",
  "returns",
  "outbox",
] as const;

const BACKUP_VERSION = 2;
const SUPPORTED_VERSIONS = new Set([1, 2]);
const LAST_BACKUP_KEY = "novend.backup.lastAt";

export type OfflineBackupPayload = {
  version: number;
  exportedAt: number;
  tables: Record<string, unknown[]>;
};

/** Export all Dexie tables to a portable JSON backup (excludes product image blobs). */
export async function exportOfflineBackup(): Promise<OfflineBackupPayload> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local database is not available on this device");

  const tables: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    try {
      tables[name] = await db.table(name).toArray();
    } catch {
      tables[name] = [];
    }
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

async function rememberBackupTime(exportedAt: number) {
  try {
    if (isCapacitor()) {
      const { Preferences } = await import("@capacitor/preferences");
      await Preferences.set({ key: LAST_BACKUP_KEY, value: String(exportedAt) });
    } else if (typeof localStorage !== "undefined") {
      localStorage.setItem(LAST_BACKUP_KEY, String(exportedAt));
    }
  } catch {
    /* ignore */
  }
}

export async function getLastBackupAt(): Promise<number | null> {
  try {
    if (isCapacitor()) {
      const { Preferences } = await import("@capacitor/preferences");
      const stored = await Preferences.get({ key: LAST_BACKUP_KEY });
      return stored.value ? Number(stored.value) : null;
    }
    if (typeof localStorage !== "undefined") {
      const raw = localStorage.getItem(LAST_BACKUP_KEY);
      return raw ? Number(raw) : null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export async function estimateBackupSize(): Promise<number> {
  const payload = await exportOfflineBackup();
  return new Blob([JSON.stringify(payload)]).size;
}

export async function downloadOfflineBackup() {
  const payload = await exportOfflineBackup();
  const stamp = new Date(payload.exportedAt).toISOString().slice(0, 10);
  const filename = brandedDocumentName("Offline-Backup", stamp, "json");

  if (isCapacitor()) {
    const text = JSON.stringify(payload, null, 2);
    const bytes = new TextEncoder().encode(text);
    const saved = await Hardware.filesystem.saveImage(bytes, filename);
    if (!saved.ok) throw new Error(saved.message || "Could not save backup");
  } else {
    downloadJson(filename, payload);
  }

  await rememberBackupTime(payload.exportedAt);
  return payload;
}

/** Replace local Dexie contents from a backup file. */
export async function importOfflineBackup(payload: OfflineBackupPayload) {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local database is not available on this device");
  if (!SUPPORTED_VERSIONS.has(payload.version)) {
    throw new Error("Unsupported backup version");
  }

  await db.transaction("rw", [...TABLE_NAMES], async () => {
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
