/**
 * Cart-side price list resolution (customer_pricing).
 * Mirrors Convex/offline completeSale so the till total matches the receipt.
 */

import { resolveUnitPrice, type PriceListRuleLike } from "@/convex/shared/pricing";
import type { ResolvedSellUnit } from "@/convex/shared/units";
import { getOfflineDb } from "@/lib/offline/db";
import { customerGroupIdFor, loadActivePriceRules } from "@/lib/offline/price-lists";

export async function resolveCartLineUnitPrice(input: {
  productId: string;
  sellUnit: ResolvedSellUnit;
  displayedQuantity: number;
  customerId?: string | null;
  pricingEnabled: boolean;
}): Promise<number> {
  if (!input.pricingEnabled || input.sellUnit.pricingMode === "per_weight") {
    return input.sellUnit.unitPrice;
  }
  const db = await getOfflineDb();
  if (!db) return input.sellUnit.unitPrice;

  const product = await db.products.get(input.productId);
  if (!product) return input.sellUnit.unitPrice;

  const rules: PriceListRuleLike[] = await loadActivePriceRules(db);
  if (rules.length === 0) return input.sellUnit.unitPrice;

  const customerGroupId = await customerGroupIdFor(db, input.customerId ?? undefined);
  const baseQuantity = input.displayedQuantity * input.sellUnit.factorToBase;
  return resolveUnitPrice(rules, {
    productId: product.id,
    categoryId: product.categoryId,
    customerGroupId,
    baseQuantity,
    factorToBase: input.sellUnit.factorToBase,
    pricingMode: input.sellUnit.pricingMode,
    sellUnitPrice: input.sellUnit.unitPrice,
    productSellingPrice: product.sellingPrice,
  }).unitPrice;
}
