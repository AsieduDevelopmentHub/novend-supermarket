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

export type AggregatedBranchStock = {
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

/** Profile branch with Millie's single-store fallback (matches adjust/sale writers). */
export async function resolveProfileBranchId(db: NovendOfflineDb): Promise<string | null> {
  const stored = (await getMeta(db, META_KEYS.profileBranchId))?.trim();
  if (stored) return stored;
  return FULLY_OFFLINE ? MILLIES_LOCAL_BRANCH_ID : null;
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
  const profileBranchId = await resolveProfileBranchId(db);
  return sellableQuantityForBranch({
    stock: row,
    product: catalog,
    branchId,
    profileBranchId,
  });
}

/**
 * After a branch stock write, set catalog qty to the branch row (do not add the
 * delta again — that inflated Millie's restocks when list/Sales healed from catalog).
 */
export async function syncCatalogStockFromBranch(
  db: NovendOfflineDb,
  branchId: string,
  productId: string,
): Promise<void> {
  const [product, stock] = await Promise.all([
    db.products.get(productId),
    db.branchStock.get(branchStockId(branchId, productId)),
  ]);
  if (!product || !stock) return;
  const tracksExpiry = product.tracksExpiry === true;
  const quantity = Math.max(0, stock.quantity);
  const sellable = tracksExpiry
    ? Math.max(0, stock.sellableQuantity ?? 0)
    : quantity;
  if (product.stockQuantity === quantity && (product.sellableQuantity ?? quantity) === sellable) {
    return;
  }
  await db.products.put({
    ...product,
    stockQuantity: quantity,
    sellableQuantity: sellable,
    updatedAt: Date.now(),
  });
}

/**
 * Millie's: when catalog shows stock but branch row is 0/missing, materialize
 * branch from catalog so Pay and Inventory agree.
 */
export async function reconcileStaleBranchStockFromCatalog(
  db: NovendOfflineDb,
  branchId?: string | null,
): Promise<number> {
  if (!FULLY_OFFLINE) return 0;
  const resolved =
    branchId?.trim() ||
    (await resolveProfileBranchId(db)) ||
    MILLIES_LOCAL_BRANCH_ID;
  const products = await db.products.toArray();
  let fixed = 0;
  for (const product of products) {
    if (product.status === "archived") continue;
    const catalogQty = catalogSellableQuantity(product);
    if (catalogQty <= 0 && product.stockQuantity <= 0) continue;
    const id = branchStockId(resolved, product.id);
    const existing = await db.branchStock.get(id);
    const branchQty = existing
      ? product.tracksExpiry === true
        ? (existing.sellableQuantity ?? 0)
        : existing.quantity
      : 0;
    if (branchQty > 0) continue;
    const quantity = Math.max(0, product.stockQuantity);
    const sellable = product.tracksExpiry === true ? catalogQty : quantity;
    if (quantity <= 0 && sellable <= 0) continue;
    await db.branchStock.put({
      id,
      branchId: resolved,
      productId: product.id,
      quantity,
      sellableQuantity: sellable,
      isExpiring: product.isExpiring,
      updatedAt: Date.now(),
    });
    fixed += 1;
  }
  return fixed;
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
  const profileBranchId = await resolveProfileBranchId(db);
  const catalogQty = catalogSellableQuantity(catalog);

  if (existing) {
    // Do not heal catalog into the base before applying a delta — that rebased
    // stale zeros onto catalog then added again, inflating restocks.
    const baseQuantity = existing.quantity;
    const baseSellable = tracksExpiry
      ? (existing.sellableQuantity ?? 0)
      : existing.quantity;

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
