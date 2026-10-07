import type { LocalSalesReport } from "./ui-cache";

type DayRow = LocalSalesReport["daily"][number];

/**
 * Cloud reports only know uploaded sales. Unsynced checkouts already appear in
 * Orders on this device — fold them into the report so Daily Orders matches.
 *
 * Prefer the local day row when it has more orders (or higher sales) than the
 * cloud row for the same date; otherwise keep the cloud figures.
 */
export function mergeSalesReportWithLocal(
  remote: LocalSalesReport | null | undefined,
  local: LocalSalesReport | null | undefined,
): LocalSalesReport | null {
  if (!remote && !local) return null;
  if (!remote) return local ?? null;
  if (!local) return remote;

  const byDate = new Map<string, DayRow>();
  for (const row of remote.daily) {
    byDate.set(row.date, { ...row, refunds: row.refunds ?? 0 });
  }
  for (const row of local.daily) {
    const next = { ...row, refunds: row.refunds ?? 0 };
    const current = byDate.get(row.date);
    if (!current) {
      byDate.set(row.date, next);
      continue;
    }
    if (next.orders > current.orders || next.totalSales > current.totalSales) {
      byDate.set(row.date, next);
    }
  }

  const daily = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, row]) => row);

  const totalRefunds = daily.reduce((sum, row) => sum + (row.refunds ?? 0), 0);
  const totalSales = daily.reduce((sum, row) => sum + row.totalSales, 0);
  const totalOrders = daily.reduce((sum, row) => sum + row.orders, 0);
  const itemsSold = daily.reduce((sum, row) => sum + row.itemsSold, 0);
  const grossSales = totalSales + totalRefunds;

  return {
    kpis: {
      totalSales,
      totalOrders,
      itemsSold,
      averageOrder: totalOrders ? totalSales / totalOrders : 0,
      grossSales,
      totalRefunds,
      itemsReturned: Math.max(remote.kpis.itemsReturned ?? 0, local.kpis.itemsReturned ?? 0),
    },
    trend: daily.map((row) => ({ date: row.date, total: row.totalSales })),
    daily,
  };
}

type OrderLike = {
  id: string;
  invoiceNumber: string;
  completedAt: number;
  total: number;
  itemCount: number;
};

/**
 * Append device-only sales that the cloud day query has not received yet.
 */
export function mergeDayOrdersWithLocal<T extends OrderLike>(
  cloudOrders: T[],
  localOrders: T[],
): T[] {
  const cloudIds = new Set(cloudOrders.map((row) => row.id));
  const cloudInvoices = new Set(cloudOrders.map((row) => row.invoiceNumber));
  const extras = localOrders.filter(
    (row) => !cloudIds.has(row.id) && !cloudInvoices.has(row.invoiceNumber),
  );
  if (extras.length === 0) return cloudOrders;
  return [...cloudOrders, ...extras].sort((a, b) => b.completedAt - a.completedAt);
}
