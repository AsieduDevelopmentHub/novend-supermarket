import { getMeta, META_KEYS, type NovendOfflineDb } from "./db";
import type { MirroredBranchStock, MirroredProduct } from "./types";

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

export async function resolveCatalogBranchId(
  db: NovendOfflineDb,
  branchId?: string | null,
): Promise<string | null> {
  if (branchId) return branchId;
  return (await getMeta(db, META_KEYS.profileBranchId)) ?? null;
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
