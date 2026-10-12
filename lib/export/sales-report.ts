import type { ExportTable } from "./types";
import type { LocalSalesReport } from "@/lib/offline/ui-cache";
import { emptyReportPaymentTotals } from "@/lib/payments";

export function salesReportExportTable(args: {
  report: LocalSalesReport;
  start: string;
  end: string;
  branchLabel?: string;
}): ExportTable {
  const { report } = args;
  const payments = report.paymentTotals ?? emptyReportPaymentTotals();
  const rows: Record<string, unknown>[] = [
    {
      section: "KPI",
      date: "",
      orders: report.kpis.totalOrders,
      itemsSold: report.kpis.itemsSold,
      totalSales: report.kpis.totalSales,
      cash: payments.cash,
      mobileMoney: payments.mobileMoney,
      card: payments.card,
      refunds: report.kpis.totalRefunds ?? 0,
      note: "Total sales (net)",
    },
    {
      section: "KPI",
      date: "",
      orders: "",
      itemsSold: "",
      totalSales: report.kpis.grossSales ?? report.kpis.totalSales,
      cash: "",
      mobileMoney: "",
      card: "",
      refunds: "",
      note: "Gross sales",
    },
    {
      section: "KPI",
      date: "",
      orders: "",
      itemsSold: "",
      totalSales: report.kpis.averageOrder,
      cash: "",
      mobileMoney: "",
      card: "",
      refunds: "",
      note: "Average order",
    },
    {
      section: "Payments",
      date: "",
      orders: "",
      itemsSold: "",
      totalSales: payments.cash + payments.mobileMoney + payments.card,
      cash: payments.cash,
      mobileMoney: payments.mobileMoney,
      card: payments.card,
      refunds: "",
      note: "Gross by tender",
    },
    ...report.daily.map((row) => ({
      section: "Daily",
      date: row.date,
      orders: row.orders,
      itemsSold: row.itemsSold,
      totalSales: row.totalSales,
      cash: row.cash ?? 0,
      mobileMoney: row.mobileMoney ?? 0,
      card: row.card ?? 0,
      refunds: row.refunds ?? 0,
      note: "",
    })),
  ];

  return {
    title: "Sales report",
    filenameKind: "Sales-Report",
    filenameSuffix: `${args.start}-to-${args.end}`,
    meta: {
      Start: args.start,
      End: args.end,
      ...(args.branchLabel ? { Branch: args.branchLabel } : {}),
    },
    columns: [
      { key: "section", header: "Section" },
      { key: "date", header: "Date" },
      { key: "orders", header: "Orders" },
      { key: "itemsSold", header: "Items Sold" },
      { key: "totalSales", header: "Total Sales" },
      { key: "cash", header: "Cash" },
      { key: "mobileMoney", header: "MoMo" },
      { key: "card", header: "Card" },
      { key: "refunds", header: "Refunds" },
      { key: "note", header: "Note" },
    ],
    rows,
  };
}
