/**
 * Dashboard inventory valuation helpers (admin finance cards).
 * Presentation math only — callers still enforce role / branch scope.
 */

import { roundMoney } from "./validation";

export type InventoryValueContribution = {
  cost: number;
  sell: number;
};

/** Non-stock catalogue lines contribute nothing to inventory value. */
export function inventoryValueContribution(args: {
  onHand: number;
  costPrice: number;
  sellingPrice: number;
  tracksInventory?: boolean;
}): InventoryValueContribution {
  if (args.tracksInventory === false) {
    return { cost: 0, sell: 0 };
  }
  const qty = Math.max(0, args.onHand);
  return {
    cost: roundMoney(qty * args.costPrice),
    sell: roundMoney(qty * args.sellingPrice),
  };
}

export function sumInventoryValues(
  rows: Array<{
    onHand: number;
    costPrice: number;
    sellingPrice: number;
    tracksInventory?: boolean;
  }>,
): InventoryValueContribution {
  let cost = 0;
  let sell = 0;
  for (const row of rows) {
    const part = inventoryValueContribution(row);
    cost += part.cost;
    sell += part.sell;
  }
  return { cost: roundMoney(cost), sell: roundMoney(sell) };
}
