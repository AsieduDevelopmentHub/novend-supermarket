"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid } from "@/components/layout/primitives";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { BranchFilter } from "@/components/filters/branch-filter";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { buildLocalSalesReport, type LocalSalesReport } from "@/lib/offline/ui-cache";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC off-by-one). */
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

export function ReportsView() {
  const todayLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const weekAgoLocal = () => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  const { isAdmin, isManager, branchName, branchId: myBranchId } = usePermissions();
  const online = useConnectivity();
  const router = useRouter();
  const [branchFilter, setBranchFilter] = useState<Id<"branches"> | "all">("all");
  const [start, setStart] = useState(weekAgoLocal);
  const [end, setEnd] = useState(todayLocal);
  const [applied, setApplied] = useState({ start: weekAgoLocal(), end: todayLocal() });
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [localReport, setLocalReport] = useState<LocalSalesReport | null>(null);
  const [localLoading, setLocalLoading] = useState(false);

  const branches = useQuery(api.branches.list, online && (isAdmin || isManager) ? {} : "skip");

  const range = useMemo(() => {
    const startDateObj = parseLocalDate(applied.start);
    const endDateObj = parseLocalDate(applied.end);
    if (!startDateObj || !endDateObj) return null;
    const startDate = startOfDay(startDateObj);
    const endDate = endOfDay(endDateObj);
    if (Number.isNaN(startDate) || Number.isNaN(endDate) || endDate < startDate) {
      return null;
    }
    return { startDate, endDate };
  }, [applied]);

  const remoteReport = useQuery(
    api.reports.salesSummary,
    online && range
      ? {
          ...range,
          branchId: isAdmin && branchFilter !== "all" ? branchFilter : undefined,
        }
      : "skip",
  );

  useEffect(() => {
    if (online || !range) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLocalLoading(true);
      void buildLocalSalesReport(range.startDate, range.endDate).then((next) => {
        if (cancelled) return;
        setLocalReport(next);
        setLocalLoading(false);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [online, range]);

  const report = online ? remoteReport : localReport;

  function onGenerate() {
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
    toast.success("Report generated");
  }

  function metricHref(metric: string) {
    const params = new URLSearchParams({ start: applied.start, end: applied.end });
    if (isAdmin && branchFilter !== "all") params.set("branch", branchFilter);
    return `/reports/${metric}?${params.toString()}`;
  }

  function dayHref(date: string) {
    const params = new URLSearchParams({
      date,
      start: applied.start,
      end: applied.end,
    });
    if (isAdmin && branchFilter !== "all") params.set("branch", branchFilter);
    return `/reports/day?${params.toString()}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Sales performance over a selected period." />

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Start</p>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">End</p>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          {isAdmin && online ? (
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
          <Button type="button" onClick={onGenerate}>
            Generate
          </Button>
        </CardContent>
      </Card>

      {rangeError ? <ErrorState message={rangeError} /> : null}

      {!range ? (
        <EmptyState title="Select a date range" description="Choose dates and click Generate." />
      ) : (online && report === undefined) || (!online && localLoading) ? (
        <LoadingState label="Generating report…" variant="cards" />
      ) : report ? (
        <>
          <Grid cols={4}>
            <Kpi
              title="Gross Sales"
              value={formatCurrency(report.kpis.grossSales ?? report.kpis.totalSales)}
              href={metricHref("grossSales")}
            />
            <Kpi
              title="Refunds"
              value={formatCurrency(report.kpis.totalRefunds ?? 0)}
              href={metricHref("refunds")}
            />
            <Kpi
              title="Net Sales"
              value={formatCurrency(report.kpis.totalSales)}
              href={metricHref("netSales")}
            />
            <Kpi
              title="Total Orders"
              value={formatNumber(report.kpis.totalOrders)}
              href={metricHref("orders")}
            />
          </Grid>
          <Grid cols={4}>
            <Kpi
              title="Items Sold"
              value={formatNumber(report.kpis.itemsSold)}
              href={metricHref("itemsSold")}
            />
            <Kpi
              title="Items Returned"
              value={formatNumber(report.kpis.itemsReturned ?? 0)}
              href={metricHref("itemsReturned")}
            />
            <Kpi
              title="Average Order"
              value={formatCurrency(report.kpis.averageOrder)}
              href={metricHref("averageOrder")}
            />
          </Grid>

          <Card>
            <CardHeader>
              <CardTitle>Sales Over Time</CardTitle>
            </CardHeader>
            <CardContent className="h-72 cursor-pointer">
              {report.trend.length === 0 ? (
                <EmptyState title="No sales in this range" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={report.trend}
                    onClick={(state) => {
                      const date = state?.activeLabel;
                      if (typeof date === "string") router.push(dayHref(date));
                    }}
                  >
                    <defs>
                      <linearGradient id="reportFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tickFormatter={(v) => String(v).slice(5)} fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#38bdf8"
                      fill="url(#reportFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily breakdown</CardTitle>
              <CardDescription>Open a day to see its orders and refunds.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {report.daily.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No rows" />
                </div>
              ) : (
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-muted-foreground">
                    <tr>
                      <th className="px-4 pb-2 pt-1 font-medium">Date</th>
                      <th className="px-4 pb-2 pt-1 font-medium">Orders</th>
                      <th className="px-4 pb-2 pt-1 font-medium">Items Sold</th>
                      <th className="px-4 pb-2 pt-1 font-medium">Total Sales</th>
                      <th className="px-4 pb-2 pt-1 font-medium">Refunds</th>
                      <th className="px-4 pb-2 pt-1 font-medium">
                        <span className="sr-only">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.daily.map((row) => (
                      <ClickableTableRow key={row.date} href={dayHref(row.date)}>
                        <td className="px-4 py-2.5 font-medium">{row.date}</td>
                        <td className="px-4 py-2.5">{row.orders}</td>
                        <td className="px-4 py-2.5">{row.itemsSold}</td>
                        <td className="px-4 py-2.5">{formatCurrency(row.totalSales)}</td>
                        <td className="px-4 py-2.5">{formatCurrency(row.refunds ?? 0)}</td>
                        <td className="text-primary px-4 py-2.5 text-xs font-medium">View →</td>
                      </ClickableTableRow>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState title="No report data" />
      )}
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
