/**
 * Customer price lists (customer_pricing capability).
 *
 * Rule `unitPrice` is the price per BASE unit. The line price for a sell unit is
 * `unitPrice × factorToBase`, so one rule covers every pack size of a product.
 * Resolution never mutates stock; it only picks the price snapshotted on the line.
 */

import { roundMoney } from "./validation";
import type { PricingMode } from "./units";

export type PriceListRuleLike = {
  id?: string;
  productId?: string | null;
  categoryId?: string | null;
  /** Null/undefined = applies to every customer (volume tier). */
  groupId?: string | null;
  minBaseQty: number;
  /** Price per base unit. */
  unitPrice: number;
  priority: number;
  active: boolean;
};

export type PricingContext = {
  productId: string;
  categoryId: string;
  customerGroupId?: string | null;
  /** Base units on this line. */
  baseQuantity: number;
  factorToBase: number;
  pricingMode?: PricingMode | null;
  /** Price of the chosen sell unit (explicit sell-unit price or derived). */
  sellUnitPrice?: number | null;
  /** Product catalogue selling price (per base unit). */
  productSellingPrice: number;
};

export type PriceSource = "rule" | "sell_unit" | "product";

export type ResolvedUnitPrice = {
  /** Price per displayed sell unit. */
  unitPrice: number;
  source: PriceSource;
  ruleId?: string;
};

export function ruleMatchesContext(rule: PriceListRuleLike, context: PricingContext): boolean {
  if (!rule.active) return false;
  if (!rule.productId && !rule.categoryId) return false;
  if (rule.productId && rule.productId !== context.productId) return false;
  if (!rule.productId && rule.categoryId && rule.categoryId !== context.categoryId) return false;
  if (rule.groupId && rule.groupId !== (context.customerGroupId ?? null)) return false;
  return context.baseQuantity + 1e-9 >= rule.minBaseQty;
}

/** Higher wins: priority, then product over category, then group over generic, then larger tier. */
function compareRules(a: PriceListRuleLike, b: PriceListRuleLike): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const aProduct = a.productId ? 1 : 0;
  const bProduct = b.productId ? 1 : 0;
  if (aProduct !== bProduct) return bProduct - aProduct;
  const aGroup = a.groupId ? 1 : 0;
  const bGroup = b.groupId ? 1 : 0;
  if (aGroup !== bGroup) return bGroup - aGroup;
  if (a.minBaseQty !== b.minBaseQty) return b.minBaseQty - a.minBaseQty;
  return a.unitPrice - b.unitPrice;
}

export function resolveUnitPrice(
  rules: readonly PriceListRuleLike[],
  context: PricingContext,
): ResolvedUnitPrice {
  const fallbackSellUnit =
    typeof context.sellUnitPrice === "number" && Number.isFinite(context.sellUnitPrice)
      ? context.sellUnitPrice
      : null;

  // Weight-priced lines keep their scale price; rules are fixed per-base prices.
  if (context.pricingMode !== "per_weight") {
    const matches = rules.filter((rule) => ruleMatchesContext(rule, context)).sort(compareRules);
    const winner = matches[0];
    if (winner) {
      return {
        unitPrice: roundMoney(winner.unitPrice * context.factorToBase),
        source: "rule",
        ruleId: winner.id,
      };
    }
  }
  if (fallbackSellUnit !== null) {
    return { unitPrice: fallbackSellUnit, source: "sell_unit" };
  }
  return {
    unitPrice: roundMoney(context.productSellingPrice * context.factorToBase),
    source: "product",
  };
}

export function assertValidPriceRule(rule: {
  productId?: unknown;
  categoryId?: unknown;
  minBaseQty: number;
  unitPrice: number;
  priority: number;
}): void {
  if (!rule.productId && !rule.categoryId) {
    throw new Error("Choose a product or a category for this price rule");
  }
  if (!Number.isFinite(rule.unitPrice) || rule.unitPrice < 0) {
    throw new Error("Enter a valid price");
  }
  if (!Number.isFinite(rule.minBaseQty) || rule.minBaseQty < 1) {
    throw new Error("Minimum quantity must be at least 1");
  }
  if (!Number.isInteger(rule.priority) || rule.priority < 0 || rule.priority > 1000) {
    throw new Error("Priority must be a whole number between 0 and 1000");
  }
}
