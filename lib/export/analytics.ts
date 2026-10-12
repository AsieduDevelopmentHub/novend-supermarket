import type { ExportTable } from "./types";
import type { ReportPaymentTotals } from "@/lib/payments";

export type AnalyticsExportInput = {
  start: string;
  end: string;
  branchLabel?: string;
  granularity?: string;
  pnl: {
    grossRevenue?: number;
    revenue: number;
    totalRefunds?: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    profitMargin: number;
  };
  paymentTotals?: ReportPaymentTotals;
  expenseBreakdown: Array<{ label: string; amount: number }>;
  trend: Array<{
    period: string;
    revenue: number;
    cogs: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
  }>;
};

export function analyticsExportTable(input: AnalyticsExportInput): ExportTable {
  const rows: Record<string, unknown>[] = [
    {
      section: "P&L",
      label: "Gross revenue",
      amount: input.pnl.grossRevenue ?? input.pnl.revenue,
      period: "",
      revenue: "",
      cogs: "",
      expenses: "",
      grossProfit: "",
      netProfit: "",
    },
    {
      section: "P&L",
      label: "Refunds",
      amount: input.pnl.totalRefunds ?? 0,
      period: "",
      revenue: "",
      cogs: "",
      expenses: "",
      grossProfit: "",
      netProfit: "",
    },
    {
      section: "P&L",
      label: "Net revenue",
      amount: input.pnl.revenue,
      period: "",
      revenue: "",
      cogs: "",
      expenses: "",
      grossProfit: "",
      netProfit: "",
    },
    {
      section: "P&L",
      label: "COGS",
      amount: input.pnl.cogs,
      period: "",
      revenue: "",
      cogs: "",
      expenses: "",
      grossProfit: "",
      netProfit: "",
    },
    {
      section: "P&L",
      label: "Gross profit",
      amount: input.pnl.grossProfit,
      period: "",
      revenue: "",
      cogs: "",
      expenses: "",
      grossProfit: "",
      netProfit: "",
    },
    {
      section: "P&L",
      label: "Operating expenses",
      amount: input.pnl.operatingExpenses,
      period: "",
      revenue: "",
      cogs: "",
      expenses: "",
      grossProfit: "",
      netProfit: "",
    },
    {
      section: "P&L",
      label: "Net profit",
      amount: input.pnl.netProfit,
      period: "",
      revenue: "",
      cogs: "",
      expenses: "",
      grossProfit: "",
      netProfit: "",
    },
    {
      section: "P&L",
      label: "Profit margin %",
      amount: input.pnl.profitMargin,
      period: "",
      revenue: "",
      cogs: "",
      expenses: "",
      grossProfit: "",
      netProfit: "",
    },
    ...(input.paymentTotals
      ? [
          {
            section: "Payments",
            label: "Cash",
            amount: input.paymentTotals.cash,
            period: "",
            revenue: "",
            cogs: "",
            expenses: "",
            grossProfit: "",
            netProfit: "",
          },
          {
            section: "Payments",
            label: "MoMo",
            amount: input.paymentTotals.mobileMoney,
            period: "",
            revenue: "",
            cogs: "",
            expenses: "",
            grossProfit: "",
            netProfit: "",
          },
          {
            section: "Payments",
            label: "Card",
            amount: input.paymentTotals.card,
            period: "",
            revenue: "",
            cogs: "",
            expenses: "",
            grossProfit: "",
            netProfit: "",
          },
        ]
      : []),
    ...input.expenseBreakdown.map((row) => ({
      section: "Expense",
      label: row.label,
      amount: row.amount,
      period: "",
      revenue: "",
      cogs: "",
      expenses: "",
      grossProfit: "",
      netProfit: "",
    })),
    ...input.trend.map((row) => ({
      section: "Trend",
      label: "",
      amount: "",
      period: row.period,
      revenue: row.revenue,
      cogs: row.cogs,
      expenses: row.expenses,
      grossProfit: row.grossProfit,
      netProfit: row.netProfit,
    })),
  ];

  return {
    title: "Analytics",
    filenameKind: "Analytics",
    filenameSuffix: `${input.start}-to-${input.end}`,
    meta: {
      Start: input.start,
      End: input.end,
      ...(input.granularity ? { Granularity: input.granularity } : {}),
      ...(input.branchLabel ? { Branch: input.branchLabel } : {}),
    },
    columns: [
      { key: "section", header: "Section" },
      { key: "label", header: "Label" },
      { key: "amount", header: "Amount" },
      { key: "period", header: "Period" },
      { key: "revenue", header: "Revenue" },
      { key: "cogs", header: "COGS" },
      { key: "expenses", header: "Expenses" },
      { key: "grossProfit", header: "Gross Profit" },
      { key: "netProfit", header: "Net Profit" },
    ],
    rows,
  };
}
