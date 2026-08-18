import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireRole, resolveBranchFilter, isAdmin, isManager } from "./shared/permissions";
import { completedReturnsInRange } from "./shared/returns";
import { roundMoney } from "./shared/validation";

export const salesSummary = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    if (args.endDate < args.startDate) throw new Error("Invalid date range");

    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);

    const sales = (await ctx.db.query("sales").withIndex("by_organization", (q) => q.eq("organizationId", organizationId)).collect()).filter((sale) => {
      if (sale.completedAt < args.startDate || sale.completedAt > args.endDate) return false;
      if (branchFilter && sale.branchId !== branchFilter) return false;
      if (!isAdmin(profile) && !isManager(profile) && sale.cashierId !== userId) return false;
      return true;
    });

    const cashierSaleIds =
      !isAdmin(profile) && !isManager(profile) ? new Set(sales.map((s) => s._id)) : undefined;
    const returns = await completedReturnsInRange(ctx, {
      startDate: args.startDate,
      endDate: args.endDate,
      organizationId,
      branchId: branchFilter,
      cashierSaleIds,
    });

    const grossSales = sales.reduce((sum, s) => sum + s.total, 0);
    const totalRefunds = returns.reduce((sum, row) => sum + row.refundAmount, 0);
    const totalSales = roundMoney(grossSales - totalRefunds);
    const totalOrders = sales.length;
    const itemsSold = sales.reduce((sum, s) => sum + s.itemCount, 0);
    const itemsReturned = returns.reduce((sum, row) => sum + row.itemCount, 0);
    const netItemsSold = Math.max(0, itemsSold - itemsReturned);
    const averageOrder = totalOrders ? totalSales / totalOrders : 0;

    const byDay = new Map<
      string,
      { orders: number; itemsSold: number; totalSales: number; refunds: number }
    >();
    for (const sale of sales) {
      const key = new Date(sale.completedAt).toISOString().slice(0, 10);
      const current = byDay.get(key) ?? { orders: 0, itemsSold: 0, totalSales: 0, refunds: 0 };
      current.orders += 1;
      current.itemsSold += sale.itemCount;
      current.totalSales += sale.total;
      byDay.set(key, current);
    }
    for (const row of returns) {
      const key = new Date(row.completedAt).toISOString().slice(0, 10);
      const current = byDay.get(key) ?? { orders: 0, itemsSold: 0, totalSales: 0, refunds: 0 };
      current.refunds += row.refundAmount;
      current.totalSales -= row.refundAmount;
      current.itemsSold -= row.itemCount;
      byDay.set(key, current);
    }

    const daily = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, row]) => ({
        date,
        orders: row.orders,
        itemsSold: Math.max(0, row.itemsSold),
        totalSales: roundMoney(row.totalSales),
        refunds: roundMoney(row.refunds),
      }));

    return {
      kpis: {
        grossSales: roundMoney(grossSales),
        totalRefunds: roundMoney(totalRefunds),
        totalSales,
        totalOrders,
        itemsSold: netItemsSold,
        itemsReturned,
        averageOrder,
      },
      trend: daily.map((d) => ({ date: d.date, total: d.totalSales })),
      daily,
      branchId: branchFilter,
    };
  },
});

const reportMetricValidator = v.union(
  v.literal("grossSales"),
  v.literal("refunds"),
  v.literal("netSales"),
  v.literal("orders"),
  v.literal("itemsSold"),
  v.literal("itemsReturned"),
  v.literal("averageOrder"),
);

export const details = query({
  args: {
    metric: reportMetricValidator,
    startDate: v.number(),
    endDate: v.number(),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    if (args.endDate < args.startDate) throw new Error("Invalid date range");
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);

    const sales = (await ctx.db.query("sales").withIndex("by_organization", (q) => q.eq("organizationId", organizationId)).collect()).filter((sale) => {
      if (sale.completedAt < args.startDate || sale.completedAt > args.endDate) return false;
      if (branchFilter && sale.branchId !== branchFilter) return false;
      if (!isAdmin(profile) && !isManager(profile) && sale.cashierId !== userId) return false;
      return true;
    });
    const cashierSaleIds =
      !isAdmin(profile) && !isManager(profile) ? new Set(sales.map((s) => s._id)) : undefined;
    const returns = await completedReturnsInRange(ctx, {
      startDate: args.startDate,
      endDate: args.endDate,
      organizationId,
      branchId: branchFilter,
      cashierSaleIds,
    });
    const branches = await ctx.db.query("branches").withIndex("by_organization", (q) => q.eq("organizationId", organizationId)).collect();
    const branchName = new Map(branches.map((b) => [b._id, b.name]));

    if (args.metric === "refunds" || args.metric === "itemsReturned") {
      return {
        title: args.metric === "itemsReturned" ? "Items returned" : "Refunds",
        columns: ["Return", "Invoice", "Items", "Amount", "Date"],
        rows: returns
          .sort((a, b) => b.completedAt - a.completedAt)
          .slice(0, 200)
          .map((row) => {
            const sale = sales.find((s) => s._id === row.saleId);
            return {
              id: row._id,
              href: `/returns/${row._id}`,
              cells: [
                row.returnNumber,
                sale?.invoiceNumber ?? "—",
                String(row.itemCount),
                String(row.refundAmount),
                String(row.completedAt),
              ],
              amount: row.refundAmount,
            };
          }),
      };
    }

    const refundBySale = new Map<string, number>();
    for (const row of returns) {
      refundBySale.set(row.saleId, (refundBySale.get(row.saleId) ?? 0) + row.refundAmount);
    }

    return {
      title:
        args.metric === "orders"
          ? "Orders"
          : args.metric === "itemsSold"
            ? "Items sold"
            : args.metric === "averageOrder"
              ? "Average order"
              : args.metric === "netSales"
                ? "Net sales"
                : "Gross sales",
      columns: ["Invoice", "Customer", "Branch", "Items", "Total", "Refunded", "Date"],
      rows: sales
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, 200)
        .map((sale) => ({
          id: sale._id,
          href: `/orders/${sale._id}`,
          cells: [
            sale.invoiceNumber,
            sale.customerName,
            sale.branchId ? (branchName.get(sale.branchId) ?? "—") : "—",
            String(sale.itemCount),
            String(sale.total),
            String(refundBySale.get(sale._id) ?? 0),
            String(sale.completedAt),
          ],
          amount: sale.total,
        })),
    };
  },
});

