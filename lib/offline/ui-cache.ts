import type { AppRole } from "@/config/navigation";
import { getMeta, getOfflineDb, META_KEYS, setMeta } from "./db";
import type { PrintSnapshot } from "./types";
import { collectTopSellingCandidates } from "@/lib/dashboard/top-selling";
import { DASHBOARD_OPS_WINDOW_DAYS } from "@/lib/dashboard/window";
import {
  filterCashierDashboardReturns,
  filterCashierDashboardSales,
} from "@/lib/dashboard/cashier-scope";
import { availableStockQuantity, isBelowLowStockThreshold } from "@/lib/stock-status";
import { resolveExpiryAlertDays, lotStatus } from "@/lib/expiry";
import { loadExpiryPolicyCache } from "./expiry-policy";

export type DashboardAlertRow = {
  id: string;
  productId: string;
  name: string;
  stockQuantity: number;
  unit: string;
  lowStockThreshold: number;
  costPrice?: number;
  branchId: string | null;
  branchName: string | null;
};

export type DashboardExpiryAlertRow = {
  id: string;
  productId: string;
  name: string;
  sellableQuantity: number;
  expiredQuantity: number;
  nearestExpiry: string | null;
  isExpired: boolean;
  isExpiring: boolean;
  unit: string;
  branchId: string | null;
  branchName: string | null;
};

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
  lowStock: DashboardAlertRow[];
  expiryAlerts?: DashboardExpiryAlertRow[];
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
  /** Admin-only; omitted offline / for non-admins. */
  finance?: {
    inventoryValueCost: number | null;
    inventoryValueSell: number;
    revenue: number;
    cogs: number | null;
    grossProfit: number | null;
  } | null;
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

/** Build the dashboard from Dexie products, mirrored orders, and unsynced local sales.
 * Admin/manager KPIs use the requested range (last seven days by default).
 * Cashiers remain scoped to today.
 */
