/**
 * In-process product/inventory list cache for Dexie-first tills (Millie's).
 * Warm Maps avoid reloading every product + lots + branch stock on each list open.
 * Sales keeps its leaner active-only cache in sales-catalog-cache.ts.
 */

import { replicaWriteEpoch } from "./replica-events";
import type { NovendOfflineDb } from "./db";
import {
  branchStockMapForBranch,
  branchStockMapOrgWide,
  type AggregatedBranchStock,
} from "./branch-stock";
import { normalizeBarcodeInput, productMatchesQuery } from "./barcode-lookup";
import type { MirroredBranch, MirroredBranchStock, MirroredLot, MirroredProduct } from "./types";

export type ProductListWarmIndex = {
  epoch: number;
  /** Non-archived products (active + inactive). */
  nonArchived: MirroredProduct[];
  /** Active only. */
  active: MirroredProduct[];
  byId: Map<string, MirroredProduct>;
  /** Lowercased barcode / SKU / sell-unit barcode → product ids */
  barcodeIndex: Map<string, string[]>;
  /** productId → lots with quantity > 0 */
  lotsByProduct: Map<string, MirroredLot[]>;
  /** `${productId}:${branchId}` → lots with quantity > 0 */
  lotsByProductBranch: Map<string, MirroredLot[]>;
  /** productId → all branch stock rows */
  branchStockByProduct: Map<string, MirroredBranchStock[]>;
  /** Lazy per-branch productId → stock row */
  stockByBranch: Map<string, Map<string, MirroredBranchStock>>;
  /** Lazy org-wide aggregated stock by productId */
  orgWideStock: Map<string, AggregatedBranchStock> | null;
  branches: MirroredBranch[];
  branchNameById: Map<string, string>;
};

let warm: ProductListWarmIndex | null = null;

function lotProductBranchKey(productId: string, branchId: string): string {
  return `${productId}:${branchId}`;
}

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

function indexLots(lots: MirroredLot[]): {
  lotsByProduct: Map<string, MirroredLot[]>;
  lotsByProductBranch: Map<string, MirroredLot[]>;
} {
  const lotsByProduct = new Map<string, MirroredLot[]>();
  const lotsByProductBranch = new Map<string, MirroredLot[]>();
  for (const lot of lots) {
    if (lot.quantity <= 0) continue;
    const byProduct = lotsByProduct.get(lot.productId);
    if (byProduct) byProduct.push(lot);
    else lotsByProduct.set(lot.productId, [lot]);

    const key = lotProductBranchKey(lot.productId, lot.branchId);
    const byBranch = lotsByProductBranch.get(key);
    if (byBranch) byBranch.push(lot);
    else lotsByProductBranch.set(key, [lot]);
  }
  return { lotsByProduct, lotsByProductBranch };
}

function indexBranchStock(rows: MirroredBranchStock[]): Map<string, MirroredBranchStock[]> {
  const map = new Map<string, MirroredBranchStock[]>();
  for (const row of rows) {
    const existing = map.get(row.productId);
    if (existing) existing.push(row);
    else map.set(row.productId, [row]);
  }
  return map;
}

/** Drop warm index (tests / forced rebuild). */
export function clearProductListCache() {
  warm = null;
}

async function ensureWarmIndex(db: NovendOfflineDb): Promise<ProductListWarmIndex> {
  const epoch = replicaWriteEpoch();
  if (warm && warm.epoch === epoch) return warm;

  const [allProducts, lots, branchStockRows, branches] = await Promise.all([
    db.products.toArray(),
    db.lots.toArray(),
    db.branchStock.toArray(),
    db.branches.toArray(),
  ]);

  const nonArchived = allProducts.filter((p) => p.status !== "archived");
  const active = nonArchived.filter((p) => p.status === "active");
  const { lotsByProduct, lotsByProductBranch } = indexLots(lots);

  warm = {
    epoch,
    nonArchived,
    active,
    byId: new Map(nonArchived.map((p) => [p.id, p])),
    barcodeIndex: buildBarcodeIndex(nonArchived),
    lotsByProduct,
    lotsByProductBranch,
    branchStockByProduct: indexBranchStock(branchStockRows),
    stockByBranch: new Map(),
    orgWideStock: null,
    branches,
    branchNameById: new Map(branches.map((b) => [b.id, b.name])),
  };
  return warm;
}

