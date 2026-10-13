/**
 * Product variants (product_variants capability).
 * Parents are catalog-only; children are sellable SKUs with their own stock.
 */

export type VariantAttribute = { key: string; value: string };

export const MAX_VARIANT_ATTRIBUTES = 6;
export const MAX_CUSTOM_FIELD_VALUES = 8;

export function formatVariantLabel(attributes: VariantAttribute[]): string {
  return attributes
    .map((row) => row.value.trim())
    .filter(Boolean)
    .join(" / ");
}

export function sanitizeVariantAttributes(
  attributes: VariantAttribute[] | null | undefined,
): VariantAttribute[] {
  if (!attributes?.length) return [];
  const cleaned: VariantAttribute[] = [];
  for (const row of attributes.slice(0, MAX_VARIANT_ATTRIBUTES)) {
    const key = row.key.trim().slice(0, 32);
    const value = row.value.trim().slice(0, 64);
    if (!key || !value) continue;
    cleaned.push({ key, value });
  }
  return cleaned;
}

export function sanitizeCustomValues(
  values: Array<{ key: string; value: string }> | null | undefined,
): Array<{ key: string; value: string }> {
  if (!values?.length) return [];
  const cleaned: Array<{ key: string; value: string }> = [];
  for (const row of values.slice(0, MAX_CUSTOM_FIELD_VALUES)) {
    const key = row.key.trim().slice(0, 40);
    const value = row.value.trim().slice(0, 120);
    if (!key || !value) continue;
    cleaned.push({ key, value });
  }
  return cleaned;
}

/** Parents must never be sold or deducted as stock lines. */
export function assertSellableProduct(product: {
  isVariantParent?: boolean | null;
  name?: string;
}): void {
  if (product.isVariantParent === true) {
    throw new Error(
      `Choose a variant of ${product.name ?? "this product"} — the parent is not sold directly.`,
    );
  }
}

export function catalogDisplayName(product: {
  name: string;
  variantLabel?: string | null;
  isVariantParent?: boolean | null;
}): string {
  if (product.isVariantParent) return product.name;
  if (product.variantLabel?.trim()) return `${product.name} · ${product.variantLabel.trim()}`;
  return product.name;
}

/** POS / offline catalog: hide parents; children remain sellable. */
export function isSellableCatalogProduct(product: {
  status: string;
  isVariantParent?: boolean | null;
}): boolean {
  return product.status === "active" && product.isVariantParent !== true;
}
