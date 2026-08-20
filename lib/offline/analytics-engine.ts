import { roundMoney } from "@/lib/currency";
import { EXPENSE_CATEGORY_OPTIONS, type ExpenseCategory } from "@/features/analytics/constants";
import { getOfflineDb } from "./db";

export type AnalyticsGranularity = "day" | "week" | "month" | "year";

export type LocalAnalyticsSummary = {
  kpis: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    profitMargin: number;
    totalOrders: number;
    expenseCount: number;
    totalRefunds: number;
    itemsReturned: number;
    returnRate: number;
    grossRevenue: number;
  };
  pnl: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    profitMargin: number;
    totalRefunds: number;
    grossRevenue: number;
  };
  expenseBreakdown: Array<{ category: ExpenseCategory; label: string; amount: number }>;
  trend: Array<{
    period: string;
    revenue: number;
    cogs: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
  }>;
  branchId: string | null;
  source: "local";
};

type SaleRow = {
  id: string;
  total: number;
  completedAt: number;
  branchId: string | null;
  itemCount: number;
};

type ItemRow = {
  saleId: string;
  productId: string;
  quantity: number;
  unitCost: number;
};

type ReturnRow = {
  id: string;
  refundAmount: number;
  itemCount: number;
  completedAt: number;
  branchId: string | null;
};

function periodKey(timestamp: number, granularity: AnalyticsGranularity): string {
  const d = new Date(timestamp);
  if (granularity === "year") return String(d.getFullYear());
  if (granularity === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    const day = new Date(d);
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - day.getDay());
    return day.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 10);
}

function unitCostForLine(unitPrice: number, productCost: number | undefined) {
  return productCost ?? unitPrice * 0.6;
}