export async function buildLocalDashboardSummary(
  role: AppRole,
  branchId?: string,
  requestedRange?: { startDate: number; endDate: number },
): Promise<DashboardSummaryCache> {
  const db = await getOfflineDb();
  const now = Date.now();
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const sinceToday = startToday.getTime();
  const defaultOpsStart = now - DASHBOARD_OPS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const showOps = role === "administrator" || role === "manager";
  const rangeStart = showOps ? (requestedRange?.startDate ?? defaultOpsStart) : sinceToday;
  const rangeEnd = showOps ? (requestedRange?.endDate ?? now) : now;

  if (!db) {
    return emptyDashboard(role, now, rangeStart, rangeEnd);
  }

  const [
    products,
    customers,
    localSales,
    items,
    localReturns,
    mirroredOrders,
    orderItems,
    mirroredReturns,
    branchStock,
    lots,
    branches,
  ] = await Promise.all([
    db.products.toArray(),
    db.customers.toArray(),
    db.localSales.orderBy("completedAt").reverse().toArray(),
    db.localSaleItems.toArray(),
    db.localReturns.toArray(),
    db.orders.toArray(),
    db.orderItems.toArray(),
    db.returns.toArray(),
    db.branchStock.toArray(),
    db.lots.toArray(),
    db.branches.toArray(),
  ]);

  const activeProducts = products.filter((p) => p.status === "active");
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));
  const productById = new Map(activeProducts.map((p) => [p.id, p]));
  const expiryPolicy = await loadExpiryPolicyCache();
  const orgAlertDays = expiryPolicy.defaultAlertDays;

  // Stock / expiry alerts are always org-wide for admin/manager (every branch
  // with a tag). Sales KPIs below still honour `branchId`. Cashiers only see
  // their branch when the replica is branch-scoped.
  const lowStock: DashboardAlertRow[] = [];
  for (const p of activeProducts) {
    const rows = branchStock.filter((item) => item.productId === p.id);
    if (rows.length === 0) {
      const available = availableStockQuantity(p);
      if (!isBelowLowStockThreshold(available, p.lowStockThreshold)) continue;
      lowStock.push({
        id: p.id,
        productId: p.id,
        name: p.name,
        stockQuantity: available,
        unit: p.unit,
        lowStockThreshold: p.lowStockThreshold,
        costPrice: showOps ? p.costPrice : undefined,
        branchId: null,
        branchName: null,
      });
      continue;
    }
    for (const row of rows) {
      const available = availableStockQuantity({
        tracksExpiry: p.tracksExpiry,
        stockQuantity: row.quantity,
        sellableQuantity: row.sellableQuantity,
      });
      if (!isBelowLowStockThreshold(available, p.lowStockThreshold)) continue;
      lowStock.push({
        id: `${p.id}:${row.branchId}`,
        productId: p.id,
        name: p.name,
        stockQuantity: available,
        unit: p.unit,
        lowStockThreshold: p.lowStockThreshold,
        costPrice: showOps ? p.costPrice : undefined,
        branchId: row.branchId,
        branchName: branchNameById.get(row.branchId) ?? null,
      });
    }
  }

  type ExpiryAgg = {
    productId: string;
    branchId: string;
    sellable: number;
    expired: number;
    nearest: string | null;
    isExpired: boolean;
    isExpiring: boolean;
  };
  const expiryByKey = new Map<string, ExpiryAgg>();
  for (const lot of lots) {
    if (lot.quantity <= 0) continue;
    const product = productById.get(lot.productId);
    if (!product?.tracksExpiry) continue;
    const alertDays = resolveExpiryAlertDays(product, orgAlertDays);
    const status = lotStatus(lot.expiryDate, alertDays);
    if (status === "ok") continue;
    const key = `${lot.productId}:${lot.branchId}`;
    const current = expiryByKey.get(key) ?? {
      productId: lot.productId,
      branchId: lot.branchId,
      sellable: 0,
      expired: 0,
      nearest: null as string | null,
      isExpired: false,
      isExpiring: false,
    };
    if (status === "expired") {
      current.expired += lot.quantity;
      current.isExpired = true;
    } else {
      current.sellable += lot.quantity;
      current.isExpiring = true;
      if (!current.nearest || lot.expiryDate < current.nearest) {
        current.nearest = lot.expiryDate;
      }
    }
    expiryByKey.set(key, current);
  }

  // Products flagged on the product row without mirrored lots still count once.
  for (const p of activeProducts) {
    if (!p.tracksExpiry || (!p.isExpired && !p.isExpiring)) continue;
    const hasLotAlert = [...expiryByKey.values()].some((row) => row.productId === p.id);
    if (hasLotAlert) continue;
    // Without lot rows we cannot know the FEFO batch size — show 0 for
    // expiring qty rather than the full product sellable total.
    expiryByKey.set(`${p.id}:product`, {
      productId: p.id,
      branchId: "",
      sellable: 0,
      expired: p.isExpired ? availableStockQuantity(p) : 0,
      nearest: p.nearestExpiry ?? null,
      isExpired: Boolean(p.isExpired),
      isExpiring: Boolean(p.isExpiring),
    });
  }

  const expiryAlerts: DashboardExpiryAlertRow[] = [...expiryByKey.values()]
    .map((row) => {
      const product = productById.get(row.productId);
      if (!product) return null;
      return {
        id: row.branchId ? `${row.productId}:${row.branchId}` : row.productId,
        productId: row.productId,
        name: product.name,
        sellableQuantity: row.sellable,
        expiredQuantity: row.expired,
        nearestExpiry: row.nearest,
        isExpired: row.isExpired,
        isExpiring: row.isExpiring,
        unit: product.unit,
        branchId: row.branchId || null,
        branchName: row.branchId ? (branchNameById.get(row.branchId) ?? null) : null,
      };
    })
    .filter((row): row is DashboardExpiryAlertRow => row !== null);

  const expiringCount = expiryAlerts.length;

  const sessionUserId = await getMeta(db, META_KEYS.profileUserId);

  const mirroredIds = new Set(mirroredOrders.map((o) => o.id));
  const mirroredInvoices = new Set(mirroredOrders.map((o) => o.invoiceNumber));
  const unsyncedLocal = localSales.filter(
    (s) =>
      (s.syncStatus === "pending" || s.syncStatus === "failed") &&
      !(s.serverSaleId && mirroredIds.has(s.serverSaleId)) &&
      !mirroredInvoices.has(s.invoiceNumber),
  );
  const combinedSales = filterCashierDashboardSales(
    [...mirroredOrders, ...unsyncedLocal],
    role,
    sessionUserId,
  );
  const branchSales = branchId
    ? combinedSales.filter((s) => s.branchId === branchId)
    : combinedSales;
  const scopedSales = branchSales.filter(
    (sale) => sale.completedAt >= rangeStart && sale.completedAt <= rangeEnd,
  );

  const unsyncedReturns = localReturns.filter((row) => {
    if (row.syncStatus !== "pending" && row.syncStatus !== "failed") return false;
    if (row.serverReturnId && mirroredReturns.some((item) => item.id === row.serverReturnId)) {
      return false;
    }
    if (mirroredReturns.some((item) => item.returnNumber === row.returnNumber)) return false;
    return true;
  });
  const cashierSaleIds = new Set(combinedSales.map((sale) => sale.id));
  for (const sale of unsyncedLocal) {
    if (sale.serverSaleId) cashierSaleIds.add(sale.serverSaleId);
  }
  const combinedReturns = filterCashierDashboardReturns(
    [...mirroredReturns, ...unsyncedReturns],
    cashierSaleIds,
    role,
  );
  const branchReturns = branchId
    ? combinedReturns.filter(
        (row) => !("branchId" in row) || row.branchId == null || row.branchId === branchId,
      )
    : combinedReturns;
  const scopedReturns = branchReturns.filter(
    (row) => row.completedAt >= rangeStart && row.completedAt <= rangeEnd,
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
  const scopedMirroredIds = new Set(
    scopedSales.filter((s) => mirroredIds.has(s.id)).map((s) => s.id),
  );
  const scopedLocalIds = new Set(
    scopedSales.filter((s) => !mirroredIds.has(s.id)).map((s) => s.id),
  );
  const addProductTotal = (productId: string, name: string, total: number, quantity: number) => {
    const current = productTotals.get(productId) ?? { id: productId, name, total: 0, quantity: 0 };
    current.total += total;
    current.quantity += quantity;
    productTotals.set(productId, current);
  };
  for (const item of orderItems) {
    if (!scopedMirroredIds.has(item.orderId)) continue;
    addProductTotal(item.productId, item.productName, item.lineTotal, item.quantity);
  }
  for (const item of items) {
    if (!scopedLocalIds.has(item.localSaleId)) continue;
    addProductTotal(item.productId, item.productName, item.lineTotal, item.quantity);
  }

  const topProducts = collectTopSellingCandidates([...productTotals.values()]);

  const trendMap = new Map<string, number>();
  const trendCursor = new Date(rangeStart);
  trendCursor.setHours(0, 0, 0, 0);
  const trendEnd = new Date(rangeEnd);
  trendEnd.setHours(0, 0, 0, 0);
  for (let count = 0; trendCursor.getTime() <= trendEnd.getTime() && count < 371; count += 1) {
    trendMap.set(trendCursor.toISOString().slice(0, 10), 0);
    trendCursor.setDate(trendCursor.getDate() + 1);
  }
  for (const sale of branchSales) {
    if (sale.completedAt < rangeStart || sale.completedAt > rangeEnd) continue;
    const key = new Date(sale.completedAt).toISOString().slice(0, 10);
    if (trendMap.has(key)) {
      trendMap.set(key, (trendMap.get(key) ?? 0) + sale.total);
    }
  }

  const categoryTotals = new Map<string, number>();
  const productCategory = new Map(activeProducts.map((p) => [p.id, p.categoryName]));
  for (const item of orderItems) {
    if (!scopedMirroredIds.has(item.orderId)) continue;
    const name = productCategory.get(item.productId) ?? "Other";
    categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + item.lineTotal);
  }
  for (const item of items) {
    if (!scopedLocalIds.has(item.localSaleId)) continue;
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
    lowStock: lowStock.slice(0, 12),
    expiryAlerts: expiryAlerts.slice(0, 12),
    topProducts,
    recentSales: [...scopedSales]
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 8)
      .map((s) => ({
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

function emptyDashboard(
  role: AppRole,
  now: number,
  rangeStart: number,
  rangeEnd: number,
): DashboardSummaryCache {
  const trendMap: Array<{ date: string; total: number }> = [];
  const cursor = new Date(rangeStart);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(rangeEnd);
  end.setHours(0, 0, 0, 0);
  for (let count = 0; cursor.getTime() <= end.getTime() && count < 371; count += 1) {
    trendMap.push({ date: cursor.toISOString().slice(0, 10), total: 0 });
    cursor.setDate(cursor.getDate() + 1);
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
    expiryAlerts: [],
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
  branchId?: string,
): Promise<LocalSalesReport> {
  const db = await getOfflineDb();
  if (!db) {
    return {
      kpis: { totalSales: 0, totalOrders: 0, itemsSold: 0, averageOrder: 0 },
      trend: [],
      daily: [],
    };
  }

  const [allSales, allOrders, allReturns] = await Promise.all([
    db.localSales.toArray(),
    db.orders.toArray(),
    db.localReturns.toArray(),
  ]);
  const inRange = (completedAt: number) => completedAt >= startDate && completedAt <= endDate;
  const sales = allSales.filter(
    (sale) => inRange(sale.completedAt) && (!branchId || sale.branchId === branchId),
  );
  const mirrored = allOrders.filter(
    (sale) => inRange(sale.completedAt) && (!branchId || sale.branchId === branchId),
  );
  // A return can occur in this period for a sale from an earlier period.
  // Local returns lack branchId, so resolve scope from the original sale.
  const branchSaleIds = new Set<string>();
  for (const sale of allOrders) {
    if (!branchId || sale.branchId === branchId) branchSaleIds.add(sale.id);
  }
  for (const sale of allSales) {
    if (!branchId || sale.branchId === branchId) {
      branchSaleIds.add(sale.id);
      if (sale.serverSaleId) branchSaleIds.add(sale.serverSaleId);
    }
  }
  const returns = allReturns.filter(
    (row) => inRange(row.completedAt) && (!branchId || branchSaleIds.has(row.saleId)),
  );
  const mirroredIds = new Set(mirrored.map((o) => o.id));
  const mirroredInvoices = new Set(mirrored.map((o) => o.invoiceNumber));
  const unsyncedLocal = sales.filter(
    (s) =>
      (s.syncStatus === "pending" || s.syncStatus === "failed") &&
      !(s.serverSaleId && mirroredIds.has(s.serverSaleId)) &&
      !mirroredInvoices.has(s.invoiceNumber),
  );

  const grossSales =
    mirrored.reduce((sum, s) => sum + s.total, 0) +
    unsyncedLocal.reduce((sum, s) => sum + s.total, 0);
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
