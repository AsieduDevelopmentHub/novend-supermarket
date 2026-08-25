"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { BranchFilter } from "@/components/filters/branch-filter";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePreferLocalData } from "@/hooks/use-prefer-local-data";
import { useOfflineAnalytics } from "@/hooks/use-offline-analytics";
import { useLocalExpenses } from "@/hooks/use-offline-lists";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueRemoveExpense,
} from "@/lib/offline/replica-writes";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { expenseCategoryLabel, type ExpenseCategory } from "../constants";
import { ExpenseFormDialog, type ExpenseRow } from "./expense-form-dialog";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { Download, Pencil, Plus, Printer, Trash2 } from "lucide-react";
import { brandedCsvName } from "@/lib/export-filenames";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Granularity = "day" | "week" | "month" | "year";

function parseLocalDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function endOfDay(date: Date) {
  return startOfDay(date) + 24 * 60 * 60 * 1000 - 1;
}

function localIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function AnalyticsView() {
  const { isAdmin, isManager, branchName, branchId: myBranchId } = usePermissions();
  const online = useConnectivity();
  const today = localIso(new Date());
  const weekAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return localIso(d);
  })();

  const [start, setStart] = useState(weekAgo);
  const [end, setEnd] = useState(today);
  const [applied, setApplied] = useState({ start: weekAgo, end: today });
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [branchFilter, setBranchFilter] = useState<Id<"branches"> | "all">("all");
  const [deleteTarget, setDeleteTarget] = useState<ExpenseRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const branches = useQuery(api.branches.list, online ? {} : "skip");

  const range = useMemo(() => {
    const startDateObj = parseLocalDate(applied.start);
    const endDateObj = parseLocalDate(applied.end);
    if (!startDateObj || !endDateObj) return null;
    const startDate = startOfDay(startDateObj);
    const endDate = endOfDay(endDateObj);
    if (endDate < startDate) return null;
    return { startDate, endDate };
  }, [applied]);

  const branchArg = isAdmin && branchFilter !== "all" ? branchFilter : undefined;

  const remoteSummary = useQuery(
    api.analytics.summary,
    online && range ? { ...range, granularity, branchId: branchArg } : "skip",
  );
  const preferLocal = usePreferLocalData(remoteSummary !== undefined);
  // Always hydrate Dexie so Cap false-online paints without waiting on Convex.
  const { summary: localSummary } = useOfflineAnalytics(
    range,
    granularity,
    branchArg ? String(branchArg) : null,
    Boolean(range),
  );
  const expensesRemote = useQuery(
    api.analytics.listExpenses,
    online && range && !preferLocal
      ? { startDate: range.startDate, endDate: range.endDate, limit: 200, branchId: branchArg }
      : "skip",
  );
  const expensesLocal = useLocalExpenses(range);
  const removeExpense = useMutation(api.analytics.removeExpense);

  const summary =
    preferLocal || !online ? (localSummary ?? remoteSummary) : (remoteSummary ?? localSummary);
  const expenses =
    expensesRemote ??
    expensesLocal?.map((row) => ({
      id: row.id as Id<"expenses">,
      amount: row.amount,
      category: row.category as ExpenseCategory,
      occurredAt: row.occurredAt,
      description: row.description,
      recordedByName: row.recordedByName,
      branchId: (row.branchId as Id<"branches"> | null) ?? null,
      branchName: row.branchName,
    }));

  if (!summary && remoteSummary === undefined && localSummary === undefined) {
    return <LoadingState label="Loading analytics…" variant="cards" />;
  }

  function onApply() {
    const startDateObj = parseLocalDate(start);
    const endDateObj = parseLocalDate(end);
    if (!startDateObj || !endDateObj) {
      setRangeError("Choose a valid start and end date.");
      toast.error("Choose a valid start and end date.");
      return;
    }
    if (endOfDay(endDateObj) < startOfDay(startDateObj)) {
      setRangeError("End date must be on or after the start date.");
      toast.error("End date must be on or after the start date.");
      return;
    }
    setRangeError(null);
    setApplied({ start, end });
    toast.success("Analytics updated");
  }

  function exportCsv() {
    if (!summary || !range) return;
    const lines = [
      "Section,Metric,Value",
      `P&L,Gross Revenue,${summary.pnl.grossRevenue ?? summary.pnl.revenue}`,
      `P&L,Refunds,${summary.pnl.totalRefunds ?? 0}`,
      `P&L,Net Revenue,${summary.pnl.revenue}`,
      `P&L,COGS,${summary.pnl.cogs}`,
      `P&L,Gross Profit,${summary.pnl.grossProfit}`,
      `P&L,Operating Expenses,${summary.pnl.operatingExpenses}`,
      `P&L,Net Profit,${summary.pnl.netProfit}`,
      `P&L,Profit Margin %,${summary.pnl.profitMargin}`,
      "",
      "Category,Amount",
      ...summary.expenseBreakdown.map(
        (row: { label: string; amount: number }) => `${row.label},${row.amount}`,
      ),
      "",
      "Period,Revenue,COGS,Expenses,Gross Profit,Net Profit",
      ...summary.trend.map(
        (row: {
          period: string;
          revenue: number;
          cogs: number;
          expenses: number;
          grossProfit: number;
          netProfit: number;
        }) =>
          `${row.period},${row.revenue},${row.cogs},${row.expenses},${row.grossProfit},${row.netProfit}`,
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = brandedCsvName("Analytics", `${applied.start}-to-${applied.end}`);
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }

  function printReport() {
    if (!summary) return;
    const rows = summary.expenseBreakdown
      .filter((r: { amount: number; label: string }) => r.amount > 0)
      .map(
        (r: { amount: number; label: string }) =>
          `<tr><td>${escapeHtml(r.label)}</td><td style="text-align:right">${escapeHtml(formatCurrency(r.amount))}</td></tr>`,
      )
      .join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>P&L ${applied.start} – ${applied.end}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { color: #555; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; }
  th, td { border-bottom: 1px solid #ddd; padding: 8px 4px; text-align: left; font-size: 13px; }
  .total { font-weight: 700; }
</style></head><body>
  <h1>Profit &amp; Loss</h1>
  <p>${escapeHtml(applied.start)} to ${escapeHtml(applied.end)}</p>
  <table>
    <tr><td>Gross revenue</td><td style="text-align:right">${escapeHtml(formatCurrency(summary.pnl.grossRevenue ?? summary.pnl.revenue))}</td></tr>
    <tr><td>Refunds</td><td style="text-align:right">${escapeHtml(formatCurrency(summary.pnl.totalRefunds ?? 0))}</td></tr>
    <tr><td>Net revenue</td><td style="text-align:right">${escapeHtml(formatCurrency(summary.pnl.revenue))}</td></tr>
    <tr><td>Cost of goods sold (COGS)</td><td style="text-align:right">${escapeHtml(formatCurrency(summary.pnl.cogs))}</td></tr>
    <tr class="total"><td>Gross profit</td><td style="text-align:right">${escapeHtml(formatCurrency(summary.pnl.grossProfit))}</td></tr>
    <tr><td>Operating expenses</td><td style="text-align:right">${escapeHtml(formatCurrency(summary.pnl.operatingExpenses))}</td></tr>
    <tr class="total"><td>Net profit</td><td style="text-align:right">${escapeHtml(formatCurrency(summary.pnl.netProfit))}</td></tr>
    <tr><td>Profit margin</td><td style="text-align:right">${escapeHtml(String(summary.pnl.profitMargin))}%</td></tr>
  </table>
  <h2 style="font-size:16px;margin-top:24px">Expenses by category</h2>
  <table>
    <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows || "<tr><td colspan='2'>No expenses in range</td></tr>"}</tbody>
  </table>
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute(
      "style",
      "position:fixed;left:-9999px;top:0;width:800px;height:1000px;border:0",
    );
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    if (!doc) {
      iframe.remove();
      toast.error("Could not open print preview");
      return;
    }
    doc.open();
    doc.write(html);
    doc.close();
    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 1500);
    }, 200);
  }

  async function onDelete() {
    if (!deleteTarget) return;
    setDeletePending(true);
    try {
      const kind = await persistBusinessWrite({
        online,
        remote: () => removeExpense({ id: deleteTarget.id }),
        local: () => queueRemoveExpense({ expenseId: deleteTarget.id }),
      });
      toast.success(queuedSaveMessage(kind, "Expense removed"));
      setDeleteTarget(null);
    } catch (error) {
      showError(error, "Could not remove expense");
    } finally {
      setDeletePending(false);
    }
  }

  function metricHref(metric: string) {
    const params = new URLSearchParams({ start: applied.start, end: applied.end });
    if (branchArg) params.set("branch", branchArg);
    return `/analytics/${metric}?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Financial performance, expenses, and profit & loss."
        compactActions={[
          {
            key: "print",
            label: "Print P&L",
            icon: Printer,
            disabled: !summary,
            onClick: printReport,
          },
          {
            key: "export",
            label: "Export CSV",
            icon: Download,
            disabled: !summary,
            onClick: exportCsv,
          },
          {
            key: "expense",
            label: "Record expense",
            icon: Plus,
            onClick: () => {
              setEditing(null);
              setExpenseOpen(true);
            },
          },
        ]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!summary} onClick={printReport}>
              <Printer className="h-4 w-4" />
              Print P&L
            </Button>
            <Button type="button" variant="outline" disabled={!summary} onClick={exportCsv}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setExpenseOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Record expense
            </Button>
          </div>
        }
      />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Start</p>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">End</p>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {isAdmin ? (
            <BranchFilter
              branches={branches}
              value={branchFilter}
              onChange={setBranchFilter}
              allowAll
            />
          ) : isManager && branchName ? (
            <BranchFilter
              branches={branches}
              value={myBranchId}
              onChange={() => undefined}
              lockedLabel={branchName}
            />
          ) : null}
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Trend</p>
            <Select value={granularity} onValueChange={(v) => setGranularity(v as Granularity)}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="day">Daily</SelectItem>
                <SelectItem value="week">Weekly</SelectItem>
                <SelectItem value="month">Monthly</SelectItem>
                <SelectItem value="year">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="button" onClick={onApply}>
            Apply
          </Button>
        </CardContent>
      </Card>

      {rangeError ? <ErrorState message={rangeError} /> : null}

      {!range ? (
        <EmptyState title="Select a date range" />
      ) : !summary ? (
        <LoadingState label="Loading analytics…" variant="cards" />
      ) : (
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="expenses">Expenses</TabsTrigger>
            <TabsTrigger value="pnl">P&L report</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4 space-y-4">
            <Grid cols={5}>
              <Kpi
                title="Revenue"
                value={formatCurrency(summary.kpis.revenue)}
                href={metricHref("revenue")}
              />
              <Kpi
                title="Refunds"
                value={formatCurrency(summary.kpis.totalRefunds ?? 0)}
                href={metricHref("refunds")}
              />
              <Kpi
                title="COGS"
                value={formatCurrency(summary.kpis.cogs)}
                href={metricHref("cogs")}
              />
              <Kpi
                title="Gross profit"
                value={formatCurrency(summary.kpis.grossProfit)}
                href={metricHref("grossProfit")}
              />
              <Kpi
                title="Net profit"
                value={formatCurrency(summary.kpis.netProfit)}
                href={metricHref("netProfit")}
              />
            </Grid>
            <Grid cols={5}>
              <Kpi
                title="Operating expenses"
                value={formatCurrency(summary.kpis.operatingExpenses)}
                href={metricHref("expenses")}
              />
              <Kpi
                title="Profit margin"
                value={`${formatNumber(summary.kpis.profitMargin)}%`}
                href={metricHref("netProfit")}
              />
              <Kpi
                title="Orders"
                value={formatNumber(summary.kpis.totalOrders)}
                href={metricHref("orders")}
              />
              <Kpi
                title="Return rate"
                value={`${formatNumber(summary.kpis.returnRate ?? 0)}%`}
                href={metricHref("returnRate")}
              />
              <Kpi
                title="Expense entries"
                value={formatNumber(summary.kpis.expenseCount)}
                href={metricHref("expenseCount")}
              />
            </Grid>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link href={metricHref("products")} className="text-primary hover:underline">
                Best-selling products →
              </Link>
              <Link href={metricHref("branches")} className="text-primary hover:underline">
                Branch analytics →
              </Link>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Profit trend</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {summary.trend.length === 0 ? (
                  <EmptyState title="No activity in this range" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={summary.trend}>
                      <defs>
                        <linearGradient id="netFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="period" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                        labelFormatter={(label) => String(label)}
                      />
                      <Area
                        type="monotone"
                        dataKey="netProfit"
                        name="Net profit"
                        stroke="#38bdf8"
                        fill="url(#netFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#0f766e"
                        fill="transparent"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="expenses" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle>Expense management</CardTitle>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setExpenseOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </CardHeader>
              <CardContent>
                {expenses === undefined ? (
                  <LoadingState label="Loading expenses…" />
                ) : expenses.length === 0 ? (
                  <EmptyState
                    title="No expenses in this range"
                    description="Record salaries, utilities, and other operating costs."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr className="border-b">
                          <th className="pb-2 font-medium">Date</th>
                          <th className="pb-2 font-medium">Category</th>
                          <th className="pb-2 font-medium">Notes</th>
                          <th className="pb-2 font-medium">Recorded by</th>
                          <th className="pb-2 font-medium">Amount</th>
                          <th className="pb-2 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenses.map((row) => (
                          <tr key={row.id} className="border-border border-b last:border-0">
                            <td className="py-2.5">{formatDateTime(row.occurredAt)}</td>
                            <td className="py-2.5">{expenseCategoryLabel(row.category)}</td>
                            <td className="text-muted-foreground max-w-[220px] truncate py-2.5">
                              {row.description ?? "—"}
                            </td>
                            <td className="py-2.5">{row.recordedByName}</td>
                            <td className="py-2.5 font-medium">{formatCurrency(row.amount)}</td>
                            <td className="py-2.5">
                              <div className="flex gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    setEditing({
                                      id: row.id,
                                      amount: row.amount,
                                      category: row.category as ExpenseCategory,
                                      occurredAt: row.occurredAt,
                                      description: row.description,
                                    });
                                    setExpenseOpen(true);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() =>
                                    setDeleteTarget({
                                      id: row.id,
                                      amount: row.amount,
                                      category: row.category as ExpenseCategory,
                                      occurredAt: row.occurredAt,
                                      description: row.description,
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Breakdown by category</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.expenseBreakdown.map(
                  (row: { label: string; amount: number; category: string }) => (
                    <div key={row.category} className="flex items-center justify-between text-sm">
                      <span>{row.label}</span>
                      <span className="font-medium">{formatCurrency(row.amount)}</span>
                    </div>
                  ),
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pnl" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  Profit & loss · {applied.start} → {applied.end}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <PnLRow
                  label="Gross revenue"
                  value={summary.pnl.grossRevenue ?? summary.pnl.revenue}
                />
                <PnLRow label="Refunds" value={summary.pnl.totalRefunds ?? 0} negative />
                <PnLRow label="Net revenue" value={summary.pnl.revenue} emphasize />
                <PnLRow label="Cost of goods sold (COGS)" value={summary.pnl.cogs} negative />
                <PnLRow label="Gross profit" value={summary.pnl.grossProfit} emphasize />
                <PnLRow label="Operating expenses" value={summary.pnl.operatingExpenses} negative />
                <PnLRow label="Net profit" value={summary.pnl.netProfit} emphasize />
                <div className="text-muted-foreground flex justify-between border-t pt-3">
                  <span>Profit margin</span>
                  <span>{formatNumber(summary.pnl.profitMargin)}%</span>
                </div>
                <p className="text-muted-foreground text-xs">
                  A return reduces net revenue by the refund, COGS by the item cost, and profit by
                  the margin only. COGS uses each sale line&apos;s cost snapshot; older sales
                  without a snapshot fall back to the product&apos;s current cost price.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <ExpenseFormDialog
        open={expenseOpen}
        onOpenChange={(open) => {
          setExpenseOpen(open);
          if (!open) setEditing(null);
        }}
        expense={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete expense?"
        description={
          deleteTarget
            ? `Remove this ${formatCurrency(deleteTarget.amount)} expense record permanently?`
            : ""
        }
        confirmLabel="Delete"
        pending={deletePending}
        onConfirm={onDelete}
      />
    </div>
  );
}

function Kpi({ title, value, href }: { title: string; value: string; href?: string }) {
  const card = (
    <Card className={href ? "hover:border-primary/40 transition-colors" : undefined}>
      <CardContent className="min-w-0 p-5">
        <p className="text-muted-foreground text-sm">{title}</p>
        <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
        {href ? <p className="text-primary mt-2 text-xs font-medium">View records →</p> : null}
      </CardContent>
    </Card>
  );
  if (!href) return card;
  return (
    <Link href={href} className="min-w-0">
      {card}
    </Link>
  );
}

function PnLRow({
  label,
  value,
  negative,
  emphasize,
}: {
  label: string;
  value: number;
  negative?: boolean;
  emphasize?: boolean;
}) {
  return (
    <div className={`flex justify-between ${emphasize ? "text-base font-semibold" : ""}`}>
      <span>{label}</span>
      <span className={negative ? "text-muted-foreground" : ""}>
        {negative ? "−" : ""}
        {formatCurrency(Math.abs(value))}
      </span>
    </div>
  );
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
