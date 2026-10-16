"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Grid } from "@/components/layout/primitives";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { BranchFilter } from "@/components/filters/branch-filter";
import { PeriodFilter } from "@/components/filters/period-filter";
import { ExportMenu } from "@/components/export/export-menu";
import { TillSessionsCard } from "@/features/reports/components/till-sessions-card";
import { SINGLE_STORE } from "@/constants/app";
import { usePermissions } from "@/hooks/use-permissions";
import { useLicense } from "@/hooks/use-license";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useBranchesList } from "@/hooks/use-offline-lists";
import { usePreferLocalData } from "@/hooks/use-prefer-local-data";
import { buildLocalSalesReport, type LocalSalesReport } from "@/lib/offline/ui-cache";
import { mergeSalesReportWithLocal } from "@/lib/offline/report-merge";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { salesReportExportTable } from "@/lib/export/sales-report";
import { CURRENCY_SYMBOL, formatCurrency, formatMoneyAmount, formatNumber } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { PaymentTotalsCard } from "@/components/data-display/payment-totals-card";
import { emptyReportPaymentTotals } from "@/lib/payments";
import { InventoryValuePanel } from "@/features/inventory/components/inventory-value-panel";
import { useNarrowScreen } from "@/hooks/use-narrow-screen";
import { useUserFilterPreferences } from "@/hooks/use-user-filter-preferences";
import {
  isPeriodPreset,
  resolvePeriodPreset,
  type PeriodPreset,
} from "@/lib/period-filter";
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

type ReportFilterPreferences = {
  preset: PeriodPreset;
  customStart: string;
  customEnd: string;
  branchFilter: string;
};

function createReportFilterPreferences(): ReportFilterPreferences {
  const range = resolvePeriodPreset("last_7_days");
  return {
    preset: "last_7_days",
    customStart: range.start,
    customEnd: range.end,
    branchFilter: "all",
  };
}

function isReportFilterPreferences(value: unknown): value is ReportFilterPreferences {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    isPeriodPreset(row.preset) &&
    typeof row.customStart === "string" &&
    typeof row.customEnd === "string" &&
    typeof row.branchFilter === "string"
  );
}

