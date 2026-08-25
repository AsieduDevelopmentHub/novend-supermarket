import { roundMoney } from "@/lib/currency";
import { EXPENSE_CATEGORY_OPTIONS, type ExpenseCategory } from "@/features/analytics/constants";
import { getOfflineDb } from "./db";

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

export type AnalyticsGranularity = "day" | "week" | "month" | "year";

export type LocalAnalyticsDetailRow = {
  id: string;
  href: string;
  cells: string[];
  amount?: number;
};

export type LocalAnalyticsDetails = {
  title: string;
  columns: string[];
  rows: LocalAnalyticsDetailRow[];
  source: "local";
};

export type AnalyticsDetailMetric =
  | "revenue"
  | "refunds"
  | "cogs"
  | "grossProfit"
  | "netProfit"
  | "expenses"
  | "orders"
  | "returnRate"
  | "expenseCount"
  | "products"
  | "branches";

type DetailSale = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  branchId: string | null;
  branchName: string | null;
  total: number;
  completedAt: number;
};

type DetailReturn = {
  id: string;
  returnNumber: string;
  saleId: string;
  invoiceNumber: string;
  branchId: string | null;
  branchName: string | null;
  reason: string;
  refundAmount: number;
  completedAt: number;
};

type DetailItem = {
  saleId: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  unitCost: number;
};

