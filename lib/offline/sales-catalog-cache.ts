/**
 * In-process Sales catalog cache for Dexie-first tills (Millie's FULLY_OFFLINE).
 * Avoids reloading every active product + branch stock map on each keystroke.
 */

import { replicaWriteEpoch } from "./replica-events";
import type { NovendOfflineDb } from "./db";
import { branchStockMapForBranch } from "./branch-stock";
import { normalizeBarcodeInput } from "./barcode-lookup";
import type { MirroredBranchStock, MirroredProduct } from "./types";

type WarmCatalog = {
  epoch: number;
  products: MirroredProduct[];
  byId: Map<string, MirroredProduct>;
  /** Lowercased barcode / SKU / sell-unit barcode → product ids */
  barcodeIndex: Map<string, string[]>;
  stockByBranch: Map<string, Map<string, MirroredBranchStock>>;
};

let warm: WarmCatalog | null = null;

function indexBarcode(map: Map<string, string[]>, code: string | null | undefined, productId: string) {
  const key = normalizeBarcodeInput(code ?? "").toLowerCase();
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    if (!existing.includes(productId)) existing.push(productId);
  } else {
    map.set(key, [productId]);
  }
}

function buildBarcodeIndex(products: MirroredProduct[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const product of products) {
    indexBarcode(map, product.barcode, product.id);
    indexBarcode(map, product.sku, product.id);
    for (const unit of product.sellUnits ?? []) {
      if (unit.active === false) continue;
      indexBarcode(map, unit.barcode, product.id);
    }
  }
  return map;
}

/** Drop warm catalog (tests / forced rebuild). */
export function clearSalesCatalogCache() {
  warm = null;
}

async function ensureWarmCatalog(db: NovendOfflineDb): Promise<WarmCatalog> {
  const epoch = replicaWriteEpoch();
  if (warm && warm.epoch === epoch) return warm;

  const products = (await db.products.where("status").equals("active").toArray()).filter(
    (p) => p.isVariantParent !== true,
  );
  const byId = new Map(products.map((p) => [p.id, p]));
  warm = {
    epoch,
    products,
    byId,
    barcodeIndex: buildBarcodeIndex(products),
    stockByBranch: new Map(),
  };
  return warm;
}

/** Active sellable products (variant parents excluded), warmed once until replica writes. */
export async function getCachedActiveCatalogProducts(
  db: NovendOfflineDb,
): Promise<MirroredProduct[]> {
  const catalog = await ensureWarmCatalog(db);
  return catalog.products;
}

/** Branch stock map, warmed per branch until replica writes. */
export async function getCachedBranchStockMap(
  db: NovendOfflineDb,
  branchId: string,
): Promise<Map<string, MirroredBranchStock>> {
  const catalog = await ensureWarmCatalog(db);
  const hit = catalog.stockByBranch.get(branchId);
  if (hit) return hit;
  const map = await branchStockMapForBranch(db, branchId);
  catalog.stockByBranch.set(branchId, map);
  return map;
}

/**
 * Exact barcode / SKU / sell-unit barcode hits from the warm index.
 * Empty means no indexed match (caller may fall back only if needed).
 */
export async function getCachedProductsByBarcode(
  db: NovendOfflineDb,
  code: string,
): Promise<MirroredProduct[]> {
  const catalog = await ensureWarmCatalog(db);
  const key = normalizeBarcodeInput(code).toLowerCase();
  if (!key) return [];
  const ids = catalog.barcodeIndex.get(key);
  if (!ids?.length) return [];
  return ids
    .map((id) => catalog.byId.get(id))
    .filter((row): row is MirroredProduct => Boolean(row));
}

/** Single product from warm catalog, or Dexie get if cache miss / stale id. */
export async function getCachedProductById(
  db: NovendOfflineDb,
  productId: string,
): Promise<MirroredProduct | undefined> {
  const catalog = await ensureWarmCatalog(db);
  const hit = catalog.byId.get(productId);
  if (hit) return hit;
  return db.products.get(productId);
}
