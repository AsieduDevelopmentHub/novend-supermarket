import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requireRole, resolveBranchFilter, assertBranchAccess } from "./shared/permissions";
import { writeAuditLog } from "./shared/audit";
import { assertActiveOrgBranch } from "./shared/tenancy";
import { rememberClientOp, replayClientOp } from "./shared/clientOps";
import {
  assertPositiveMoney,
  roundMoney,
  sanitizeOptionalText,
  TEXT_LIMITS,
} from "./shared/validation";
import { expenseCategoryValidator } from "./schema";
import {
  completedReturnsInRange,
  loadItemsForReturns,
  unitCostForLine,
  cogsForLines,
} from "./shared/returns";

export type ExpenseCategory =
  "salaries" | "transport" | "utilities" | "supplies" | "maintenance" | "misc";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "salaries", label: "Employee salaries" },
  { value: "transport", label: "Transportation & travel" },
  { value: "utilities", label: "Utilities" },
  { value: "supplies", label: "Office supplies" },
  { value: "maintenance", label: "Maintenance & repairs" },
  { value: "misc", label: "Miscellaneous" },
];

const granularityValidator = v.union(
  v.literal("day"),
  v.literal("week"),
  v.literal("month"),
  v.literal("year"),
);

function periodKey(ts: number, granularity: "day" | "week" | "month" | "year") {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  if (granularity === "day") return `${y}-${m}-${day}`;
  if (granularity === "month") return `${y}-${m}`;
  if (granularity === "year") return String(y);

  // ISO week: year-Www
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((tmp.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export const expenseCategories = query({
  args: {},
  handler: async (ctx) => {
    await requireRole(ctx, ["administrator", "manager"]);
    return EXPENSE_CATEGORIES;
  },
});

export const listExpenses = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    limit: v.optional(v.number()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);
    const limit = Math.min(args.limit ?? 100, 300);
    let rows = await ctx.db
      .query("expenses")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();

    if (branchFilter) {
      rows = rows.filter((e) => e.branchId === branchFilter);
    }
    if (args.startDate !== undefined) {
      rows = rows.filter((e) => e.occurredAt >= args.startDate!);
    }
    if (args.endDate !== undefined) {
      rows = rows.filter((e) => e.occurredAt <= args.endDate!);
    }

    const profiles = await ctx.db
      .query("profiles")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const nameByUser = new Map(profiles.map((p) => [p.userId, p.name]));
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const branchName = new Map(branches.map((b) => [b._id, b.name]));

    return rows
      .sort((a, b) => b.occurredAt - a.occurredAt)
      .slice(0, limit)
      .map((e) => ({
        id: e._id,
        amount: e.amount,
        category: e.category,
        occurredAt: e.occurredAt,
        description: e.description ?? null,
        recordedBy: e.recordedBy,
        recordedByName: nameByUser.get(e.recordedBy) ?? "Unknown",
        createdAt: e.createdAt,
        branchId: e.branchId ?? null,
        branchName: e.branchId ? (branchName.get(e.branchId) ?? null) : null,
      }));
  },
});

export const createExpense = mutation({
  args: {
    amount: v.number(),
    category: expenseCategoryValidator,
    occurredAt: v.number(),
    description: v.optional(v.string()),
    branchId: v.id("branches"),
    clientOperationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    const replayed = await replayClientOp<Id<"expenses">>(
      ctx,
      organizationId,
      args.clientOperationId,
    );
    if (replayed) return replayed;
    assertBranchAccess(profile, args.branchId);
    assertPositiveMoney(args.amount, "expense amount");
    if (args.amount <= 0) throw new Error("Expense amount must be greater than zero");
    if (!Number.isFinite(args.occurredAt)) throw new Error("Invalid expense date");

    const branch = await ctx.db.get(args.branchId);
    assertActiveOrgBranch(branch, organizationId);

    const id = await ctx.db.insert("expenses", {
      organizationId,
      amount: roundMoney(args.amount),
      category: args.category,
      occurredAt: args.occurredAt,
      description: sanitizeOptionalText(args.description, "Description", TEXT_LIMITS.note),
      recordedBy: userId,
      createdAt: Date.now(),
      branchId: args.branchId,
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "create_expense",
      entityType: "expenses",
      entityId: id,
      metadata: { amount: args.amount, category: args.category, branchId: args.branchId },
    });

    await rememberClientOp(ctx, {
      organizationId,
      clientOperationId: args.clientOperationId,
      kind: "create_expense",
      result: id,
    });
    return id;
  },
});

