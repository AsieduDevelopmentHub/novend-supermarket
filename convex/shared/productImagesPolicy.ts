/**
 * Organization policy for product catalog image uploads.
 * Key: `catalog.productImages` → `{ enabled: boolean }` (default enabled).
 */

export const PRODUCT_IMAGES_SETTINGS_KEY = "catalog.productImages";

export type ProductImagesPolicy = {
  enabled: boolean;
};

export const DEFAULT_PRODUCT_IMAGES_POLICY: ProductImagesPolicy = {
  enabled: true,
};

export const PRODUCT_IMAGES_DISABLED_MESSAGE =
  "Product image uploads are disabled for this organization.";

/** Parse stored JSON; missing / invalid → uploads enabled. */
export function parseProductImagesPolicy(raw: string | undefined): ProductImagesPolicy {
  if (!raw) return { ...DEFAULT_PRODUCT_IMAGES_POLICY };
  try {
    const parsed = JSON.parse(raw) as Partial<ProductImagesPolicy>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : true,
    };
  } catch {
    return { ...DEFAULT_PRODUCT_IMAGES_POLICY };
  }
}

/** Throw when the org forbids attaching a new product image. */
export function assertProductImageUploadsEnabled(policy: ProductImagesPolicy): void {
  if (!policy.enabled) {
    throw new Error(PRODUCT_IMAGES_DISABLED_MESSAGE);
  }
}

/** Whether a new image may be attached (clear/remove is always allowed). */
export function canAttachProductImage(policy: ProductImagesPolicy): boolean {
  return policy.enabled;
}