type DetailReturnItem = {
  returnId: string;
  saleId: string;
  productId: string;
  quantity: number;
  lineRefund: number;
  unitPrice: number;
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

  const [
    products,
    mirroredOrders,
    localSales,
    orderItems,
    localSaleItems,
    localReturns,
    localReturnItems,
    expenses,
  ] = await Promise.all([
    db.products.toArray(),
    db.orders.toArray(),
    db.localSales.toArray(),
    db.orderItems.toArray(),
    db.localSaleItems.toArray(),
    db.localReturns.toArray(),
    db.localReturnItems.toArray(),
    db.expenses.toArray(),
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

  const soldCogs = roundMoney(items.reduce((sum, item) => sum + item.unitCost * item.quantity, 0));
  const returnedCogs = roundMoney(
    returnItems.reduce((sum, item) => {
      const cost = unitCostForLine(item.unitPrice, costByProduct.get(item.productId ?? ""));
      return sum + cost * item.quantity;
    }, 0),
  );
  const cogs = roundMoney(Math.max(0, soldCogs - returnedCogs));
  const revenue = roundMoney(revenueGross - totalRefunds);
  const periodExpenses = expenses.filter((row) => {
    if (row.occurredAt < args.startDate || row.occurredAt > args.endDate) return false;
    if (args.branchId && row.branchId && row.branchId !== args.branchId) return false;
    return true;
  });
  const operatingExpenses = roundMoney(periodExpenses.reduce((sum, row) => sum + row.amount, 0));
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
  for (const row of periodExpenses) {
    const bucket = ensure(periodKey(row.occurredAt, args.granularity));
    bucket.expenses += row.amount;
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
      expenseCount: periodExpenses.length,
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
      amount: roundMoney(
        periodExpenses
          .filter((row) => row.category === cat.value)
          .reduce((sum, row) => sum + row.amount, 0),
      ),
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

function emptyDetails(title: string, columns: string[]): LocalAnalyticsDetails {
  return { title, columns, rows: [], source: "local" };
}

export async function buildLocalAnalyticsDetails(args: {
  metric: AnalyticsDetailMetric;
  startDate: number;
  endDate: number;
  branchId?: string | null;
}): Promise<LocalAnalyticsDetails> {
  const db = await getOfflineDb();
  if (!db) {
    return emptyDetails("Metric detail", []);
  }

  const [
    products,
    branches,
    mirroredOrders,
    localSales,
    orderItems,
    localSaleItems,
    mirroredReturns,
    localReturns,
    localReturnItems,
    expenses,
  ] = await Promise.all([
    db.products.toArray(),
    db.branches.toArray(),
    db.orders.toArray(),
    db.localSales.toArray(),
    db.orderItems.toArray(),
    db.localSaleItems.toArray(),
    db.returns.toArray(),
    db.localReturns.toArray(),
    db.localReturnItems.toArray(),
    db.expenses.toArray(),
  ]);

  const costByProduct = new Map(products.map((p) => [p.id, p.costPrice]));
  const nameByProduct = new Map(products.map((p) => [p.id, p.name]));
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const syncedLocalIds = new Set(
    localSales.filter((s) => s.syncStatus === "synced").map((s) => s.clientOperationId),
  );

  const sales: DetailSale[] = [];
  for (const order of mirroredOrders) {
    if (order.completedAt < args.startDate || order.completedAt > args.endDate) continue;
    if (args.branchId && order.branchId !== args.branchId) continue;
    sales.push({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      customerName: order.customerName,
      branchId: order.branchId,
      branchName: order.branchName,
      total: order.total,
      completedAt: order.completedAt,
    });
  }
  for (const sale of localSales) {
    if (sale.syncStatus === "synced") continue;
    if (syncedLocalIds.has(sale.clientOperationId)) continue;
    if (sale.completedAt < args.startDate || sale.completedAt > args.endDate) continue;
    if (args.branchId && sale.branchId !== args.branchId) continue;
    sales.push({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      customerName: sale.customerName,
      branchId: sale.branchId ?? null,
      branchName: sale.branchName ?? null,
      total: sale.total,
      completedAt: sale.completedAt,
    });
  }

  const saleIds = new Set(sales.map((s) => s.id));
  const saleIdByInvoice = new Map(sales.map((s) => [s.id, s.invoiceNumber]));
  const items: DetailItem[] = [];
  for (const item of orderItems) {
    if (!saleIds.has(item.orderId)) continue;
    items.push({
      saleId: item.orderId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      unitCost: unitCostForLine(item.unitPrice, costByProduct.get(item.productId)),
    });
  }
  for (const item of localSaleItems) {
    if (!saleIds.has(item.localSaleId)) continue;
    items.push({
      saleId: item.localSaleId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      unitCost: unitCostForLine(item.unitPrice, costByProduct.get(item.productId)),
    });
  }

  const returns: DetailReturn[] = [];
  for (const row of mirroredReturns) {
    if (row.completedAt < args.startDate || row.completedAt > args.endDate) continue;
    if (args.branchId && row.branchId && row.branchId !== args.branchId) continue;
    returns.push({
      id: row.id,
      returnNumber: row.returnNumber,
      saleId: row.saleId,
      invoiceNumber: row.invoiceNumber ?? saleIdByInvoice.get(row.saleId) ?? "—",
      branchId: row.branchId,
      branchName: row.branchName,
      reason: row.reason ?? "—",
      refundAmount: row.refundAmount,
      completedAt: row.completedAt,
    });
  }
  for (const row of localReturns) {
    if (row.syncStatus === "synced") continue;
    if (row.completedAt < args.startDate || row.completedAt > args.endDate) continue;
    const mirrored = mirroredOrders.find((order) => order.id === row.saleId);
    const local = localSales.find(
      (sale) => sale.id === row.saleId || sale.serverSaleId === row.saleId,
    );
    const branchId = mirrored?.branchId ?? local?.branchId ?? null;
    const branchLabel = mirrored?.branchName ?? local?.branchName ?? null;
    if (args.branchId && branchId && branchId !== args.branchId) continue;
    if (returns.some((existing) => existing.id === row.id)) continue;
    returns.push({
      id: row.id,
      returnNumber: row.returnNumber,
      saleId: row.saleId,
      invoiceNumber: mirrored?.invoiceNumber ?? local?.invoiceNumber ?? "—",
      branchId,
      branchName: branchLabel,
      reason: row.reason,
      refundAmount: row.refundAmount,
      completedAt: row.completedAt,
    });
  }

  const returnIds = new Set(returns.map((r) => r.id));
  const returnItems: DetailReturnItem[] = localReturnItems
    .filter((item) => returnIds.has(item.localReturnId))
    .map((item) => {
      const parent = returns.find((row) => row.id === item.localReturnId);
      return {
        returnId: item.localReturnId,
        saleId: parent?.saleId ?? "",
        productId: item.productId ?? "",
        quantity: item.quantity,
        lineRefund: item.lineRefund,
        unitPrice: item.unitPrice,
      };
    });

  const periodExpenses = expenses.filter((row) => {
    if (row.occurredAt < args.startDate || row.occurredAt > args.endDate) return false;
    if (args.branchId && row.branchId && row.branchId !== args.branchId) return false;
    return true;
  });

  if (args.metric === "refunds" || args.metric === "returnRate") {
    return {
      title: args.metric === "returnRate" ? "Return rate" : "Refunds",
      columns: ["Return", "Invoice", "Branch", "Reason", "Amount", "Date"],
      rows: returns
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, 200)
        .map((row) => ({
          id: row.id,
          href: `/returns/${row.id}`,
          cells: [
            row.returnNumber,
            row.invoiceNumber,
            row.branchName ?? "—",
            row.reason,
            String(row.refundAmount),
            String(row.completedAt),
          ],
          amount: row.refundAmount,
        })),
      source: "local",
    };
  }

  if (args.metric === "expenses" || args.metric === "expenseCount") {
    return {
      title: "Expenses",
      columns: ["Category", "Description", "Amount", "Date"],
      rows: periodExpenses
        .sort((a, b) => b.occurredAt - a.occurredAt)
        .slice(0, 200)
        .map((row) => ({
          id: row.id,
          href: "/analytics",
          cells: [row.category, row.description ?? "—", String(row.amount), String(row.occurredAt)],
          amount: row.amount,
        })),
      source: "local",
    };
  }

  if (args.metric === "products") {
    const totals = new Map<
      string,
      { name: string; quantity: number; revenue: number; cogs: number }
    >();
    for (const item of items) {
      const current = totals.get(item.productId) ?? {
        name: nameByProduct.get(item.productId) ?? item.productName,
        quantity: 0,
        revenue: 0,
        cogs: 0,
      };
      current.quantity += item.quantity;
      current.revenue += item.lineTotal;
      current.cogs += item.unitCost * item.quantity;
      totals.set(item.productId, current);
    }
    for (const item of returnItems) {
      const current = totals.get(item.productId);
      if (!current) continue;
      const cost = unitCostForLine(item.unitPrice, costByProduct.get(item.productId));
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
        .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
        .slice(0, 100),
      source: "local",
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
    const cogsBySale = new Map<string, number>();
    for (const item of items) {
      cogsBySale.set(
        item.saleId,
        (cogsBySale.get(item.saleId) ?? 0) + item.unitCost * item.quantity,
      );
    }
    for (const sale of sales) {
      const id = sale.branchId ?? "none";
      const current =
        byBranch.get(id) ??
        emptyBranch(
          sale.branchId
            ? (branchName.get(sale.branchId) ?? sale.branchName ?? "Branch")
            : "Unassigned",
        );
      current.revenue += sale.total;
      current.cogs += cogsBySale.get(sale.id) ?? 0;
      byBranch.set(id, current);
    }
    for (const row of returns) {
      const id = row.branchId ?? "none";
      const current =
        byBranch.get(id) ?? emptyBranch(row.branchName ?? branchName.get(id) ?? "Branch");
      current.refunds += row.refundAmount;
      byBranch.set(id, current);
    }
    for (const item of returnItems) {
      const parent = returns.find((row) => row.id === item.returnId);
      if (!parent) continue;
      const id = parent.branchId ?? "none";
      const current =
        byBranch.get(id) ?? emptyBranch(parent.branchName ?? branchName.get(id) ?? "Branch");
      const cost = unitCostForLine(item.unitPrice, costByProduct.get(item.productId));
      current.cogs -= cost * item.quantity;
      byBranch.set(id, current);
    }
    for (const row of periodExpenses) {
      if (!row.branchId) continue;
      const current =
        byBranch.get(row.branchId) ?? emptyBranch(branchName.get(row.branchId) ?? "Branch");
      current.expenses += row.amount;
      byBranch.set(row.branchId, current);
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
        .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0)),
      source: "local",
    };
  }

  const cogsBySale = new Map<string, number>();
  for (const item of items) {
    cogsBySale.set(item.saleId, (cogsBySale.get(item.saleId) ?? 0) + item.unitCost * item.quantity);
  }
  const refundBySale = new Map<string, number>();
  for (const row of returns) {
    refundBySale.set(row.saleId, (refundBySale.get(row.saleId) ?? 0) + row.refundAmount);
  }
  const returnedCogsBySale = new Map<string, number>();
  for (const item of returnItems) {
    if (!item.saleId) continue;
    const cost = unitCostForLine(item.unitPrice, costByProduct.get(item.productId));
    returnedCogsBySale.set(
      item.saleId,
      (returnedCogsBySale.get(item.saleId) ?? 0) + cost * item.quantity,
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
        const refunded = refundBySale.get(sale.id) ?? 0;
        const cogs = roundMoney(
          (cogsBySale.get(sale.id) ?? 0) - (returnedCogsBySale.get(sale.id) ?? 0),
        );
        const profit = roundMoney(sale.total - refunded - cogs);
        return {
          id: sale.id,
          href: `/orders/${sale.id}`,
          cells: [
            sale.invoiceNumber,
            sale.customerName,
            sale.branchName ?? "—",
            String(sale.total),
            String(refunded),
            String(cogs),
            String(profit),
            String(sale.completedAt),
          ],
          amount: args.metric === "cogs" ? cogs : profit,
        };
      }),
    source: "local",
  };
}