export const updateExpense = mutation({
  args: {
    id: v.id("expenses"),
    amount: v.number(),
    category: expenseCategoryValidator,
    occurredAt: v.number(),
    description: v.optional(v.string()),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Expense not found");
    if (existing.organizationId !== organizationId) throw new Error("Not found");
    if (existing.branchId) assertBranchAccess(profile, existing.branchId);
    assertPositiveMoney(args.amount, "expense amount");
    if (args.amount <= 0) throw new Error("Expense amount must be greater than zero");

    const nextBranchId = args.branchId ?? existing.branchId;
    if (nextBranchId) {
      const branch = await ctx.db.get(nextBranchId);
      assertActiveOrgBranch(branch, organizationId);
      assertBranchAccess(profile, nextBranchId);
    }

    await ctx.db.patch(args.id, {
      amount: roundMoney(args.amount),
      category: args.category,
      occurredAt: args.occurredAt,
      description: sanitizeOptionalText(args.description, "Description", TEXT_LIMITS.note),
      ...(nextBranchId ? { branchId: nextBranchId } : {}),
    });

    await writeAuditLog(ctx, {
      actorId: userId,
      action: "update_expense",
      entityType: "expenses",
      entityId: args.id,
    });
  },
});

export const removeExpense = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    const { userId, profile, organizationId } = await requireRole(ctx, [
      "administrator",
      "manager",
    ]);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Expense not found");
    if (existing.organizationId !== organizationId) throw new Error("Not found");
    if (existing.branchId) assertBranchAccess(profile, existing.branchId);
    await ctx.db.delete(args.id);
    await writeAuditLog(ctx, {
      actorId: userId,
      action: "remove_expense",
      entityType: "expenses",
      entityId: args.id,
    });
  },
});

