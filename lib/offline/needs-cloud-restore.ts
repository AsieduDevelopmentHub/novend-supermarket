/**
 * Detect whether this device needs a cloud package restore before POS data is usable.
 */

import { getOfflineDb } from "./db";

/**
 * True when the local replica has no products and no local sales — typical of a
 * fresh browser profile or wiped IndexedDB after signing into backup_only /
 * snapshot_only.
 */
export async function needsCloudPackageRestore(): Promise<boolean> {
  const db = await getOfflineDb();
  if (!db) return false;
  try {
    const [products, sales] = await Promise.all([db.products.count(), db.localSales.count()]);
    return products === 0 && sales === 0;
  } catch {
    return false;
  }
}
