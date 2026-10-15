/**
 * Report metric drill-down from Dexie (fully offline Millie's / local till).
 */

import { getOfflineDb } from "./db";

export type LocalReportDetails = {
  title: string;
  columns: string[];
  rows: Array<{
    id: string;
    href: string;
    cells: string[];
    amount?: number;
  }>;
};

type ReportMetric =
  | "grossSales"
  | "refunds"
  | "netSales"
  | "orders"
  | "itemsSold"
  | "itemsReturned"
  | "averageOrder";

function titleFor(metric: ReportMetric) {
  switch (metric) {
    case "refunds":
      return "Refunds";
    case "itemsReturned":
      return "Items returned";
    case "orders":
      return "Orders";
    case "itemsSold":
      return "Items sold";
    case "averageOrder":
      return "Average order";
    case "netSales":
      return "Net sales";
    default:
      return "Gross sales";
  }
}

export async function buildLocalReportDetails(args: {
  metric: ReportMetric;
  startDate: number;
  endDate: number;
  branchId?: string | null;
}): Promise<LocalReportDetails> {
  const db = await getOfflineDb();
  if (!db) {
    return { title: titleFor(args.metric), columns: [], rows: [] };
  }

  const [localSales, localSaleItems, localReturns] = await Promise.all([
    db.localSales.toArray(),
    db.localSaleItems.toArray(),
    db.localReturns.toArray(),
  ]);

  const branchFilter = args.branchId?.trim() || null;
  const sales = localSales
    .filter((sale) => sale.completedAt >= args.startDate && sale.completedAt <= args.endDate)
    .filter((sale) => !branchFilter || !sale.branchId || sale.branchId === branchFilter)
    .sort((a, b) => b.completedAt - a.completedAt);

  if (args.metric === "refunds" || args.metric === "itemsReturned") {
    const saleById = new Map(localSales.map((s) => [s.id, s]));
    const rows = localReturns
      .filter((row) => row.completedAt >= args.startDate && row.completedAt <= args.endDate)
      .filter((row) => {
        if (!branchFilter) return true;
        const sale = saleById.get(row.saleId);
        return !sale?.branchId || sale.branchId === branchFilter;
      })
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, 200)
      .map((row) => {
        const sale = saleById.get(row.saleId);
        return {
          id: row.id,
          href: `/returns/${row.id}`,
          cells: [
            row.returnNumber,
            sale?.invoiceNumber ?? "—",
            String(row.itemCount),
            String(row.refundAmount),
            String(row.completedAt),
          ],
          amount: row.refundAmount,
        };
      });
    return {
      title: titleFor(args.metric),
      columns: ["Return", "Invoice", "Items", "Amount", "Date"],
      rows,
    };
  }

  const itemsBySale = new Map<string, number>();
  for (const item of localSaleItems) {
    itemsBySale.set(item.localSaleId, (itemsBySale.get(item.localSaleId) ?? 0) + item.quantity);
  }
  const refundBySale = new Map<string, number>();
  for (const row of localReturns) {
    refundBySale.set(row.saleId, (refundBySale.get(row.saleId) ?? 0) + row.refundAmount);
  }

  return {
    title: titleFor(args.metric),
    columns: ["Invoice", "Customer", "Branch", "Items", "Total", "Refunded", "Date"],
    rows: sales.slice(0, 200).map((sale) => ({
      id: sale.id,
      href: `/orders/${sale.id}`,
      cells: [
        sale.invoiceNumber,
        sale.customerName,
        sale.branchName ?? "—",
        String(itemsBySale.get(sale.id) ?? sale.itemCount),
        String(sale.total),
        String(refundBySale.get(sale.id) ?? 0),
        String(sale.completedAt),
      ],
      amount: sale.total,
    })),
  };
}
