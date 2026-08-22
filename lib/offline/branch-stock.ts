import { getMeta, META_KEYS, type NovendOfflineDb } from "./db";
import type { MirroredBranchStock, MirroredProduct } from "./types";

export type MirroredStockFields = {
  stockQuantity: number;
  sellableQuantity: number;
  isExpiring?: boolean;
  isExpired?: boolean;
};

export function branchStockId(branchId: string, productId: string): string {
  return `${branchId}:${productId}`;
}

export function sellableFromBranchStock(
  stock: MirroredBranchStock | undefined,
  product: Pick<MirroredProduct, "tracksExpiry" | "stockQuantity" | "sellableQuantity">,
): number {
  if (!stock) return 0;
  if (product.tracksExpiry) return stock.sellableQuantity ?? 0;
  return stock.sellableQuantity ?? stock.quantity;
}

/** Mirrors Convex resolveBranchFilter for offline list/detail queries. */
export async function resolveMirrorBranchFilter(
  db: NovendOfflineDb,
  requestedBranchId?: string | null,
): Promise<string | null> {
  const role = await getMeta(db, META_KEYS.profileRole);
  if (role === "administrator") {
    return requestedBranchId ?? null;
  }
  const profileBranchId = await getMeta(db, META_KEYS.profileBranchId);
  return requestedBranchId ?? profileBranchId ?? null;
}

export async function resolveCatalogBranchId(
  db: NovendOfflineDb,
  branchId?: string | null,
): Promise<string | null> {
  if (branchId) return branchId;
  return (await getMeta(db, META_KEYS.profileBranchId)) ?? null;
}

type AggregatedBranchStock = {
  quantity: number;
  sellableQuantity: number;
  isExpiring?: boolean;
};

export function stockFieldsFromAggregate(
  product: MirroredProduct,
  stock: AggregatedBranchStock | MirroredBranchStock | undefined,
  legacyFallback: boolean,
): MirroredStockFields {
  if (stock) {
    const sellable = product.tracksExpiry
      ? stock.sellableQuantity
      : (stock.sellableQuantity ?? stock.quantity);
    const stockQuantity = product.tracksExpiry ? sellable : stock.quantity;
    return {
      stockQuantity,
      sellableQuantity: sellable,
      isExpiring: stock.isExpiring ?? product.isExpiring,
      isExpired: product.isExpired,
    };
  }
  if (legacyFallback) {
    const sellable = product.sellableQuantity ?? product.stockQuantity;
    return {
      stockQuantity: product.tracksExpiry ? sellable : product.stockQuantity,
      sellableQuantity: sellable,
      isExpiring: product.isExpiring,
      isExpired: product.isExpired,
    };
  }
  return {
    stockQuantity: 0,
    sellableQuantity: 0,
    isExpiring: product.isExpiring,
    isExpired: product.isExpired,
  };
}

export async function branchStockMapOrgWide(
  db: NovendOfflineDb,
): Promise<Map<string, AggregatedBranchStock>> {
  const rows = await db.branchStock.toArray();
  const map = new Map<string, AggregatedBranchStock>();
  for (const row of rows) {
    const current = map.get(row.productId) ?? {
      quantity: 0,
      sellableQuantity: 0,
      isExpiring: false,
    };
    current.quantity += row.quantity;
    current.sellableQuantity += row.sellableQuantity ?? row.quantity;
    current.isExpiring = current.isExpiring || Boolean(row.isExpiring);
    map.set(row.productId, current);
  }
  return map;
}

export async function resolveMirroredProductStock(
  db: NovendOfflineDb,
  product: MirroredProduct,
  branchFilter: string | null,
  stockByProduct?: Map<string, MirroredBranchStock | AggregatedBranchStock>,
): Promise<MirroredStockFields> {
  const profileBranchId = await getMeta(db, META_KEYS.profileBranchId);
  const stock =
    stockByProduct?.get(product.id) ??
    (branchFilter
      ? ((await db.branchStock.get(branchStockId(branchFilter, product.id))) ?? undefined)
      : undefined);

  if (stock) {
    return stockFieldsFromAggregate(product, stock, false);
  }

  if (!branchFilter) {
    const rows = await db.branchStock.where("productId").equals(product.id).toArray();
    if (rows.length > 0) {
      const aggregated = rows.reduce<AggregatedBranchStock>(
        (acc, row) => ({
          quantity: acc.quantity + row.quantity,
          sellableQuantity: acc.sellableQuantity + (row.sellableQuantity ?? row.quantity),
          isExpiring: acc.isExpiring || Boolean(row.isExpiring),
        }),
        { quantity: 0, sellableQuantity: 0, isExpiring: false },
      );
      return stockFieldsFromAggregate(product, aggregated, false);
    }
  }

  const legacy = Boolean(branchFilter && profileBranchId && profileBranchId === branchFilter);
  return stockFieldsFromAggregate(product, undefined, legacy);
}

export async function getSellableQuantity(
  db: NovendOfflineDb,
  branchId: string,
  productId: string,
  product?: MirroredProduct | null,
): Promise<number> {
  const row = await db.branchStock.get(branchStockId(branchId, productId));
  const catalog = product ?? (await db.products.get(productId));
  if (!catalog || catalog.status !== "active") return 0;
  if (row) return sellableFromBranchStock(row, catalog);

  const profileBranchId = await getMeta(db, META_KEYS.profileBranchId);
  if (profileBranchId && profileBranchId === branchId) {
    return catalog.sellableQuantity ?? catalog.stockQuantity;
  }
  return 0;
}

export async function applyLocalBranchStockChange(
  db: NovendOfflineDb,
  branchId: string,
  productId: string,
  quantityChange: number,
  product?: MirroredProduct | null,
): Promise<void> {
  const catalog = product ?? (await db.products.get(productId));
  if (!catalog) throw new Error("Product not found");

  const id = branchStockId(branchId, productId);
  const existing = await db.branchStock.get(id);
  if (existing) {
    const nextQuantity = existing.quantity + quantityChange;
    const nextSellable = (existing.sellableQuantity ?? existing.quantity) + quantityChange;
    if (nextQuantity < 0 || nextSellable < 0) {
      throw new Error("Insufficient stock for this branch");
    }
    await db.branchStock.put({
      ...existing,
      quantity: nextQuantity,
      sellableQuantity: Math.max(0, nextSellable),
      updatedAt: Date.now(),
    });
    return;
  }

  const profileBranchId = await getMeta(db, META_KEYS.profileBranchId);
  if (profileBranchId !== branchId) {
    throw new Error("Insufficient stock for this branch");
  }

  const current = catalog.sellableQuantity ?? catalog.stockQuantity;
  const next = current + quantityChange;
  if (next < 0) throw new Error("Insufficient stock for this branch");
  await db.products.put({
    ...catalog,
    stockQuantity: catalog.stockQuantity + quantityChange,
    sellableQuantity: Math.max(0, (catalog.sellableQuantity ?? catalog.stockQuantity) + quantityChange),
    updatedAt: Date.now(),
  });
}

export async function branchStockMapForBranch(
  db: NovendOfflineDb,
  branchId: string,
): Promise<Map<string, MirroredBranchStock>> {
  const rows = await db.branchStock.where("branchId").equals(branchId).toArray();
  return new Map(rows.map((row) => [row.productId, row]));
}
