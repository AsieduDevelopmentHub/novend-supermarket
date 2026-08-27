import type { ExportTable } from "./types";
import type { LocalSalesReport } from "@/lib/offline/ui-cache";

export function salesReportExportTable(args: {
  report: LocalSalesReport;
  start: string;
  end: string;
  branchLabel?: string;
}): ExportTable {
  const { report } = args;
  const rows: Record<string, unknown>[] = [
    {
      section: "KPI",
      date: "",
      orders: report.kpis.totalOrders,
      itemsSold: report.kpis.itemsSold,
      totalSales: report.kpis.totalSales,
      refunds: report.kpis.totalRefunds ?? 0,
      note: "Total sales (net)",
    },
    {
      section: "KPI",
      date: "",
      orders: "",
      itemsSold: "",
      totalSales: report.kpis.grossSales ?? report.kpis.totalSales,
      refunds: "",
      note: "Gross sales",
    },
    {
      section: "KPI",
      date: "",
      orders: "",
      itemsSold: "",
      totalSales: report.kpis.averageOrder,
      refunds: "",
      note: "Average order",
    },
    ...report.daily.map((row) => ({
      section: "Daily",
      date: row.date,
      orders: row.orders,
      itemsSold: row.itemsSold,
      totalSales: row.totalSales,
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
      { key: "refunds", header: "Refunds" },
      { key: "note", header: "Note" },
    ],
    rows,
  };
}