export const summary = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    granularity: granularityValidator,
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    if (args.endDate < args.startDate) throw new Error("Invalid date range");
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);

    const sales = (
      await ctx.db
        .query("sales")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((s) => {
      if (s.completedAt < args.startDate || s.completedAt > args.endDate) return false;
      if (branchFilter && s.branchId !== branchFilter) return false;
      return true;
    });

    const saleIds = new Set(sales.map((s) => s._id));
    const allItems = await ctx.db
      .query("saleItems")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const items = allItems.filter((i) => saleIds.has(i.saleId));

    const returns = await completedReturnsInRange(ctx, {
      startDate: args.startDate,
      endDate: args.endDate,
      organizationId,
      branchId: branchFilter,
    });
    const returnItems = await loadItemsForReturns(
      ctx,
      returns.map((row) => row._id),
    );

    const productIds = [
      ...new Set([...items.map((i) => i.productId), ...returnItems.map((i) => i.productId)]),
    ];
    const costByProduct = new Map<Id<"products">, number>();
    for (const productId of productIds) {
      const product = await ctx.db.get(productId);
      if (product) costByProduct.set(productId, product.costPrice);
    }

    const revenueGross = roundMoney(sales.reduce((sum, s) => sum + s.total, 0));
    const totalRefunds = roundMoney(returns.reduce((sum, row) => sum + row.refundAmount, 0));
    const itemsReturned = returns.reduce((sum, row) => sum + row.itemCount, 0);
    const returnRate = sales.length > 0 ? roundMoney((returns.length / sales.length) * 100) : 0;

    const returnedCogs = cogsForLines(returnItems, costByProduct);
    const revenue = roundMoney(revenueGross - totalRefunds);
    const soldCogs = cogsForLines(items, costByProduct);
    const cogs = roundMoney(soldCogs - returnedCogs);

    const expenses = (
      await ctx.db
        .query("expenses")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((e) => {
      if (e.occurredAt < args.startDate || e.occurredAt > args.endDate) return false;
      if (branchFilter && e.branchId !== branchFilter) return false;
      return true;
    });
    const operatingExpenses = roundMoney(expenses.reduce((sum, e) => sum + e.amount, 0));

    const grossProfit = roundMoney(revenue - cogs);
    const netProfit = roundMoney(grossProfit - operatingExpenses);
    const profitMargin = revenue > 0 ? roundMoney((netProfit / revenue) * 100) : 0;

    const expenseByCategory = new Map<string, number>();
    for (const cat of EXPENSE_CATEGORIES) {
      expenseByCategory.set(cat.value, 0);
    }
    for (const e of expenses) {
      expenseByCategory.set(
        e.category,
        roundMoney((expenseByCategory.get(e.category) ?? 0) + e.amount),
      );
    }

    type Bucket = {
      key: string;
      revenue: number;
      cogs: number;
      expenses: number;
      grossProfit: number;
      netProfit: number;
    };
    const buckets = new Map<string, Bucket>();

    const ensure = (key: string): Bucket => {
      let b = buckets.get(key);
      if (!b) {
        b = { key, revenue: 0, cogs: 0, expenses: 0, grossProfit: 0, netProfit: 0 };
        buckets.set(key, b);
      }
      return b;
    };

    const cogsBySale = new Map<Id<"sales">, number>();
    for (const item of items) {
      const unitCost = unitCostForLine(item, costByProduct);
      cogsBySale.set(item.saleId, (cogsBySale.get(item.saleId) ?? 0) + unitCost * item.quantity);
    }

    for (const sale of sales) {
      const b = ensure(periodKey(sale.completedAt, args.granularity));
      b.revenue += sale.total;
      b.cogs += cogsBySale.get(sale._id) ?? 0;
    }
    for (const row of returns) {
      const b = ensure(periodKey(row.completedAt, args.granularity));
      b.revenue -= row.refundAmount;
    }
    for (const item of returnItems) {
      const parent = returns.find((row) => row._id === item.returnId);
      if (!parent) continue;
      const unitCost = unitCostForLine(item, costByProduct);
      const b = ensure(periodKey(parent.completedAt, args.granularity));
      b.cogs -= unitCost * item.quantity;
    }
    for (const e of expenses) {
      const b = ensure(periodKey(e.occurredAt, args.granularity));
      b.expenses += e.amount;
    }

    const trend = [...buckets.values()]
      .sort((a, b) => a.key.localeCompare(b.key))
      .map((b) => {
        const gross = roundMoney(b.revenue - b.cogs);
        const net = roundMoney(gross - b.expenses);
        return {
          period: b.key,
          revenue: roundMoney(b.revenue),
          cogs: roundMoney(b.cogs),
          expenses: roundMoney(b.expenses),
          grossProfit: gross,
          netProfit: net,
        };
      });

    return {
      kpis: {
        revenue,
        cogs,
        grossProfit,
        operatingExpenses,
        netProfit,
        profitMargin,
        totalOrders: sales.length,
        expenseCount: expenses.length,
        totalRefunds,
        itemsReturned,
        returnRate,
        grossRevenue: revenueGross,
      },
      pnl: {
        revenue,
        cogs,
        grossProfit,
        operatingExpenses,
        netProfit,
        profitMargin,
        totalRefunds,
        grossRevenue: revenueGross,
      },
      expenseBreakdown: EXPENSE_CATEGORIES.map((cat) => ({
        category: cat.value,
        label: cat.label,
        amount: expenseByCategory.get(cat.value) ?? 0,
      })),
      trend,
      branchId: branchFilter,
    };
  },
});

const analyticsMetricValidator = v.union(
  v.literal("revenue"),
  v.literal("refunds"),
  v.literal("cogs"),
  v.literal("grossProfit"),
  v.literal("netProfit"),
  v.literal("expenses"),
  v.literal("orders"),
  v.literal("returnRate"),
  v.literal("expenseCount"),
  v.literal("products"),
  v.literal("branches"),
);

