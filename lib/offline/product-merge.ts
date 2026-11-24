/**
 * Find / merge duplicate catalog products on Millie's Dexie till.
 * Historical sale lines keep their name/price snapshots — losers are archived.
 */

import { getOfflineDb, META_KEYS, getMeta } from "./db";
import { FULLY_OFFLINE, MILLIES_LOCAL_BRANCH_ID } from "@/constants/runtime";
import {
  applyLocalBranchStockChange,
  branchStockId,
  syncCatalogStockFromBranch,
} from "./branch-stock";
import { queueArchiveProduct } from "./replica-writes";
import { normalizeBarcodeInput } from "./barcode-lookup";
import { notifyReplicaChanged } from "./replica-events";
import type { MirroredProduct } from "./types";

export type DuplicateProductGroup = {
  key: string;
  reason: "barcode" | "sku" | "name";
  products: MirroredProduct[];
};

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Soft groups for admin Resolve duplicates. */
export async function findDuplicateProductGroups(): Promise<DuplicateProductGroup[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  const products = (await db.products.toArray()).filter((p) => p.status !== "archived");
  const groups: DuplicateProductGroup[] = [];
  const seen = new Set<string>();

  const byBarcode = new Map<string, MirroredProduct[]>();
  const bySku = new Map<string, MirroredProduct[]>();
  const byName = new Map<string, MirroredProduct[]>();

  for (const product of products) {
    const barcode = normalizeBarcodeInput(product.barcode ?? "").toLowerCase();
    if (barcode) {
      const list = byBarcode.get(barcode) ?? [];
      list.push(product);
      byBarcode.set(barcode, list);
    }
    const sku = product.sku.trim().toLowerCase();
    if (sku) {
      const list = bySku.get(sku) ?? [];
      list.push(product);
      bySku.set(sku, list);
    }
    const name = normalizeName(product.name);
    if (name) {
      const list = byName.get(name) ?? [];
      list.push(product);
      byName.set(name, list);
    }
  }

  function push(reason: DuplicateProductGroup["reason"], key: string, rows: MirroredProduct[]) {
    if (rows.length < 2) return;
    const ids = rows
      .map((r) => r.id)
      .sort()
      .join("|");
    const dedupeKey = `${reason}:${ids}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    groups.push({ key: dedupeKey, reason, products: rows });
  }

  for (const [key, rows] of byBarcode) push("barcode", key, rows);
  for (const [key, rows] of bySku) push("sku", key, rows);
  for (const [key, rows] of byName) push("name", key, rows);

  return groups.sort((a, b) => b.products.length - a.products.length);
}

/** Products that look like the draft name/sku/barcode (excluding self). */
export async function findPossibleDuplicateProducts(input: {
  name: string;
  sku?: string;
  barcode?: string;
  excludeId?: string;
}): Promise<MirroredProduct[]> {
  const db = await getOfflineDb();
  if (!db) return [];
  const name = normalizeName(input.name);
  const sku = input.sku?.trim().toLowerCase() ?? "";
  const barcode = normalizeBarcodeInput(input.barcode ?? "").toLowerCase();
  if (!name && !sku && !barcode) return [];

  const products = (await db.products.toArray()).filter(
    (p) => p.status !== "archived" && p.id !== input.excludeId,
  );
  const hits: MirroredProduct[] = [];
  for (const product of products) {
    if (barcode && normalizeBarcodeInput(product.barcode ?? "").toLowerCase() === barcode) {
      hits.push(product);
      continue;
    }
    if (sku && product.sku.trim().toLowerCase() === sku) {
      hits.push(product);
      continue;
    }
    if (name && normalizeName(product.name) === name) {
      hits.push(product);
    }
  }
  return hits.slice(0, 8);
}

/**
 * Move stock from losers onto keeper, then archive losers.
 * Does not rewrite historical sales.
 */
export async function queueMergeProducts(input: {
  keeperId: string;
  loserIds: string[];
}): Promise<void> {
  const db = await getOfflineDb();
  if (!db) throw new Error("Local storage is not available on this device.");
  const keeper = await db.products.get(input.keeperId);
  if (!keeper || keeper.status === "archived") {
    throw new Error("Choose an active product to keep");
  }
  const losers = (
    await Promise.all(input.loserIds.map((id) => db.products.get(id)))
  ).filter((row): row is MirroredProduct => Boolean(row) && row!.id !== keeper.id);
  if (losers.length === 0) throw new Error("Select at least one duplicate to merge");

  const branchId =
    (await getMeta(db, META_KEYS.profileBranchId))?.trim() ||
    (FULLY_OFFLINE ? MILLIES_LOCAL_BRANCH_ID : "");
  if (!branchId) throw new Error("Branch is required to merge stock");

  for (const loser of losers) {
    const loserStock = await db.branchStock.get(branchStockId(branchId, loser.id));
    const qty =
      loser.tracksExpiry === true
        ? Math.max(0, loserStock?.sellableQuantity ?? loser.sellableQuantity ?? 0)
        : Math.max(0, loserStock?.quantity ?? loser.stockQuantity ?? 0);
    if (qty > 0) {
      if (loser.tracksExpiry === true || keeper.tracksExpiry === true) {
        // Dated stock: move branch sellable only; lots stay on loser and go inactive with archive.
        // Prefer clearing loser branch then adding to keeper as non-lot receive when keeper is non-dated.
        if (keeper.tracksExpiry === true) {
          throw new Error(
            "Merge dated products from Inventory (move lots) or archive extras manually",
          );
        }
      }
      await applyLocalBranchStockChange(db, branchId, loser.id, -qty, loser);
      await syncCatalogStockFromBranch(db, branchId, loser.id);
      await applyLocalBranchStockChange(db, branchId, keeper.id, qty, keeper);
      await syncCatalogStockFromBranch(db, branchId, keeper.id);
    }
    if (!keeper.barcode && loser.barcode) {
      const clash = (await db.products.toArray()).find(
        (row) =>
          row.id !== keeper.id &&
          row.status !== "archived" &&
          normalizeBarcodeInput(row.barcode ?? "").toLowerCase() ===
            normalizeBarcodeInput(loser.barcode ?? "").toLowerCase(),
      );
      if (!clash) {
        await db.products.put({
          ...keeper,
          barcode: loser.barcode,
          updatedAt: Date.now(),
        });
      }
    }
    await queueArchiveProduct(loser.id);
  }

  notifyReplicaChanged({ flush: false });
}
