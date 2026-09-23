import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import {
  DEFAULT_PRODUCT_IMAGES_POLICY,
  parseProductImagesPolicy,
  type ProductImagesPolicy,
} from "@/convex/shared/productImagesPolicy";

export async function saveProductImagesPolicyCache(policy: ProductImagesPolicy): Promise<void> {
  const db = await getOfflineDb();
  if (!db) return;
  await setMeta(db, META_KEYS.productImagesPolicy, JSON.stringify(policy));
}

export async function loadProductImagesPolicyCache(): Promise<ProductImagesPolicy> {
  const db = await getOfflineDb();
  if (!db) return { ...DEFAULT_PRODUCT_IMAGES_POLICY };
  const raw = await getMeta(db, META_KEYS.productImagesPolicy);
  return parseProductImagesPolicy(raw ?? undefined);
}
