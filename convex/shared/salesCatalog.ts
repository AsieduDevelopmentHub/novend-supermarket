/**
 * Sales catalog result windows (browse vs typed search).
 * Keep aligned with `constants/sales-catalog.ts` re-exports for the client.
 *
 * Browse stays small for a snappy Quick Products grid.
 * Typed search is capped so low-RAM tills (e.g. 4GB KCPOS) never materialize
 * hundreds of tiles + image IDB reads on a broad query — refine the query to
 * surface later matches (results are ranked first).
 */

import { tokenizeProductSearch } from "./validation";

export const SALES_CATALOG_BROWSE_LIMIT = 48;
/** Ranked search window — keep close to browse so the till grid stays light. */
export const SALES_CATALOG_SEARCH_LIMIT = 64;

/**
 * Browse returns {@link SALES_CATALOG_BROWSE_LIMIT}.
 * Typed search returns {@link SALES_CATALOG_SEARCH_LIMIT} after filter + rank.
 */
export function salesCatalogResultLimit(search?: string | null): number {
  return search?.trim() ? SALES_CATALOG_SEARCH_LIMIT : SALES_CATALOG_BROWSE_LIMIT;
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
