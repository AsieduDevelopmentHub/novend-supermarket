/**
 * Whether a product participates in branch stock for sales / returns.
 * Non-stock catalogue items require `non_stock_sales` and tracksInventory === false.
 */

import {
  hasBusinessCapability,
  type OrganizationBusinessConfiguration,
} from "./businessCapabilities";

export type ProductInventoryFields = {
  tracksInventory?: boolean;
};

/**
 * Returns true when sales must check and deduct stock (today's default).
 * Missing tracksInventory is treated as true. Capability off always tracks.
 */
export function productTracksInventory(
  product: ProductInventoryFields,
  businessConfig: OrganizationBusinessConfiguration | null | undefined,
): boolean {
  if (!hasBusinessCapability(businessConfig, "non_stock_sales")) {
    return true;
  }
  return product.tracksInventory !== false;
}
