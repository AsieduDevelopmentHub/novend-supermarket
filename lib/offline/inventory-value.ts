/**
 * Inventory value series from the local Dexie replica (Millie's / offline till).
 * Replays sales and returns against current on-hand stock — same idea as
 * convex/reports.inventoryValue, without cloud history.
 */

import { buildInventoryValueSeries } from "@/convex/shared/inventoryValueSeries";
import { sumInventoryValues } from "@/convex/shared/dashboardFinance";
import { roundMoney } from "@/convex/shared/validation";
import { getOfflineDb } from "./db";

export type OfflineInventoryValuation = {
  inventoryValueCost: number | null;
  inventoryValueSell: number;
  possibleProfit: number | null;
};

/** Current on-hand stock valued at today's cost/sell (inventory page KPIs). */
export async function loadOfflineInventoryValuation(args: {
  branchId?: string | null;
  showCost?: boolean;
}): Promise<OfflineInventoryValuation> {
  const showCost = args.showCost !== false;
  const empty: OfflineInventoryValuation = {
    inventoryValueCost: showCost ? 0 : null,
    inventoryValueSell: 0,
    possibleProfit: showCost ? 0 : null,
  };
  const db = await getOfflineDb();
  if (!db) return empty;

  const [products, branchStock] = await Promise.all([
    db.products.toArray(),
    db.branchStock.toArray(),
  ]);
  const branchFilter = args.branchId?.trim() || null;
  const productById = new Map(products.map((product) => [product.id, product]));

  const rows =
    branchStock.length > 0
      ? branchStock
          .filter((row) => !branchFilter || row.branchId === branchFilter)
          .flatMap((row) => {
            const product = productById.get(row.productId);
            if (!product || product.status === "archived") return [];
            return [
              {
                onHand: row.quantity,
                costPrice: product.costPrice,
                sellingPrice: product.sellingPrice,
                tracksInventory: product.tracksInventory !== false,
              },
            ];
          })
      : products
          .filter((product) => product.status !== "archived")
          .map((product) => ({
            onHand: product.stockQuantity,
            costPrice: product.costPrice,
            sellingPrice: product.sellingPrice,
            tracksInventory: product.tracksInventory !== false,
          }));

  const inventory = sumInventoryValues(rows);
  return {
    inventoryValueCost: showCost ? inventory.cost : null,
    inventoryValueSell: inventory.sell,
    possibleProfit: showCost ? roundMoney(inventory.sell - inventory.cost) : null,
  };
}

export type OfflineInventoryValueResult = {
  showCost: boolean;
  partial: boolean;
  opening: { cost: number | null; sell: number };
  closing: { cost: number | null; sell: number };
  points: Array<{ date: string; cost: number | null; sell: number }>;
};

export async function loadOfflineInventoryValue(args: {
  startDate: number;
  endDate: number;
  branchId?: string | null;
  showCost?: boolean;
}): Promise<OfflineInventoryValueResult> {
  const showCost = args.showCost !== false;
  const empty: OfflineInventoryValueResult = {
    showCost,
    partial: false,
    opening: { cost: showCost ? 0 : null, sell: 0 },
    closing: { cost: showCost ? 0 : null, sell: 0 },
    points: [],
  };

  const db = await getOfflineDb();
  if (!db) return empty;

  const [products, branchStock, localSales, localSaleItems, localReturns, localReturnItems] =
    await Promise.all([
      db.products.toArray(),
      db.branchStock.toArray(),
      db.localSales.toArray(),
      db.localSaleItems.toArray(),
      db.localReturns.toArray(),
      db.localReturnItems.toArray(),
    ]);

  const productById = new Map(products.map((p) => [p.id, p]));
  const branchFilter = args.branchId?.trim() || null;

  const stock =
    branchStock.length > 0
      ? branchStock
          .filter((row) => !branchFilter || row.branchId === branchFilter)
          .flatMap((row) => {
            const product = productById.get(row.productId);
            if (!product || product.status === "archived") return [];
            return [
              {
                key: `${row.branchId}:${row.productId}`,
                quantity: row.quantity,
                costPrice: product.costPrice,
                sellingPrice: product.sellingPrice,
                tracksInventory: product.tracksInventory !== false,
              },
            ];
          })
      : products
          .filter((product) => product.status !== "archived")
          .map((product) => ({
            key: `main:${product.id}`,
            quantity: product.stockQuantity,
            costPrice: product.costPrice,
            sellingPrice: product.sellingPrice,
            tracksInventory: product.tracksInventory !== false,
          }));

  const saleById = new Map(localSales.map((sale) => [sale.id, sale]));
  const movements: Array<{ key: string; quantityChange: number; at: number }> = [];

  for (const item of localSaleItems) {
    if (item.trackedInventory === false) continue;
    const sale = saleById.get(item.localSaleId);
    if (!sale) continue;
    if (branchFilter && sale.branchId && sale.branchId !== branchFilter) continue;
    const branchKey = sale.branchId ?? "main";
    const key =
      branchStock.length > 0 ? `${branchKey}:${item.productId}` : `main:${item.productId}`;
    movements.push({
      key,
      quantityChange: -Math.abs(item.quantity),
      at: sale.completedAt,
    });
  }

  const returnById = new Map(localReturns.map((row) => [row.id, row]));
  for (const item of localReturnItems) {
    if (!item.productId) continue;
    const ret = returnById.get(item.localReturnId);
    if (!ret) continue;
    const originSale = saleById.get(ret.saleId);
    if (branchFilter && originSale?.branchId && originSale.branchId !== branchFilter) continue;
    const branchKey = originSale?.branchId ?? "main";
    const key =
      branchStock.length > 0 ? `${branchKey}:${item.productId}` : `main:${item.productId}`;
    movements.push({
      key,
      quantityChange: Math.abs(item.quantity),
      at: ret.completedAt,
    });
  }

  const valued = buildInventoryValueSeries({
    stock,
    movements,
    startDate: args.startDate,
    endDate: args.endDate,
  });

  return {
    showCost,
    partial: valued.truncated,
    opening: {
      cost: showCost ? valued.opening.cost : null,
      sell: valued.opening.sell,
    },
    closing: {
      cost: showCost ? valued.closing.cost : null,
      sell: valued.closing.sell,
    },
    points: valued.points.map((point) => ({
      date: point.date,
      cost: showCost ? point.cost : null,
      sell: point.sell,
    })),
  };
}