export async function buildLocalAnalyticsSummary(args: {
  startDate: number;
  endDate: number;
  granularity: AnalyticsGranularity;
  branchId?: string | null;
}): Promise<LocalAnalyticsSummary> {
  const db = await getOfflineDb();
  const empty = emptySummary(args.branchId ?? null);

  if (!db) return empty;

  const [products, mirroredOrders, localSales, orderItems, localSaleItems, localReturns, localReturnItems] =
    await Promise.all([
      db.products.toArray(),
      db.orders.toArray(),
      db.localSales.toArray(),
      db.orderItems.toArray(),
      db.localSaleItems.toArray(),
      db.localReturns.toArray(),
      db.localReturnItems.toArray(),
    ]);

  const costByProduct = new Map(products.map((p) => [p.id, p.costPrice]));
  const syncedLocalIds = new Set(
    localSales.filter((s) => s.syncStatus === "synced").map((s) => s.clientOperationId),
  );

  const sales: SaleRow[] = [];
  for (const order of mirroredOrders) {
    if (order.completedAt < args.startDate || order.completedAt > args.endDate) continue;
    if (args.branchId && order.branchId !== args.branchId) continue;
    sales.push({
      id: order.id,
      total: order.total,
      completedAt: order.completedAt,
      branchId: order.branchId,
      itemCount: order.itemCount,
    });
  }
  for (const sale of localSales) {
    if (sale.syncStatus === "synced") continue;
    if (sale.completedAt < args.startDate || sale.completedAt > args.endDate) continue;
    if (args.branchId && sale.branchId !== args.branchId) continue;
    if (syncedLocalIds.has(sale.clientOperationId)) continue;
    sales.push({
      id: sale.id,
      total: sale.total,
      completedAt: sale.completedAt,
      branchId: sale.branchId ?? null,
      itemCount: sale.itemCount,
    });
  }

  const saleIds = new Set(sales.map((s) => s.id));
  const items: ItemRow[] = [];
  for (const item of orderItems) {
    if (!saleIds.has(item.orderId)) continue;
    items.push({
      saleId: item.orderId,
      productId: item.productId,
      quantity: item.quantity,
      unitCost: unitCostForLine(item.unitPrice, costByProduct.get(item.productId)),
    });
  }
  for (const item of localSaleItems) {
    if (!saleIds.has(item.localSaleId)) continue;
    items.push({
      saleId: item.localSaleId,
      productId: item.productId,
      quantity: item.quantity,
      unitCost: unitCostForLine(item.unitPrice, costByProduct.get(item.productId)),
    });
  }

  const returns: ReturnRow[] = [];
  for (const row of localReturns) {
    if (row.completedAt < args.startDate || row.completedAt > args.endDate) continue;
    if (args.branchId) {
      const mirrored = mirroredOrders.find((order) => order.id === row.saleId);
      const local = localSales.find(
        (sale) => sale.id === row.saleId || sale.serverSaleId === row.saleId,
      );
      const branch = mirrored?.branchId ?? local?.branchId ?? null;
      if (branch && branch !== args.branchId) continue;
    }
    returns.push({
      id: row.id,
      refundAmount: row.refundAmount,
      itemCount: row.itemCount,
      completedAt: row.completedAt,
      branchId: null,
    });
  }

  const returnIds = new Set(returns.map((r) => r.id));
  const returnItems = localReturnItems.filter((item) => returnIds.has(item.localReturnId));

  const revenueGross = roundMoney(sales.reduce((sum, s) => sum + s.total, 0));
  const totalRefunds = roundMoney(returns.reduce((sum, row) => sum + row.refundAmount, 0));
  const itemsReturned = returns.reduce((sum, row) => sum + row.itemCount, 0);
  const returnRate = sales.length > 0 ? roundMoney((returns.length / sales.length) * 100) : 0;

  const soldCogs = roundMoney(
    items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0),
  );
  const returnedCogs = roundMoney(
    returnItems.reduce((sum, item) => {
      const cost = unitCostForLine(item.unitPrice, costByProduct.get(item.productId ?? ""));
      return sum + cost * item.quantity;
    }, 0),
  );
  const cogs = roundMoney(Math.max(0, soldCogs - returnedCogs));
  const revenue = roundMoney(revenueGross - totalRefunds);
  const operatingExpenses = 0;
  const grossProfit = roundMoney(revenue - cogs);
  const netProfit = roundMoney(grossProfit - operatingExpenses);
  const profitMargin = revenue > 0 ? roundMoney((netProfit / revenue) * 100) : 0;

  type Bucket = {
    key: string;
    revenue: number;
    cogs: number;
    expenses: number;
  };
  const buckets = new Map<string, Bucket>();
  const ensure = (key: string): Bucket => {
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = { key, revenue: 0, cogs: 0, expenses: 0 };
      buckets.set(key, bucket);
    }
    return bucket;
  };

  const cogsBySale = new Map<string, number>();
  for (const item of items) {
    cogsBySale.set(item.saleId, (cogsBySale.get(item.saleId) ?? 0) + item.unitCost * item.quantity);
  }
  for (const sale of sales) {
    const bucket = ensure(periodKey(sale.completedAt, args.granularity));
    bucket.revenue += sale.total;
    bucket.cogs += cogsBySale.get(sale.id) ?? 0;
  }
  for (const row of returns) {
    const bucket = ensure(periodKey(row.completedAt, args.granularity));
    bucket.revenue -= row.refundAmount;
  }
  for (const item of returnItems) {
    const parent = returns.find((row) => row.id === item.localReturnId);
    if (!parent) continue;
    const cost = unitCostForLine(item.unitPrice, costByProduct.get(item.productId ?? ""));
    const bucket = ensure(periodKey(parent.completedAt, args.granularity));
    bucket.cogs -= cost * item.quantity;
  }

  const trend = [...buckets.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((bucket) => {
      const gross = roundMoney(bucket.revenue - bucket.cogs);
      const net = roundMoney(gross - bucket.expenses);
      return {
        period: bucket.key,
        revenue: roundMoney(bucket.revenue),
        cogs: roundMoney(bucket.cogs),
        expenses: roundMoney(bucket.expenses),
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
      expenseCount: 0,
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
    expenseBreakdown: EXPENSE_CATEGORY_OPTIONS.map((cat) => ({
      category: cat.value,
      label: cat.label,
      amount: 0,
    })),
    trend,
    branchId: args.branchId ?? null,
    source: "local",
  };
}

function emptySummary(branchId: string | null): LocalAnalyticsSummary {
  return {
    kpis: {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      operatingExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      totalOrders: 0,
      expenseCount: 0,
      totalRefunds: 0,
      itemsReturned: 0,
      returnRate: 0,
      grossRevenue: 0,
    },
    pnl: {
      revenue: 0,
      cogs: 0,
      grossProfit: 0,
      operatingExpenses: 0,
      netProfit: 0,
      profitMargin: 0,
      totalRefunds: 0,
      grossRevenue: 0,
    },
    expenseBreakdown: EXPENSE_CATEGORY_OPTIONS.map((cat) => ({
      category: cat.value,
      label: cat.label,
      amount: 0,
    })),
    trend: [],
    branchId,
    source: "local",
  };
}