export function ReportsView() {
  const { isAdmin, isManager, isCashier, branchName, branchId: myBranchId, userId } =
    usePermissions();
  const { capabilities, planName } = useLicense();
  const online = useConnectivity();
  const router = useRouter();
  const narrow = useNarrowScreen();
  const initialFilters = useMemo(createReportFilterPreferences, []);
  const [filters, setFilters] = useUserFilterPreferences(
    "reports",
    userId,
    initialFilters,
    isReportFilterPreferences,
  );
  const selectedDates = useMemo(
    () =>
      filters.preset === "custom"
        ? { start: filters.customStart, end: filters.customEnd }
        : resolvePeriodPreset(filters.preset),
    [filters.preset, filters.customStart, filters.customEnd],
  );
  const start = selectedDates.start;
  const end = selectedDates.end;
  const branchFilter = filters.branchFilter as Id<"branches"> | "all";
  const reportBranchId = isAdmin
    ? (branchFilter === "all" ? undefined : String(branchFilter))
    : (myBranchId ? String(myBranchId) : undefined);
  const [localReport, setLocalReport] = useState<LocalSalesReport | null>(null);

  const branches = useBranchesList(false, Boolean(isAdmin || isManager));

  const range = useMemo(() => {
    const startDateObj = parseLocalDate(start);
    const endDateObj = parseLocalDate(end);
    if (!startDateObj || !endDateObj) return null;
    const startDate = startOfDay(startDateObj);
    const endDate = endOfDay(endDateObj);
    if (Number.isNaN(startDate) || Number.isNaN(endDate) || endDate < startDate) {
      return null;
    }
    return { startDate, endDate };
  }, [start, end]);

  const rangeError = range ? null : "Choose a valid period or custom date range.";

  useEffect(() => {
    if (!isAdmin || !branches || branchFilter === "all") return;
    if (branches.some((branch) => branch.id === branchFilter)) return;
    setFilters((current) => ({ ...current, branchFilter: "all" }));
  }, [isAdmin, branches, branchFilter, setFilters]);

  const remoteReport = useAuthedQuery(
    api.reports.salesSummary,
    online && range
      ? {
          ...range,
          branchId: isAdmin && branchFilter !== "all" ? branchFilter : undefined,
        }
      : "skip",
  );
  const preferLocal = usePreferLocalData(remoteReport !== undefined);

  // Always hydrate Dexie so Cap false-online never waits on a hung Convex query,
  // and so sales still uploading on this device appear in Daily Orders.
  const reportCashierId = isCashier && userId ? userId : undefined;

  useEffect(() => {
    if (!range) return;
    let cancelled = false;
    function load() {
      void buildLocalSalesReport(
        range!.startDate,
        range!.endDate,
        reportBranchId,
        reportCashierId,
      ).then((next) => {
        if (cancelled) return;
        setLocalReport(next);
      });
    }
    const timer = window.setTimeout(load, 0);
    const unsubscribe = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      unsubscribe();
    };
  }, [range, reportBranchId, reportCashierId]);

  const report =
    preferLocal || !online
      ? (localReport ?? remoteReport ?? null)
      : mergeSalesReportWithLocal(remoteReport, localReport);
  const recordExport = useMutation(api.imports.recordExport);
  const exportTable = report
    ? salesReportExportTable({
        report,
        start: start,
        end: end,
        branchLabel:
          isAdmin && branchFilter !== "all"
            ? branches?.find((b) => b.id === branchFilter)?.name
            : (branchName ?? undefined),
      })
    : null;

  function metricHref(metric: string) {
    const params = new URLSearchParams({ start: start, end: end });
    if (isAdmin && branchFilter !== "all") params.set("branch", branchFilter);
    return `/reports/${metric}?${params.toString()}`;
  }

  function dayHref(date: string) {
    const params = new URLSearchParams({
      date,
      start: start,
      end: end,
    });
    if (isAdmin && branchFilter !== "all") params.set("branch", branchFilter);
    return `/reports/day?${params.toString()}`;
  }

  return (
    <div className="max-w-full min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title="Reports"
        description="Sales performance over a selected period."
        actions={
          <div
            className="flex w-full min-w-0 flex-wrap items-end justify-end gap-2 sm:w-auto"
            data-tour="reports-range"
          >
            <PeriodFilter
              inline
              preset={filters.preset}
              start={start}
              end={end}
              onPresetChange={(preset) =>
                setFilters((current) => ({ ...current, preset }))
              }
              onCustomRangeChange={(next) =>
                setFilters((current) => ({
                  ...current,
                  preset: "custom",
                  customStart: next.start,
                  customEnd: next.end,
                }))
              }
              className="min-w-0 shrink-0"
            />
            {!SINGLE_STORE && isAdmin ? (
              <BranchFilter
                inline
                branches={branches}
                value={branchFilter}
                onChange={(next) =>
                  setFilters((current) => ({ ...current, branchFilter: String(next) }))
                }
                allowAll
                className="min-w-0 shrink-0"
              />
            ) : !SINGLE_STORE && isManager && branchName ? (
              <BranchFilter
                inline
                branches={branches}
                value={myBranchId}
                onChange={() => undefined}
                lockedLabel={branchName}
                className="min-w-0 shrink-0"
              />
            ) : null}
            <div data-tour="reports-export">
              <ExportMenu
                table={exportTable}
                capabilities={capabilities}
                planName={planName}
                disabled={!report}
                onExported={(format, count) => {
                  void recordExport({ kind: "reports", format, rowCount: count }).catch(
                    () => undefined,
                  );
                }}
              />
            </div>
          </div>
        }
      />

      {rangeError ? <ErrorState message={rangeError} /> : null}

      {!range ? (
        <EmptyState title="Select a date range" description="Choose a valid period or custom dates." />
      ) : !report ? (
        <LoadingState label="Generating report…" variant="cards" />
      ) : (
        <>
          <div data-tour="reports-summary">
            <Grid cols={4}>
              <Kpi
                title="Gross Sales"
                value={formatMoneyAmount(report.kpis.grossSales ?? report.kpis.totalSales)}
                unit={CURRENCY_SYMBOL}
                href={metricHref("grossSales")}
              />
              <Kpi
                title="Refunds"
                value={formatMoneyAmount(report.kpis.totalRefunds ?? 0)}
                unit={CURRENCY_SYMBOL}
                href={metricHref("refunds")}
              />
              <Kpi
                title="Net Sales"
                value={formatMoneyAmount(report.kpis.totalSales)}
                unit={CURRENCY_SYMBOL}
                href={metricHref("netSales")}
              />
              <Kpi
                title="Total Orders"
                value={formatNumber(report.kpis.totalOrders)}
                href={metricHref("orders")}
              />
            </Grid>
          </div>
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
              value={formatMoneyAmount(report.kpis.averageOrder)}
              unit={CURRENCY_SYMBOL}
              href={metricHref("averageOrder")}
            />
          </Grid>

          <PaymentTotalsCard
            totals={report.paymentTotals ?? emptyReportPaymentTotals()}
            description="Gross sales by payment method — includes unsynced sales on this till."
          />

          {isAdmin || isManager ? (
            <TillSessionsCard mode="recent" limit={25} />
          ) : null}

          {isAdmin || isManager ? (
            <InventoryValuePanel
              range={range}
              branchId={isAdmin && branchFilter !== "all" ? branchFilter : undefined}
              enabled
            />
          ) : null}

          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>Sales Over Time</CardTitle>
            </CardHeader>
            <CardContent className="h-52 min-w-0 cursor-pointer overflow-hidden sm:h-72">
              {report.trend.length === 0 ? (
                <EmptyState title="No sales in this range" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={report.trend}
                    margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
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
                    <YAxis hide={narrow} width={36} fontSize={12} />
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

          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>Daily breakdown</CardTitle>
              <CardDescription>Open a day to see its orders and refunds.</CardDescription>
            </CardHeader>
            <CardContent className="min-w-0 p-0">
              {report.daily.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No rows" />
                </div>
              ) : (
                <>
                  <div className="hidden max-w-full overflow-x-auto md:block">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="text-muted-foreground">
                        <tr>
                          <th className="px-4 pt-1 pb-2 font-medium">Date</th>
                          <th className="px-4 pt-1 pb-2 font-medium">Orders</th>
                          <th className="px-4 pt-1 pb-2 font-medium">Items Sold</th>
                          <th className="px-4 pt-1 pb-2 font-medium">Net sales</th>
                          <th className="px-4 pt-1 pb-2 font-medium">Cash</th>
                          <th className="px-4 pt-1 pb-2 font-medium">MoMo</th>
                          <th className="px-4 pt-1 pb-2 font-medium">Card</th>
                          <th className="px-4 pt-1 pb-2 font-medium">Refunds</th>
                          <th className="px-4 pt-1 pb-2 font-medium">
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
                            <td className="px-4 py-2.5">{formatCurrency(row.cash ?? 0)}</td>
                            <td className="px-4 py-2.5">{formatCurrency(row.mobileMoney ?? 0)}</td>
                            <td className="px-4 py-2.5">{formatCurrency(row.card ?? 0)}</td>
                            <td className="px-4 py-2.5">{formatCurrency(row.refunds ?? 0)}</td>
                            <td className="text-primary px-4 py-2.5 text-xs font-medium">View →</td>
                          </ClickableTableRow>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="space-y-2 p-3 md:hidden">
                    {report.daily.map((row) => (
                      <Link
                        key={row.date}
                        href={dayHref(row.date)}
                        className="border-border hover:border-primary block min-w-0 rounded-lg border px-3 py-2.5"
                      >
                        <div className="flex justify-between gap-2">
                          <p className="min-w-0 truncate font-medium">{row.date}</p>
                          <p className="shrink-0 font-semibold whitespace-nowrap">
                            {formatCurrency(row.totalSales)}
                            <span className="text-muted-foreground ml-1 text-xs font-medium">net</span>
                          </p>
                        </div>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {row.orders} orders · {row.itemsSold} items · Cash{" "}
                          {formatCurrency(row.cash ?? 0)} · MoMo{" "}
                          {formatCurrency(row.mobileMoney ?? 0)} · Card{" "}
                          {formatCurrency(row.card ?? 0)} ·{" "}
                          {formatCurrency(row.refunds ?? 0)} refunds
                        </p>
                      </Link>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Kpi({
  title,
  value,
  href,
  unit,
}: {
  title: string;
  value: string;
  href?: string;
  unit?: string;
}) {
  const card = (
    <Card className={cn("h-full min-w-0", href && "hover:border-primary/40 transition-colors")}>
      <CardContent className="min-w-0 p-4 sm:p-5">
        <div className="flex h-full flex-col gap-2 md:hidden">
          <div className="@container min-w-0">
            <p className="font-semibold tracking-tight whitespace-nowrap tabular-nums text-lg @[8rem]:text-xl @[10rem]:text-2xl">
              {value}
            </p>
          </div>
          <p className="text-muted-foreground text-sm leading-snug">
            {title}
            {unit ? <span className="text-muted-foreground/80 font-medium"> · {unit}</span> : null}
          </p>
          {href ? <p className="text-primary text-xs font-medium">View records →</p> : null}
        </div>
        <div className="hidden md:block">
          <p className="text-muted-foreground truncate text-sm whitespace-nowrap">
            {title}
            {unit ? <span className="text-muted-foreground/80 font-medium"> · {unit}</span> : null}
          </p>
          <div className="@container mt-2 min-w-0">
            <p className="font-semibold tracking-tight whitespace-nowrap tabular-nums text-lg @[8rem]:text-xl @[10rem]:text-2xl">
              {value}
            </p>
          </div>
          {href ? <p className="text-primary mt-2 text-xs font-medium">View records →</p> : null}
        </div>
      </CardContent>
    </Card>
  );
  if (!href) return card;
  return (
    <Link href={href} className="block h-full min-w-0">
      {card}
    </Link>
  );
}
