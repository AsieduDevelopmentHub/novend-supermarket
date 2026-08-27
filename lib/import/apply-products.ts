import { notifyReplicaChanged } from "@/lib/offline/replica-events";
import { getOfflineDb } from "@/lib/offline/db";
import { queueCreateCategory, queueUpsertProduct } from "@/lib/offline/replica-writes";
import type { PreparedImportRow } from "./validate-products";

export type ImportApplyResult = {
  created: number;
  updated: number;
  failed: Array<{ rowNumber: number; sku: string; message: string }>;
};

function categoryKey(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Apply a fully validated preview. Writes Dexie + outbox, then one replica
 * notify. Does not start writing until every row in `rows` is attempted
 * sequentially; a failure on one row does not roll back earlier rows, so the
 * wizard must only pass the validated set.
 */
export async function applyProductImport(args: {
  rows: PreparedImportRow[];
  branchId: string;
  online: boolean;
}): Promise<ImportApplyResult> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");

  const categories = await db.categories.toArray();
  const byName = new Map(
    categories.filter((c) => c.isActive).map((c) => [categoryKey(c.name), c.id]),
  );

  const result: ImportApplyResult = { created: 0, updated: 0, failed: [] };

  for (const row of args.rows) {
    try {
      let categoryId = byName.get(categoryKey(row.category));
      if (!categoryId) {
        categoryId = await queueCreateCategory(row.category, { notify: false });
        byName.set(categoryKey(row.category), categoryId);
      }
      await queueUpsertProduct(
        {
          serverId: row.existingId,
          name: row.name,
          sku: row.sku,
          barcode: row.barcode,
          categoryId,
          costPrice: row.costPrice,
          sellingPrice: row.sellingPrice,
          stockQuantity: row.action === "create" ? row.quantity : 0,
          unit: row.unit,
          lowStockThreshold: row.lowStockThreshold,
          status: row.status,
          description: row.description,
          tracksExpiry: row.tracksExpiry,
          expiryAlertDays: row.expiryAlertDays,
          branchId: row.action === "create" ? args.branchId : undefined,
        },
        { notify: false },
      );
      if (row.action === "create") result.created += 1;
      else result.updated += 1;
    } catch (error) {
      result.failed.push({
        rowNumber: row.rowNumber,
        sku: row.sku,
        message: error instanceof Error ? error.message : "Could not save this row.",
      });
    }
  }

  notifyReplicaChanged({ flush: args.online });
  return result;
}
