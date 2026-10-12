import type { LocalSalesReport } from "./ui-cache";
import {
  emptyReportPaymentTotals,
  sumReportPaymentTotals,
  type ReportPaymentTotals,
} from "@/lib/payments";

type DayRow = LocalSalesReport["daily"][number];

function dayPaymentTotals(row: DayRow): ReportPaymentTotals {
  return {
    cash: row.cash ?? 0,
    card: row.card ?? 0,
    mobileMoney: row.mobileMoney ?? 0,
  };
}

function withDayPayments(row: DayRow): DayRow {
  const payments = dayPaymentTotals(row);
  return {
    ...row,
    refunds: row.refunds ?? 0,
    cash: payments.cash,
    card: payments.card,
    mobileMoney: payments.mobileMoney,
  };
}

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
  if (!remote) {
    if (!local) return null;
    return {
      ...local,
      paymentTotals: local.paymentTotals ?? emptyReportPaymentTotals(),
      daily: local.daily.map(withDayPayments),
    };
  }
  if (!local) {
    return {
      ...remote,
      paymentTotals: remote.paymentTotals ?? emptyReportPaymentTotals(),
      daily: remote.daily.map(withDayPayments),
    };
  }

  const byDate = new Map<string, DayRow>();
  for (const row of remote.daily) {
    byDate.set(row.date, withDayPayments(row));
  }
  for (const row of local.daily) {
    const next = withDayPayments(row);
    const current = byDate.get(row.date);
    if (!current) {
      byDate.set(row.date, next);
      continue;
    }
    // Replace the cloud day only when this device has every cloud sale plus
    // extras. More orders with less money means the local mirror is missing
    // other tills, and swapping it in would shrink the report.
    if (next.orders > current.orders && next.totalSales >= current.totalSales) {
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
  const paymentTotals = sumReportPaymentTotals(daily.map(dayPaymentTotals));

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
    paymentTotals,
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

/** Gross tender totals from a list of day orders (Cash / MoMo / Card). */
export function paymentTotalsFromOrders(
  orders: Array<{ total: number; paymentMethod?: string }>,
): ReportPaymentTotals {
  let totals = emptyReportPaymentTotals();
  for (const order of orders) {
    const method = order.paymentMethod;
    if (method === "card") totals = { ...totals, card: totals.card + order.total };
    else if (method === "mobile_money")
      totals = { ...totals, mobileMoney: totals.mobileMoney + order.total };
    else totals = { ...totals, cash: totals.cash + order.total };
  }
  return totals;
}
