import type { PriceListRuleLike } from "@/convex/shared/pricing";
import type { NovendOfflineDb } from "./db";
import type { MirroredPriceListRule } from "./types";

export function toPriceListRuleLike(rule: MirroredPriceListRule): PriceListRuleLike {
  return {
    id: rule.id,
    productId: rule.productId,
    categoryId: rule.categoryId,
    groupId: rule.groupId,
    minBaseQty: rule.minBaseQty,
    unitPrice: rule.unitPrice,
    priority: rule.priority,
    active: rule.active,
  };
}

/** Active mirrored rules for offline checkout / cart pricing. */
export async function loadActivePriceRules(db: NovendOfflineDb): Promise<PriceListRuleLike[]> {
  const rows = await db.priceListRules.toArray();
  return rows.filter((row) => row.active).map(toPriceListRuleLike);
}

/** Customer group for the buyer on this sale, from the customer mirror. */
export async function customerGroupIdFor(
  db: NovendOfflineDb,
  customerId: string | undefined,
): Promise<string | null> {
  if (!customerId) return null;
  const customer = await db.customers.get(customerId);
  return customer?.customerGroupId ?? null;
}