function utcDayBounds(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) throw new Error("Invalid date");
  return {
    startDate: Date.UTC(year, month - 1, day, 0, 0, 0, 0),
    endDate: Date.UTC(year, month - 1, day, 23, 59, 59, 999),
  };
}

/** Orders and refunds that make up one daily-breakdown row. */
export const dayDetails = query({
  args: {
    date: v.string(),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, ["administrator", "manager", "cashier"]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(args.date)) throw new Error("Invalid date");
    const { startDate, endDate } = utcDayBounds(args.date);
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);

    const sales = (await ctx.db.query("sales").withIndex("by_organization", (q) => q.eq("organizationId", organizationId)).collect()).filter((sale) => {
      if (sale.completedAt < startDate || sale.completedAt > endDate) return false;
      if (branchFilter && sale.branchId !== branchFilter) return false;
      if (!isAdmin(profile) && !isManager(profile) && sale.cashierId !== userId) return false;
      return true;
    });
    const cashierSaleIds =
      !isAdmin(profile) && !isManager(profile) ? new Set(sales.map((s) => s._id)) : undefined;
    const returns = await completedReturnsInRange(ctx, {
      startDate,
      endDate,
      organizationId,
      branchId: branchFilter,
      cashierSaleIds,
    });

    const profiles = await ctx.db.query("profiles").withIndex("by_organization", (q) => q.eq("organizationId", organizationId)).collect();
    const nameByUser = new Map(profiles.map((p) => [p.userId, p.name]));
    const branches = await ctx.db.query("branches").withIndex("by_organization", (q) => q.eq("organizationId", organizationId)).collect();
    const branchName = new Map(branches.map((b) => [b._id, b.name]));

    const grossSales = sales.reduce((sum, s) => sum + s.total, 0);
    const totalRefunds = returns.reduce((sum, row) => sum + row.refundAmount, 0);
    const itemsSold = sales.reduce((sum, s) => sum + s.itemCount, 0);
    const itemsReturned = returns.reduce((sum, row) => sum + row.itemCount, 0);

    return {
      date: args.date,
      kpis: {
        orders: sales.length,
        itemsSold: Math.max(0, itemsSold - itemsReturned),
        grossSales: roundMoney(grossSales),
        refunds: roundMoney(totalRefunds),
        netSales: roundMoney(grossSales - totalRefunds),
        returns: returns.length,
      },
      orders: sales
        .sort((a, b) => b.completedAt - a.completedAt)
        .map((sale) => ({
          id: sale._id,
          invoiceNumber: sale.invoiceNumber,
          customerName: sale.customerName,
          cashierName: nameByUser.get(sale.cashierId) ?? "Cashier",
          branchName: sale.branchId ? (branchName.get(sale.branchId) ?? null) : null,
          itemCount: sale.itemCount,
          total: sale.total,
          paymentMethod: sale.paymentMethod,
          completedAt: sale.completedAt,
        })),
      returns: returns
        .sort((a, b) => b.completedAt - a.completedAt)
        .map((row) => {
          const sale = sales.find((s) => s._id === row.saleId);
          return {
            id: row._id,
            returnNumber: row.returnNumber,
            invoiceNumber: sale?.invoiceNumber ?? "—",
            customerName: row.customerName,
            cashierName: nameByUser.get(row.processedBy) ?? "Staff",
            itemCount: row.itemCount,
            refundAmount: row.refundAmount,
            reason: row.reason,
            completedAt: row.completedAt,
          };
        }),
    };
  },
});
