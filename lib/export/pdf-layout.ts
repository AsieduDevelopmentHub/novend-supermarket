import type { ExportColumn, ExportTable } from "./types";

const IMAGE_EXT = /\.(avif|gif|jpe?g|png|svg|webp)(\?|#|$)/i;

/** True when the cell is a picture we could show, not a storage URL dump. */
export function isActualImageRef(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text) return false;
  if (text.startsWith("data:image/")) return true;
  return IMAGE_EXT.test(text);
}

export function looksLikeUrl(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^(https?:\/\/|data:|blob:)/i.test(value.trim());
}

function isImageColumn(col: ExportColumn): boolean {
  return col.key === "imageUrl" || /^image$/i.test(col.header.trim());
}

/**
 * PDF is a readable report, not a data dump. Drop image URL columns unless a
 * row has a real image file/data URI — and even then print Yes, not the URL.
 */
export function pdfView(table: ExportTable): {
  columns: ExportColumn[];
  rows: Record<string, unknown>[];
} {
  const columns = table.columns.filter((col) => {
    if (!isImageColumn(col)) return true;
    return table.rows.some((row) => isActualImageRef(row[col.key]));
  });

  const rows = table.rows.map((row) => {
    const next: Record<string, unknown> = { ...row };
    for (const col of columns) {
      if (!isImageColumn(col)) continue;
      next[col.key] = isActualImageRef(row[col.key]) ? "Yes" : "";
    }
    return next;
  });

  return { columns, rows };
}

const NARROW = new Set([
  "sku",
  "barcode",
  "unit",
  "status",
  "stockQuantity",
  "lowStockThreshold",
  "costPrice",
  "sellingPrice",
  "orders",
  "itemsSold",
  "refunds",
  "tracksExpiry",
  "expiryAlertDays",
]);

const WIDE = new Set(["name", "description", "productName", "label", "note"]);

export function pdfColumnWidths(columns: ExportColumn[], usable: number): number[] {
  const weights = columns.map((col) => {
    if (NARROW.has(col.key)) return 0.7;
    if (WIDE.has(col.key)) return 1.8;
    return 1;
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  return weights.map((w) => (w / total) * usable);
}
