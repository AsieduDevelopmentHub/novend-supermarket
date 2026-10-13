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

export type SellUnitBarcodeFields = {
  key: string;
  barcode?: string | null;
  active?: boolean;
};

/**
 * Exact barcode match on product barcode, sell-unit barcode, or SKU fallback.
 * Prefer dedicated barcodes over SKU.
 */
export function productMatchesBarcode(
  product: {
    sku: string;
    barcode?: string | null;
    sellUnits?: SellUnitBarcodeFields[] | null;
  },
  code: string,
): boolean {
  return resolveBarcodeMatch(product, code) !== null;
}

/** Which identity matched the scan — used to pick the sell unit at the till. */
export type BarcodeMatchKind = "sell_unit" | "product_barcode" | "sku";

export type BarcodeMatchResolution = {
  kind: BarcodeMatchKind;
  /** Set when kind is sell_unit. */
  sellUnitKey?: string;
};

export function resolveBarcodeMatch(
  product: {
    sku: string;
    barcode?: string | null;
    sellUnits?: SellUnitBarcodeFields[] | null;
  },
  code: string,
): BarcodeMatchResolution | null {
  const n = normalizeBarcodeInput(code).toLowerCase();
  if (!n) return null;

  for (const unit of product.sellUnits ?? []) {
    if (unit.active === false) continue;
    if ((unit.barcode ?? "").trim().toLowerCase() === n) {
      return { kind: "sell_unit", sellUnitKey: unit.key };
    }
  }

  if ((product.barcode ?? "").trim().toLowerCase() === n) {
    return { kind: "product_barcode" };
  }

  if (product.sku.toLowerCase() === n) {
    return { kind: "sku" };
  }

  return null;
}

export function productMatchesQuery(
  product: {
    name: string;
    sku: string;
    barcode?: string | null;
    sellUnits?: SellUnitBarcodeFields[] | null;
  },
  search: string,
): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  if (product.name.toLowerCase().includes(q)) return true;
  if (product.sku.toLowerCase().includes(q)) return true;
  if ((product.barcode ?? "").toLowerCase().includes(q)) return true;
  for (const unit of product.sellUnits ?? []) {
    if (unit.active === false) continue;
    if ((unit.barcode ?? "").toLowerCase().includes(q)) return true;
  }
  return false;
}

export const BARCODE_ALREADY_ASSIGNED =
  "This barcode is already assigned to another product in your organization.";

/** Match active catalog rows by dedicated barcode, sell-unit barcode, or SKU. */
export function filterProductsByBarcode<
  T extends {
    sku: string;
    barcode?: string | null;
    sellUnits?: SellUnitBarcodeFields[] | null;
  },
>(catalog: T[], code: string): T[] {
  const normalized = normalizeBarcodeInput(code);
  if (!normalized) return [];
  return catalog.filter((product) => productMatchesBarcode(product, normalized));
}
