import type { AppRole } from "@/config/navigation";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import type { PrintSnapshot } from "./types";

export type DashboardSummaryCache = {
  role: AppRole | string;
  branchId: string | null;
  kpis: {
    revenue: number;
    orders: number;
    itemsSold: number;
    lowStockCount: number;
    expiringCount?: number;
    customersEstimate?: number;
    refunds?: number;
  };
  lowStock: Array<{
    id: string;
    name: string;
    stockQuantity: number;
    unit: string;
    lowStockThreshold: number;
    costPrice?: number;
  }>;
  topProducts: Array<{ id: string; name: string; total: number; quantity: number }>;
  recentSales: Array<{
    id: string;
    invoiceNumber: string;
    customerName: string;
    itemCount: number;
    total: number;
    completedAt: number;
  }>;
  salesTrend: Array<{ date: string; total: number }>;
  salesByCategory: Array<{ name: string; total: number }>;
  cachedAt: number;
};

function dashboardCacheMetaKey(branchKey: string) {
  return `${META_KEYS.dashboardSummary}:${branchKey}`;
}

/** Persist a dashboard summary for a branch scope (`all` or a branch id). */
export async function saveDashboardSummary(
  summary: Omit<DashboardSummaryCache, "cachedAt">,
  branchKey = "all",
) {
  const db = await getOfflineDb();
  if (!db) return;
  const payload: DashboardSummaryCache = { ...summary, cachedAt: Date.now() };
  await setMeta(db, dashboardCacheMetaKey(branchKey), JSON.stringify(payload));
  if (branchKey === "all") {
    await setMeta(db, META_KEYS.dashboardSummary, JSON.stringify(payload));
  }
}

export async function loadDashboardSummary(
  branchKey = "all",
): Promise<DashboardSummaryCache | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const keyed = await getMeta(db, dashboardCacheMetaKey(branchKey));
  const raw = keyed ?? (branchKey === "all" ? await getMeta(db, META_KEYS.dashboardSummary) : null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DashboardSummaryCache;
  } catch {
    return null;
  }
}

export async function loadPrintSnapshotMeta(): Promise<PrintSnapshot | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const raw = await getMeta(db, META_KEYS.printSnapshot);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PrintSnapshot;
  } catch {
    return null;
  }
}

/** Build a usable dashboard from Dexie when no remote cache exists. */
export async function buildLocalDashboardSummary(
  role: AppRole,
  branchId?: string,
): Promise<DashboardSummaryCache> {
  const db = await getOfflineDb();
  const now = Date.now();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const sinceToday = startToday.getTime();
  const since7 = now - 7 * 24 * 60 * 60 * 1000;
  const showOps = role === "administrator" || role === "manager";

  if (!db) {
    return emptyDashboard(role, now);
  }

  const [products, customers, sales, items, localReturns] = await Promise.all([
    db.products.toArray(),
    db.customers.toArray(),
    db.localSales.orderBy("completedAt").reverse().toArray(),
    db.localSaleItems.toArray(),
    db.localReturns.toArray(),
  ]);

  const activeProducts = products.filter((p) => p.status === "active");
  const lowStock = activeProducts
    .filter((p) => {
      const available = p.tracksExpiry ? (p.sellableQuantity ?? 0) : p.stockQuantity;
      return available <= p.lowStockThreshold;
    })
    .map((p) => ({
      id: p.id,
      name: p.name,
      stockQuantity: p.sellableQuantity ?? p.stockQuantity,
      unit: p.unit,
      lowStockThreshold: p.lowStockThreshold,
      costPrice: showOps ? p.costPrice : undefined,
    }));
  const expiringCount = activeProducts.filter((p) => p.isExpired || p.isExpiring).length;

  const branchSales = branchId ? sales.filter((s) => s.branchId === branchId) : sales;
  const scopedSales = showOps
    ? branchSales.filter((s) => s.completedAt >= since7)
    : branchSales.filter((s) => s.completedAt >= sinceToday);

  const scopedReturns = localReturns.filter((row) =>
    showOps ? row.completedAt >= since7 : row.completedAt >= sinceToday,
  );
  const refunds = scopedReturns.reduce((sum, row) => sum + row.refundAmount, 0);
  const revenue = scopedSales.reduce((sum, s) => sum + s.total, 0) - refunds;
  const orders = scopedSales.length;
  const itemsSold =
    scopedSales.reduce((sum, s) => sum + s.itemCount, 0) -
    scopedReturns.reduce((sum, row) => sum + row.itemCount, 0);

  const productTotals = new Map<
    string,
    { id: string; name: string; total: number; quantity: number }
  >();
  const saleIds = new Set(scopedSales.map((s) => s.id));
  for (const item of items) {
    if (!saleIds.has(item.localSaleId)) continue;
    const current = productTotals.get(item.productId) ?? {
      id: item.productId,
      name: item.productName,
      total: 0,
      quantity: 0,
    };
    current.total += item.lineTotal;
    current.quantity += item.quantity;
    productTotals.set(item.productId, current);
  }

  const topProducts = [...productTotals.values()].sort((a, b) => b.total - a.total).slice(0, 5);

  const trendMap = new Map<string, number>();
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    trendMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const sale of branchSales) {
    if (sale.completedAt < since7) continue;
    const key = new Date(sale.completedAt).toISOString().slice(0, 10);
    if (trendMap.has(key)) {
      trendMap.set(key, (trendMap.get(key) ?? 0) + sale.total);
    }
  }

  const categoryTotals = new Map<string, number>();
  const productCategory = new Map(activeProducts.map((p) => [p.id, p.categoryName]));
  for (const item of items) {
    if (!saleIds.has(item.localSaleId)) continue;
    const name = productCategory.get(item.productId) ?? "Other";
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + item.lineTotal);
  }

  return {
    role,
    branchId: branchId ?? null,
    kpis: {
      revenue,
      refunds,
      orders,
      itemsSold,
      lowStockCount: lowStock.length,
      expiringCount,
      customersEstimate: showOps
        ? customers.filter((c) => c.status === "active").length
        : undefined,
    },
    lowStock: lowStock.slice(0, 8),
    topProducts,
    recentSales: sales.slice(0, 8).map((s) => ({
      id: s.id,
      invoiceNumber: s.invoiceNumber,
      customerName: s.customerName,
      itemCount: s.itemCount,
      total: s.total,
      completedAt: s.completedAt,
    })),
    salesTrend: [...trendMap.entries()].map(([date, total]) => ({ date, total })),
    salesByCategory: showOps
      ? [...categoryTotals.entries()].map(([name, total]) => ({ name, total }))
      : [],
    cachedAt: now,
  };
}

