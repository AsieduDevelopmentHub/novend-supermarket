/**
 * One-time migrate from early Millie's per-user Dexie DBs into the shared
 * org replica (`novend-offline-millies-local`).
 */

import { MILLIES_LOCAL_ORG_ID } from "@/constants/runtime";
import { getOfflineDb, offlineReplicaDbName } from "./db";

const LEGACY_PREFIX = `novend-offline-${MILLIES_LOCAL_ORG_ID}-`;

async function copyObjectStore(
  source: IDBDatabase,
  target: IDBDatabase,
  storeName: string,
): Promise<number> {
  if (
    !source.objectStoreNames.contains(storeName) ||
    !target.objectStoreNames.contains(storeName)
  ) {
    return 0;
  }
  const rows = await new Promise<unknown[]>((resolve, reject) => {
    const tx = source.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result as unknown[]);
    req.onerror = () => reject(req.error);
  });
  if (rows.length === 0) return 0;
  await new Promise<void>((resolve, reject) => {
    const tx = target.transaction(storeName, "readwrite");
    const store = tx.objectStore(storeName);
    for (const row of rows) {
      store.put(row);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  return rows.length;
}

function openRawDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * If the shared org replica has no products but a legacy per-user DB does,
 * copy all overlapping stores into the shared DB so cashiers see admin catalog.
 */
export async function migrateMilliesSharedReplicaIfNeeded(): Promise<void> {
  if (typeof indexedDB === "undefined" || !("databases" in indexedDB)) return;

  const sharedName = offlineReplicaDbName(MILLIES_LOCAL_ORG_ID);
  const db = await getOfflineDb();
  if (!db) return;
  const productCount = await db.products.count();
  if (productCount > 0) return;

  const listed = await indexedDB.databases();
  const legacyNames = listed
    .map((d) => d.name)
    .filter((name): name is string => Boolean(name?.startsWith(LEGACY_PREFIX)));
  if (legacyNames.length === 0) return;

  let bestName: string | null = null;
  let bestCount = 0;
  for (const name of legacyNames) {
    try {
      const legacy = await openRawDb(name);
      const count = await new Promise<number>((resolve, reject) => {
        if (!legacy.objectStoreNames.contains("products")) {
          resolve(0);
          return;
        }
        const tx = legacy.transaction("products", "readonly");
        const req = tx.objectStore("products").count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      legacy.close();
      if (count > bestCount) {
        bestCount = count;
        bestName = name;
      }
    } catch {
      /* skip unreadable legacy DB */
    }
  }
  if (!bestName || bestCount === 0) return;

  const source = await openRawDb(bestName);
  const target = await openRawDb(sharedName);
  try {
    // Skip `meta` so the active staff shell profile / session keys are not
    // overwritten by the admin who first seeded the till.
    const storeNames = Array.from(source.objectStoreNames).filter(
      (name) => name !== "meta",
    );
    for (const storeName of storeNames) {
      await copyObjectStore(source, target, storeName);
    }
  } finally {
    source.close();
    target.close();
  }
}