export const details = query({
  args: {
    metric: analyticsMetricValidator,
    startDate: v.number(),
    endDate: v.number(),
    branchId: v.optional(v.id("branches")),
  },
  handler: async (ctx, args) => {
    const { profile, organizationId } = await requireRole(ctx, ["administrator", "manager"]);
    if (args.endDate < args.startDate) throw new Error("Invalid date range");
    const branchFilter = resolveBranchFilter(profile, args.branchId ?? null);

    const sales = (
      await ctx.db
        .query("sales")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((s) => {
      if (s.completedAt < args.startDate || s.completedAt > args.endDate) return false;
      if (branchFilter && s.branchId !== branchFilter) return false;
      return true;
    });
    const returns = await completedReturnsInRange(ctx, {
      startDate: args.startDate,
      endDate: args.endDate,
      organizationId,
      branchId: branchFilter,
    });
    const expenses = (
      await ctx.db
        .query("expenses")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((e) => {
      if (e.occurredAt < args.startDate || e.occurredAt > args.endDate) return false;
      if (branchFilter && e.branchId !== branchFilter) return false;
      return true;
    });

    const saleIds = new Set(sales.map((s) => s._id));
    const items = (
      await ctx.db
        .query("saleItems")
        .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
        .collect()
    ).filter((i) => saleIds.has(i.saleId));
    const returnItems = await loadItemsForReturns(
      ctx,
      returns.map((row) => row._id),
    );
    const products = await ctx.db
      .query("products")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const costByProduct = new Map(products.map((p) => [p._id, p.costPrice]));
    const nameByProduct = new Map(products.map((p) => [p._id, p.name]));
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .collect();
    const branchName = new Map(branches.map((b) => [b._id, b.name]));

    if (args.metric === "refunds" || args.metric === "returnRate") {
      return {
        title: args.metric === "returnRate" ? "Return rate" : "Refunds",
        columns: ["Return", "Invoice", "Branch", "Reason", "Amount", "Date"],
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
                branchName.get(row.branchId) ?? "—",
                row.reason,
                String(row.refundAmount),
                String(row.completedAt),
              ],
              amount: row.refundAmount,
            };
          }),
      };
    }

    if (args.metric === "expenses" || args.metric === "expenseCount") {
      return {
        title: "Expenses",
        columns: ["Category", "Description", "Amount", "Date"],
        rows: expenses
          .sort((a, b) => b.occurredAt - a.occurredAt)
          .slice(0, 200)
          .map((e) => ({
            id: e._id,
            href: "/analytics",
            cells: [e.category, e.description ?? "—", String(e.amount), String(e.occurredAt)],
            amount: e.amount,
          })),
      };
    }

    if (args.metric === "products") {
      const totals = new Map<
        string,
        { name: string; quantity: number; revenue: number; cogs: number }
      >();
      for (const item of items) {
        const cost = unitCostForLine(item, costByProduct);
        const current = totals.get(item.productId) ?? {
          name: nameByProduct.get(item.productId) ?? item.productName,
          quantity: 0,
          revenue: 0,
          cogs: 0,
        };
        current.quantity += item.quantity;
        current.revenue += item.lineTotal;
        current.cogs += cost * item.quantity;
        totals.set(item.productId, current);
      }
      for (const item of returnItems) {
        const cost = unitCostForLine(item, costByProduct);
        const current = totals.get(item.productId);
        if (!current) continue;
        current.quantity -= item.quantity;
        current.revenue -= item.lineRefund;
        current.cogs -= cost * item.quantity;
      }
      return {
        title: "Product performance",
        columns: ["Product", "Qty", "Revenue", "Profit"],
        rows: [...totals.entries()]
          .map(([id, row]) => ({
            id,
            href: `/products/${id}`,
            cells: [
              row.name,
              String(row.quantity),
              String(roundMoney(row.revenue)),
              String(roundMoney(row.revenue - row.cogs)),
            ],
            amount: row.revenue,
          }))
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 100),
      };
    }

    if (args.metric === "branches") {
      const byBranch = new Map<
        string,
        { name: string; revenue: number; refunds: number; cogs: number; expenses: number }
      >();
      const emptyBranch = (name: string) => ({
        name,
        revenue: 0,
        refunds: 0,
        cogs: 0,
        expenses: 0,
      });
      const cogsBySale = new Map<Id<"sales">, number>();
      for (const item of items) {
        const cost = unitCostForLine(item, costByProduct);
        cogsBySale.set(item.saleId, (cogsBySale.get(item.saleId) ?? 0) + cost * item.quantity);
      }
      for (const sale of sales) {
        const id = sale.branchId ?? "none";
        const current =
          byBranch.get(id) ??
          emptyBranch(sale.branchId ? (branchName.get(sale.branchId) ?? "Branch") : "Unassigned");
        current.revenue += sale.total;
        current.cogs += cogsBySale.get(sale._id) ?? 0;
        byBranch.set(id, current);
      }
      for (const row of returns) {
        const current =
          byBranch.get(row.branchId) ?? emptyBranch(branchName.get(row.branchId) ?? "Branch");
        current.refunds += row.refundAmount;
        byBranch.set(row.branchId, current);
      }
      for (const item of returnItems) {
        const parent = returns.find((row) => row._id === item.returnId);
        if (!parent) continue;
        const current =
          byBranch.get(parent.branchId) ?? emptyBranch(branchName.get(parent.branchId) ?? "Branch");
        current.cogs -= unitCostForLine(item, costByProduct) * item.quantity;
        byBranch.set(parent.branchId, current);
      }
      for (const e of expenses) {
        if (!e.branchId) continue;
        const current =
          byBranch.get(e.branchId) ?? emptyBranch(branchName.get(e.branchId) ?? "Branch");
        current.expenses += e.amount;
        byBranch.set(e.branchId, current);
      }
      return {
        title: "Branch analytics",
        columns: ["Branch", "Revenue", "Refunds", "COGS", "Expenses", "Profit"],
        rows: [...byBranch.entries()]
          .map(([id, row]) => {
            const profit = roundMoney(row.revenue - row.refunds - row.cogs - row.expenses);
            return {
              id,
              href: id === "none" ? "/branches" : `/branches/${id}`,
              cells: [
                row.name,
                String(roundMoney(row.revenue)),
                String(roundMoney(row.refunds)),
                String(roundMoney(row.cogs)),
                String(roundMoney(row.expenses)),
                String(profit),
              ],
              amount: profit,
            };
          })
          .sort((a, b) => b.amount - a.amount),
      };
    }

    const cogsBySale = new Map<Id<"sales">, number>();
    for (const item of items) {
      const cost = unitCostForLine(item, costByProduct);
      cogsBySale.set(item.saleId, (cogsBySale.get(item.saleId) ?? 0) + cost * item.quantity);
    }
    const refundBySale = new Map<Id<"sales">, number>();
    for (const row of returns) {
      refundBySale.set(row.saleId, (refundBySale.get(row.saleId) ?? 0) + row.refundAmount);
    }
    const returnedCogsBySale = new Map<Id<"sales">, number>();
    for (const item of returnItems) {
      const parent = returns.find((row) => row._id === item.returnId);
      if (!parent) continue;
      const cost = unitCostForLine(item, costByProduct);
      returnedCogsBySale.set(
        parent.saleId,
        (returnedCogsBySale.get(parent.saleId) ?? 0) + cost * item.quantity,
      );
    }

    const title =
      args.metric === "cogs"
        ? "Cost of goods sold"
        : args.metric === "grossProfit"
          ? "Gross profit"
          : args.metric === "netProfit"
            ? "Net profit"
            : args.metric === "orders"
              ? "Orders"
              : "Revenue";

    return {
      title,
      columns: ["Invoice", "Customer", "Branch", "Total", "Refunded", "COGS", "Profit", "Date"],
      rows: sales
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, 200)
        .map((sale) => {
          const refunded = refundBySale.get(sale._id) ?? 0;
          const cogs = roundMoney(
            (cogsBySale.get(sale._id) ?? 0) - (returnedCogsBySale.get(sale._id) ?? 0),
          );
          const profit = roundMoney(sale.total - refunded - cogs);
          return {
            id: sale._id,
            href: `/orders/${sale._id}`,
            cells: [
              sale.invoiceNumber,
              sale.customerName,
              sale.branchId ? (branchName.get(sale.branchId) ?? "—") : "—",
              String(sale.total),
              String(refunded),
              String(cogs),
              String(profit),
              String(sale.completedAt),
            ],
            amount: args.metric === "cogs" ? cogs : profit,
          };
        }),
    };
  },
});
