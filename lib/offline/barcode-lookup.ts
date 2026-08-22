/** Shared Dexie barcode matching — never call Convex for a scan lookup. */

export function normalizeBarcodeInput(value: string): string {
  return value.normalize("NFKC").trim();
}

export function barcodesEqual(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = (left ?? "").trim().toLowerCase();
  const b = (right ?? "").trim().toLowerCase();
  if (!a || !b) return false;
  return a === b;
}

/** Exact barcode match, with SKU as fallback for products that have no barcode. */
export function productMatchesBarcode(
  product: { sku: string; barcode?: string | null },
  code: string,
): boolean {
  const n = normalizeBarcodeInput(code).toLowerCase();
  if (!n) return false;
  if ((product.barcode ?? "").trim().toLowerCase() === n) return true;
  return product.sku.toLowerCase() === n;
}

export function productMatchesQuery(
  product: { name: string; sku: string; barcode?: string | null },
  search: string,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (product.name.toLowerCase().includes(q)) return true;
  if (product.sku.toLowerCase().includes(q)) return true;
  return (product.barcode ?? "").toLowerCase().includes(q);
}

export const BARCODE_ALREADY_ASSIGNED =
  "This barcode is already assigned to another product in your organization.";
