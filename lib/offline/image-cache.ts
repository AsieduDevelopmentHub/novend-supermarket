import { getOfflineDb } from "./db";
import { notifyReplicaChanged } from "./replica-events";
import type { MirroredProduct, ProductImageCache } from "./types";

const objectUrls = new Map<string, { url: string; updatedAt: number }>();

function rememberUrl(productId: string, blob: Blob, updatedAt: number) {
  const existing = objectUrls.get(productId);
  if (existing?.updatedAt === updatedAt) return existing.url;
  if (existing) URL.revokeObjectURL(existing.url);
  const url = URL.createObjectURL(blob);
  objectUrls.set(productId, { url, updatedAt });
  return url;
}

async function makeThumbnail(blob: Blob): Promise<Blob | undefined> {
  if (typeof createImageBitmap === "undefined") return undefined;
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      const maxEdge = 320;
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.drawImage(bitmap, 0, 0, width, height);
      const thumb = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((next) => resolve(next), "image/jpeg", 0.72),
      );
      return thumb ?? undefined;
    } finally {
      bitmap.close();
    }
  } catch {
    return undefined;
  }
}

export async function putProductImage(args: {
  productId: string;
  blob: Blob;
  mimeType?: string;
  sourceUrl?: string | null;
  localFilePath?: string | null;
}) {
  const db = await getOfflineDb();
  if (!db) return;
  const thumbnailBlob = await makeThumbnail(args.blob);
  const row: ProductImageCache = {
    id: args.productId,
    blob: args.blob,
    thumbnailBlob,
    mimeType: args.mimeType || args.blob.type || "image/jpeg",
    sourceUrl: args.sourceUrl ?? null,
    localFilePath: args.localFilePath ?? null,
    updatedAt: Date.now(),
  };
  try {
    await db.productImages.put(row);
    rememberUrl(args.productId, thumbnailBlob ?? args.blob, row.updatedAt);
    rememberUrl(`${args.productId}:t`, thumbnailBlob ?? args.blob, row.updatedAt);
    rememberUrl(`${args.productId}:f`, args.blob, row.updatedAt);
    notifyReplicaChanged();
  } catch {
    /* Schema repair in getOfflineDb; skip cache until the replica is rebuilt. */
  }
}

export async function deleteProductImage(productId: string) {
  const db = await getOfflineDb();
  if (!db) return;
  try {
    await db.productImages.delete(productId);
  } catch {
    /* best-effort */
  }
  const cached = objectUrls.get(productId);
  if (cached) {
    URL.revokeObjectURL(cached.url);
    objectUrls.delete(productId);
  }
  for (const key of [...objectUrls.keys()]) {
    if (key.startsWith(`${productId}:`)) {
      const entry = objectUrls.get(key);
      if (entry) URL.revokeObjectURL(entry.url);
      objectUrls.delete(key);
    }
  }
}

export async function rekeyProductImage(fromId: string, toId: string) {
  if (!fromId || fromId === toId) return;
  const db = await getOfflineDb();
  if (!db) return;
  let row: ProductImageCache | undefined;
  try {
    row = await db.productImages.get(fromId);
  } catch {
    return;
  }
  if (!row) return;
  await db.productImages.put({ ...row, id: toId });
  await db.productImages.delete(fromId);
  const cached = objectUrls.get(fromId);
  if (cached) {
    objectUrls.set(toId, cached);
    objectUrls.delete(fromId);
  }
}

/** Best-effort blob cache so product photos still render without the network. */
export async function cacheProductImages(products: MirroredProduct[]) {
  if (typeof fetch === "undefined") return;
  const db = await getOfflineDb();
  if (!db) return;

  for (const product of products) {
    if (!product.imageUrl || !/^https?:\/\//i.test(product.imageUrl)) continue;
    try {
      const existing = await db.productImages.get(product.id);
      if (existing?.sourceUrl === product.imageUrl) continue;
      const response = await fetch(product.imageUrl);
      if (!response.ok) continue;
      const blob = await response.blob();
      await putProductImage({
        productId: product.id,
        blob,
        mimeType: blob.type || "image/jpeg",
        sourceUrl: product.imageUrl,
      });
    } catch {
      /* cache is best-effort */
    }
  }
}

export async function resolveProductImageSrc(
  productId: string,
  remoteUrl?: string | null,
  options?: { thumbnail?: boolean },
): Promise<string | null> {
  const db = await getOfflineDb();
  if (db) {
    try {
      const row = await db.productImages.get(productId);
      if (row?.blob) {
        const preferThumb = options?.thumbnail !== false;
        const blob =
          preferThumb && row.thumbnailBlob instanceof Blob ? row.thumbnailBlob : row.blob;
        return rememberUrl(`${productId}:${preferThumb ? "t" : "f"}`, blob, row.updatedAt);
      }
    } catch {
      /* Schema repair in getOfflineDb; fall through to the remote URL. */
    }
  }
  if (remoteUrl && /^https?:\/\//i.test(remoteUrl)) return remoteUrl;
  return null;
}

export async function getCachedProductImageUrl(productId: string): Promise<string | null> {
  return resolveProductImageSrc(productId);
}
