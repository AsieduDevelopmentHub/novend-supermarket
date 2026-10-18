/**
 * Sales catalog result windows (browse vs typed search).
 * Keep aligned with `constants/sales-catalog.ts` re-exports for the client.
 *
 * Browse stays small for a snappy Quick Products grid.
 * Typed search returns **every** in-stock match — a hard cap would hide
 * products that sort after the limit on broad queries.
 */

import { tokenizeProductSearch } from "./validation";

export const SALES_CATALOG_BROWSE_LIMIT = 48;

/**
 * `null` means no cap (return all matches after filter + rank).
 * Browse-only path returns {@link SALES_CATALOG_BROWSE_LIMIT}.
 */
export function salesCatalogResultLimit(search?: string | null): number | null {
  return search?.trim() ? null : SALES_CATALOG_BROWSE_LIMIT;
}

/** Lower rank sorts first when a cashier has typed a query. */
export function catalogSearchRank(
  product: {
    name: string;
    sku: string;
    barcode?: string | null;
    variantLabel?: string | null;
  },
  q: string,
): number {
  const query = q.trim().toLowerCase();
  const name = product.name.toLowerCase();
  const sku = product.sku.toLowerCase();
  const barcode = (product.barcode ?? "").toLowerCase();
  const variant = (product.variantLabel ?? "").toLowerCase();
  if (sku === query || barcode === query) return 0;
  if (name === query || variant === query) return 1;
  if (name.startsWith(query) || sku.startsWith(query) || variant.startsWith(query)) return 2;
  const tokens = tokenizeProductSearch(query);
  if (tokens.length > 1 && tokens.every((token) => name.includes(token))) return 2;
  return 3;
}
