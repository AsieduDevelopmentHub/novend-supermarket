import { FULLY_OFFLINE, MILLIES_LOCAL_BRANCH_ID } from "@/constants/runtime";
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

/**
 * Catalog qty used for single-store heal when branch stock is missing/stale.
 * Non-dated products treat physical on-hand as sellable — a stale sellableQuantity
 * of 0 must not mask a positive stockQuantity (Sales showed stock then refused checkout).
 */
export function catalogSellableQuantity(
  product: Pick<MirroredProduct, "tracksExpiry" | "stockQuantity" | "sellableQuantity">,
): number {
  if (product.tracksExpiry === true) {
    return Math.max(0, product.sellableQuantity ?? 0);
  }
  const onHand = Math.max(0, product.stockQuantity ?? 0);
  const sellable = product.sellableQuantity;
  if (sellable == null) return onHand;
  if (sellable <= 0 && onHand > 0) return onHand;
  return Math.max(0, sellable);
}

export function sellableFromBranchStock(
  stock: MirroredBranchStock | undefined,
  product: Pick<MirroredProduct, "tracksExpiry" | "stockQuantity" | "sellableQuantity">,
): number {
  if (!stock) return 0;
  if (product.tracksExpiry === true) {
    return Math.max(0, stock.sellableQuantity ?? 0);
  }
  // Non-dated: physical quantity is the sellable truth.
  // Never let a stale sellableQuantity of 0 hide positive on-hand.
  return Math.max(0, stock.quantity);
}

/**
 * Sellable qty for a branch, with single-store heal:
 * a zero/stale `branchStock` row can lag behind product-form stock edits that only
 * updated the catalog row — Sales then looked stocked while checkout refused.
 */
export function sellableQuantityForBranch(args: {
  stock: MirroredBranchStock | undefined;
  product: Pick<MirroredProduct, "tracksExpiry" | "stockQuantity" | "sellableQuantity">;
  branchId: string;
  profileBranchId: string | null | undefined;
}): number {
  const { stock, product, branchId, profileBranchId } = args;
  const catalogQty = catalogSellableQuantity(product);
  if (stock) {
    const fromBranch = sellableFromBranchStock(stock, product);
    if (fromBranch > 0) return fromBranch;
    if (profileBranchId && profileBranchId === branchId && catalogQty > 0) {
      return catalogQty;
    }
    return fromBranch;
  }
  return catalogQty;
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
  const profileBranchId = await getMeta(db, META_KEYS.profileBranchId);
  if (profileBranchId) return profileBranchId;
  // Millie's single-store till: never empty the Sales catalog for missing meta.
  return FULLY_OFFLINE ? MILLIES_LOCAL_BRANCH_ID : null;
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
    const sellable =
      product.tracksExpiry === true
        ? Math.max(0, stock.sellableQuantity ?? 0)
        : Math.max(0, stock.quantity);
    const stockQuantity = product.tracksExpiry === true ? sellable : Math.max(0, stock.quantity);
    return {
      stockQuantity,
      sellableQuantity: sellable,
      isExpiring: stock.isExpiring ?? product.isExpiring,
      isExpired: product.isExpired,
    };
  }
  if (legacyFallback) {
    const sellable = catalogSellableQuantity(product);
    return {
      stockQuantity: product.tracksExpiry === true ? sellable : Math.max(0, product.stockQuantity),
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
  const profileBranchId = await getMeta(db, META_KEYS.profileBranchId);
  return sellableQuantityForBranch({
    stock: row,
    product: catalog,
    branchId,
    profileBranchId,
  });
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
  const tracksExpiry = catalog.tracksExpiry === true;
  const profileBranchId =
    (await getMeta(db, META_KEYS.profileBranchId))?.trim() ||
    (FULLY_OFFLINE ? MILLIES_LOCAL_BRANCH_ID : null);
  const catalogQty = catalogSellableQuantity(catalog);

  if (existing) {
    let baseQuantity = existing.quantity;
    // Non-dated: always treat physical on-hand as the sellable base so a stale
    // sellableQuantity of 0 cannot block a sale that the catalog already shows.
    let baseSellable = tracksExpiry
      ? (existing.sellableQuantity ?? 0)
      : existing.quantity;

    if (profileBranchId === branchId && catalogQty > 0) {
      if (baseQuantity <= 0) {
        baseQuantity = Math.max(0, catalog.stockQuantity);
        baseSellable = catalogQty;
      } else if (!tracksExpiry && baseSellable <= 0) {
        baseSellable = baseQuantity;
      }
    }

    const nextQuantity = baseQuantity + quantityChange;
    const nextSellable = baseSellable + quantityChange;
    if (nextQuantity < 0 || nextSellable < 0) {
      throw new Error("Insufficient stock for this branch");
    }
    await db.branchStock.put({
      ...existing,
      quantity: nextQuantity,
      // Non-dated: keep sellable locked to physical on-hand so the desync cannot return.
      sellableQuantity: Math.max(0, tracksExpiry ? nextSellable : nextQuantity),
      updatedAt: Date.now(),
    });
    return;
  }

  if (profileBranchId !== branchId) {
    throw new Error("Insufficient stock for this branch");
  }

  const current = catalogQty;
  const next = current + quantityChange;
  if (next < 0) throw new Error("Insufficient stock for this branch");
  await db.products.put({
    ...catalog,
    stockQuantity: Math.max(0, catalog.stockQuantity + quantityChange),
    sellableQuantity: Math.max(0, current + quantityChange),
    updatedAt: Date.now(),
  });
  // Materialize the missing branch row so the next sale does not re-heal from catalog.
  if (profileBranchId === branchId) {
    await db.branchStock.put({
      id,
      branchId,
      productId,
      quantity: Math.max(0, next),
      sellableQuantity: Math.max(0, next),
      updatedAt: Date.now(),
    });
  }
}

export async function branchStockMapForBranch(
  db: NovendOfflineDb,
  branchId: string,
): Promise<Map<string, MirroredBranchStock>> {
  const rows = await db.branchStock.where("branchId").equals(branchId).toArray();
  return new Map(rows.map((row) => [row.productId, row]));
}