function emptyDashboard(role: AppRole, now: number): DashboardSummaryCache {
  const trendMap: Array<{ date: string; total: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    trendMap.push({ date: d.toISOString().slice(0, 10), total: 0 });
  }
  return {
    role,
    branchId: null,
    kpis: {
      revenue: 0,
      orders: 0,
      itemsSold: 0,
      lowStockCount: 0,
      expiringCount: 0,
      customersEstimate: role === "administrator" || role === "manager" ? 0 : undefined,
    },
    lowStock: [],
    topProducts: [],
    recentSales: [],
    salesTrend: trendMap,
    salesByCategory: [],
    cachedAt: now,
  };
}

export type LocalSalesReport = {
  kpis: {
    totalSales: number;
    totalOrders: number;
    itemsSold: number;
    averageOrder: number;
    grossSales?: number;
    totalRefunds?: number;
    itemsReturned?: number;
  };
  trend: Array<{ date: string; total: number }>;
  daily: Array<{
    date: string;
    orders: number;
    itemsSold: number;
    totalSales: number;
    refunds?: number;
  }>;
};

/** Device-local sales report for offline Reports screen. */
export async function buildLocalSalesReport(
  startDate: number,
  endDate: number,
): Promise<LocalSalesReport> {
  const db = await getOfflineDb();
  if (!db) {
    return {
      kpis: { totalSales: 0, totalOrders: 0, itemsSold: 0, averageOrder: 0 },
      trend: [],
      daily: [],
    };
  }

  const sales = (await db.localSales.toArray()).filter(
    (s) => s.completedAt >= startDate && s.completedAt <= endDate,
  );
  const mirrored = (await db.orders.toArray()).filter(
    (s) => s.completedAt >= startDate && s.completedAt <= endDate,
  );
  const returns = (await db.localReturns.toArray()).filter(
    (row) => row.completedAt >= startDate && row.completedAt <= endDate,
  );
  const mirroredIds = new Set(mirrored.map((o) => o.id));
  const unsyncedLocal = sales.filter(
    (s) =>
      (s.syncStatus === "pending" || s.syncStatus === "failed") &&
      !(s.serverSaleId && mirroredIds.has(s.serverSaleId)),
  );

  const grossSales =
    mirrored.reduce((sum, s) => sum + s.total, 0) + unsyncedLocal.reduce((sum, s) => sum + s.total, 0);
  const totalRefunds = returns.reduce((sum, row) => sum + row.refundAmount, 0);
  const totalSales = grossSales - totalRefunds;
  const totalOrders = mirrored.length + unsyncedLocal.length;
  const itemsReturned = returns.reduce((sum, row) => sum + row.itemCount, 0);
  const itemsSold = Math.max(
    0,
    mirrored.reduce((sum, s) => sum + s.itemCount, 0) +
      unsyncedLocal.reduce((sum, s) => sum + s.itemCount, 0) -
      itemsReturned,
  );
  const averageOrder = totalOrders ? totalSales / totalOrders : 0;

  const byDay = new Map<
    string,
    { orders: number; itemsSold: number; totalSales: number; refunds: number }
  >();
  for (const sale of [...mirrored, ...unsyncedLocal]) {
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
      totalSales: row.totalSales,
      refunds: row.refunds,
    }));

  return {
    kpis: {
      totalSales,
      totalOrders,
      itemsSold,
      averageOrder,
      grossSales,
      totalRefunds,
      itemsReturned,
    },
    trend: daily.map((row) => ({ date: row.date, total: row.totalSales })),
    daily,
  };
}