/** Warm admin/list catalog (active or non-archived). */
export async function getCachedListProducts(
  db: NovendOfflineDb,
  includeInactive: boolean,
): Promise<MirroredProduct[]> {
  const index = await ensureWarmIndex(db);
  return includeInactive ? index.nonArchived : index.active;
}

export async function getCachedProductListIndex(
  db: NovendOfflineDb,
): Promise<ProductListWarmIndex> {
  return ensureWarmIndex(db);
}

/** Exact barcode / SKU / sell-unit barcode hits from the warm admin index. */
export async function getCachedListProductsByBarcode(
  db: NovendOfflineDb,
  code: string,
): Promise<MirroredProduct[]> {
  const index = await ensureWarmIndex(db);
  const key = normalizeBarcodeInput(code).toLowerCase();
  if (!key) return [];
  const ids = index.barcodeIndex.get(key);
  if (!ids?.length) return [];
  return ids
    .map((id) => index.byId.get(id))
    .filter((row): row is MirroredProduct => Boolean(row));
}

export async function getCachedListBranchStockMap(
  db: NovendOfflineDb,
  branchId: string,
): Promise<Map<string, MirroredBranchStock>> {
  const index = await ensureWarmIndex(db);
  const hit = index.stockByBranch.get(branchId);
  if (hit) return hit;
  const map = await branchStockMapForBranch(db, branchId);
  index.stockByBranch.set(branchId, map);
  return map;
}

export async function getCachedListOrgWideStockMap(
  db: NovendOfflineDb,
): Promise<Map<string, AggregatedBranchStock>> {
  const index = await ensureWarmIndex(db);
  if (index.orgWideStock) return index.orgWideStock;
  const map = await branchStockMapOrgWide(db);
  index.orgWideStock = map;
  return map;
}

export function lotsForProduct(
  index: ProductListWarmIndex,
  productId: string,
  branchFilter: string | null,
): MirroredLot[] {
  if (branchFilter == null) {
    return index.lotsByProduct.get(productId) ?? [];
  }
  return index.lotsByProductBranch.get(lotProductBranchKey(productId, branchFilter)) ?? [];
}

export function branchStockRowsForProduct(
  index: ProductListWarmIndex,
  productId: string,
): MirroredBranchStock[] {
  return index.branchStockByProduct.get(productId) ?? [];
}

/**
 * Light picker rows (transfer / selects) — stock only, no lot alert enrichment.
 */
export async function listCachedProductPickerRows(
  db: NovendOfflineDb,
  options: { branchId: string; includeInactive?: boolean; search?: string },
): Promise<Array<{ id: string; name: string; sku: string; stockQuantity: number }>> {
  let products = await getCachedListProducts(db, options.includeInactive === true);
  if (options.search?.trim()) {
    const exact = await getCachedListProductsByBarcode(db, options.search);
    if (exact.length > 0) {
      const allowed = new Set(products.map((p) => p.id));
      products = exact.filter((p) => allowed.has(p.id));
    } else {
      products = products.filter((p) => productMatchesQuery(p, options.search!));
    }
  }
  products = [...products].sort((a, b) => a.name.localeCompare(b.name));
  const stockMap = await getCachedListBranchStockMap(db, options.branchId);
  return products.map((product) => {
    const stock = stockMap.get(product.id);
    const stockQuantity = stock?.sellableQuantity ?? stock?.quantity ?? product.sellableQuantity ?? product.stockQuantity;
    return {
      id: product.id,
      name: product.name,
      sku: product.sku,
      stockQuantity,
    };
  });
}
