import { getOfflineDb } from "./db";
import type { MirroredProduct } from "./types";

/** Best-effort blob cache so product photos still render without the network. */
export async function cacheProductImages(products: MirroredProduct[]) {
  if (typeof fetch === "undefined") return;
  const db = await getOfflineDb();
  if (!db) return;

  for (const product of products) {
    if (!product.imageUrl) continue;
    try {
      const existing = await db.productImages.get(product.id);
      if (existing) continue;
      const response = await fetch(product.imageUrl);
      if (!response.ok) continue;
      const blob = await response.blob();
      await db.productImages.put({
        id: product.id,
        blob,
        mimeType: blob.type || "image/jpeg",
        updatedAt: Date.now(),
      });
    } catch {
      /* cache is best-effort */
    }
  }
}

export async function getCachedProductImageUrl(productId: string): Promise<string | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const row = await db.productImages.get(productId);
  if (!row) return null;
  return URL.createObjectURL(row.blob);
}
