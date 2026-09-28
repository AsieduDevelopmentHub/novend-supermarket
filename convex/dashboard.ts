import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import {
  requireProfile,
  canViewCostPrice,
  resolveBranchFilter,
  isAdmin,
  isManager,
} from "./shared/permissions";
import { stockMapForBranch } from "./shared/branchStock";
import { sumInventoryValues } from "./shared/dashboardFinance";
import { deriveExpiryListFields, lotSummaries, productExpiryAlertDays } from "./shared/lots";
import { cogsForLines, completedReturnsInRange, loadItemsForReturns } from "./shared/returns";
import { collectSaleItemsForSales, collectSalesInCompletedAtRange } from "./shared/salesRange";
import { roundMoney } from "./shared/validation";

/** Keep in sync with `lib/dashboard/window.ts` (dashboard UI copy). */
const DASHBOARD_OPS_WINDOW_DAYS = 7;

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function daysAgo(n: number) {
  return Date.now() - n * 24 * 60 * 60 * 1000;
}

export const summary = query({
  args: {
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireProfile(ctx);
    const admin = isAdmin(profile);
    const manager = isManager(profile);
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const since = admin || manager ? daysAgo(DASHBOARD_OPS_WINDOW_DAYS) : startOfToday();
    const rangeStart = Math.min(since, daysAgo(7));
    const now = Date.now();

    const sales = await collectSalesInCompletedAtRange(ctx, organizationId, rangeStart, now);

    const scoped = sales.filter((sale) => {
      if (sale.completedAt < since) return false;
      if (branchFilter && sale.branchId !== branchFilter) return false;
      if (!admin && !manager && sale.cashierId !== profile.userId) return false;
      return true;
    });

    const revenueGross = scoped.reduce((sum, sale) => sum + sale.total, 0);
    const cashierSaleIds = !admin && !manager ? new Set(scoped.map((s) => s._id)) : undefined;
    const returns = await completedReturnsInRange(ctx, {
      startDate: since,
      endDate: Date.now(),
      organizationId,
      branchId: branchFilter,
      cashierSaleIds,
    });
    const returnItems = await loadItemsForReturns(
      ctx,
      returns.map((row) => row._id),
    );
    const totalRefunds = returns.reduce((sum, row) => sum + row.refundAmount, 0);
    const itemsReturned = returns.reduce((sum, row) => sum + row.itemCount, 0);
    const revenue = revenueGross - totalRefunds;
    const orders = scoped.length;
    const itemsSold = Math.max(
      0,
      scoped.reduce((sum, sale) => sum + sale.itemCount, 0) - itemsReturned,
    );

    const products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const activeProducts = products.filter((p) => p.status === "active");

    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const branchNameById = new Map(branches.map((b) => [b._id, b.name]));

    // Stock / expiry alerts always span every branch the caller can see (org-wide
    // for admins even when sales KPIs are filtered). Managers stay on their branch.
    const alertBranchIds = admin
      ? branches.filter((b) => b.status === "active").map((b) => b._id)
      : profile.branchId
        ? [profile.branchId]
        : [];

    const lowStock: Array<{
      id: string;
      productId: Id<"products">;
      name: string;
      stockQuantity: number;
      unit: string;
      lowStockThreshold: number;
      costPrice?: number;
      branchId: Id<"branches"> | null;
      branchName: string | null;
    }> = [];
    const expiryAlerts: Array<{
      id: string;
      productId: Id<"products">;
      name: string;
      sellableQuantity: number;
      expiredQuantity: number;
      nearestExpiry: string | null;
      isExpired: boolean;
      isExpiring: boolean;
      unit: string;
      branchId: Id<"branches"> | null;
      branchName: string | null;
    }> = [];

    for (const branchId of alertBranchIds) {
      const stockByProduct = await stockMapForBranch(ctx, branchId);
      const alertDaysByProduct = new Map(
        activeProducts.map((p) => [String(p._id), productExpiryAlertDays(p)]),
      );
      const summaries = await lotSummaries(ctx, branchId, organizationId, alertDaysByProduct);
      for (const p of activeProducts) {
        const stockQuantity = stockByProduct.get(p._id) ?? 0;
        const expiry = deriveExpiryListFields(p, stockQuantity, summaries.get(p._id));
        if (expiry.isLowStock) {
          lowStock.push({
            id: `${p._id}:${branchId}`,
            productId: p._id,
            name: p.name,
            stockQuantity: expiry.sellableQuantity,
            unit: p.unit,
            lowStockThreshold: p.lowStockThreshold,
            costPrice: canViewCostPrice(profile) ? p.costPrice : undefined,
            branchId,
            branchName: branchNameById.get(branchId) ?? null,
          });
        }
        if (expiry.tracksExpiry && (expiry.isExpired || expiry.isExpiring)) {
          expiryAlerts.push({
            id: `${p._id}:${branchId}`,
            productId: p._id,
            name: p.name,
            // Alert quantity = FEFO batch in the alert window (or expired units),
            // never the product's total sellable stock.
            sellableQuantity: expiry.expiringQuantity,
            expiredQuantity: expiry.expiredQuantity,
            nearestExpiry: expiry.isExpiring
              ? (expiry.nearestSellableExpiry ?? expiry.nearestExpiry)
              : expiry.nearestExpiry,
            isExpired: expiry.isExpired,
            isExpiring: expiry.isExpiring,
            unit: p.unit,
            branchId,
            branchName: branchNameById.get(branchId) ?? null,
          });
        }
      }
    }

    const categories = await ctx.db
      .query("categories")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const categoryMap = new Map(categories.map((c) => [c._id, c.name]));

    const saleItems = await collectSaleItemsForSales(
      ctx,
      scoped.map((s) => s._id),
    );
    const productSales = new Map<
      string,
      { id: string; name: string; total: number; quantity: number }
    >();
    for (const item of saleItems) {
      const sale = sales.find((s) => s._id === item.saleId);
      if (!sale || sale.completedAt < since) continue;
      if (branchFilter && sale.branchId !== branchFilter) continue;
      if (!admin && !manager && sale.cashierId !== profile.userId) continue;
      const current = productSales.get(item.productId) ?? {
        id: item.productId,
        name: item.productName,
        total: 0,
        quantity: 0,
      };
      current.total += item.lineTotal;
      current.quantity += item.quantity;
      productSales.set(item.productId, current);
    }
    for (const item of returnItems) {
      const current = productSales.get(item.productId);
      if (!current) continue;
      current.total -= item.lineRefund;
      current.quantity -= item.quantity;
    }

    const topProducts = [...productSales.values()]
      .filter((row) => row.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || b.total - a.total)
      .slice(0, 40);

    const recentSales = scoped
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 8)
      .map((sale) => ({
        id: sale._id,
        invoiceNumber: sale.invoiceNumber,
        customerName: sale.customerName,
        itemCount: sale.itemCount,
        total: sale.total,
        completedAt: sale.completedAt,
      }));

    const trendMap = new Map<string, number>();
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      trendMap.set(d.toISOString().slice(0, 10), 0);
    }
    for (const sale of sales) {
      if (sale.completedAt < daysAgo(7)) continue;
      if (branchFilter && sale.branchId !== branchFilter) continue;
      if (!admin && !manager && sale.cashierId !== profile.userId) continue;
      const key = new Date(sale.completedAt).toISOString().slice(0, 10);
      if (trendMap.has(key)) {
        trendMap.set(key, (trendMap.get(key) ?? 0) + sale.total);
      }
    }
    for (const row of returns) {
      const key = new Date(row.completedAt).toISOString().slice(0, 10);
      if (trendMap.has(key)) {
        trendMap.set(key, (trendMap.get(key) ?? 0) - row.refundAmount);
      }
    }
    const salesTrend = [...trendMap.entries()].map(([date, total]) => ({ date, total }));

    const categoryTotals = new Map<string, number>();
    for (const item of saleItems) {
      const sale = sales.find((s) => s._id === item.saleId);
      if (!sale || sale.completedAt < since) continue;
      if (branchFilter && sale.branchId !== branchFilter) continue;
      const product = products.find((p) => p._id === item.productId);
      if (!product) continue;
      const name = categoryMap.get(product.categoryId) ?? "Other";
      categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + item.lineTotal);
    }
    const salesByCategory = [...categoryTotals.entries()].map(([name, total]) => ({ name, total }));

    const customerCount = (
      await ctx.db
        .query("customers")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((c) => c.status === "active").length;

    // Admin-only finance strip — same branch filter as sales KPIs (default all).
    let finance:
      | {
          inventoryValueCost: number | null;
          inventoryValueSell: number;
          revenue: number;
          cogs: number | null;
          grossProfit: number | null;
        }
      | null = null;

    if (admin) {
      const valueBranchIds = branchFilter
        ? [branchFilter]
        : branches.filter((b) => b.status === "active").map((b) => b._id);

      const onHandByProduct = new Map<Id<"products">, number>();
      for (const bid of valueBranchIds) {
        const stockByProduct = await stockMapForBranch(ctx, bid);
        for (const [productId, qty] of stockByProduct) {
          onHandByProduct.set(productId, (onHandByProduct.get(productId) ?? 0) + qty);
        }
      }

      const inventory = sumInventoryValues(
        activeProducts.map((p) => ({
          onHand: onHandByProduct.get(p._id) ?? 0,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          tracksInventory: p.tracksInventory,
        })),
      );

      const costByProduct = new Map(activeProducts.map((p) => [p._id, p.costPrice]));
      const soldCogs = cogsForLines(saleItems, costByProduct);
      const returnedCogs = cogsForLines(returnItems, costByProduct);
      const cogs = roundMoney(soldCogs - returnedCogs);
      const showCost = canViewCostPrice(profile);

      finance = {
        inventoryValueCost: showCost ? inventory.cost : null,
        inventoryValueSell: inventory.sell,
        revenue: roundMoney(revenue),
        cogs: showCost ? cogs : null,
        grossProfit: showCost ? roundMoney(revenue - cogs) : null,
      };
    }

    return {
      role: profile.role,
      branchId: branchFilter,
      kpis: {
        revenue,
        refunds: totalRefunds,
        orders,
        itemsSold,
        lowStockCount: lowStock.length,
        expiringCount: expiryAlerts.length,
        customersEstimate: admin || manager ? customerCount : undefined,
      },
      finance,
      lowStock: lowStock.slice(0, 5),
      expiryAlerts: expiryAlerts.slice(0, 5),
      topProducts,
      recentSales,
      salesTrend,
      salesByCategory: admin || manager ? salesByCategory : [],
    };
  },
});
