"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { ArrowLeft } from "lucide-react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePreferLocalData } from "@/hooks/use-prefer-local-data";
import { useOfflineAnalyticsDetails } from "@/hooks/use-offline-analytics-details";
import type { AnalyticsDetailMetric } from "@/lib/offline/analytics-engine";

const METRICS = [
  "revenue",
  "refunds",
  "cogs",
  "grossProfit",
  "netProfit",
  "expenses",
  "orders",
  "returnRate",
  "expenseCount",
  "products",
  "branches",
] as const satisfies readonly AnalyticsDetailMetric[];

type AnalyticsMetric = (typeof METRICS)[number];

function isMetric(value: string): value is AnalyticsMetric {
  return (METRICS as readonly string[]).includes(value);
}

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

function formatCell(column: string, value: string) {
  if (column === "Date") {
    const ts = Number(value);
    return Number.isFinite(ts) ? formatDateTime(ts) : value;
  }
  if (
    [
      "Amount",
      "Revenue",
      "Profit",
      "Total",
      "Refunded",
      "Refunds",
      "Expenses",
      "Net",
      "COGS",
    ].includes(column)
  ) {
    const n = Number(value);
    return Number.isFinite(n) ? formatCurrency(n) : value;
  }
  return value;
}

type DetailPayload = {
  title: string;
  columns: string[];
  rows: Array<{ id: string; href: string; cells: string[] }>;
};

export function AnalyticsMetricDetailView({ metric }: { metric: string }) {
  const online = useConnectivity();
  const params = useSearchParams();
  const start = params.get("start") ?? "";
  const end = params.get("end") ?? "";
  const branch = params.get("branch");

  const range = useMemo(() => {
    const startDateObj = parseLocalDate(start);
    const endDateObj = parseLocalDate(end);
    if (!startDateObj || !endDateObj) return null;
    return { startDate: startOfDay(startDateObj), endDate: endOfDay(endDateObj) };
  }, [start, end]);

  const metricKey = isMetric(metric) ? metric : null;

  const remoteDetails = useQuery(
    api.analytics.details,
    online && range && metricKey
      ? {
          metric: metricKey,
          ...range,
          branchId: branch ? (branch as Id<"branches">) : undefined,
        }
      : "skip",
  );
  const preferLocal = usePreferLocalData(remoteDetails !== undefined);

  const { details: localDetails, loading: localLoading } = useOfflineAnalyticsDetails(
    metricKey ?? "revenue",
    range,
    branch,
    Boolean(metricKey && range),
  );

  if (!metricKey || !range) {
    return <ErrorState message="Choose a valid metric and date range from Analytics." />;
  }

  const useLocal = preferLocal || !online;
  const details: DetailPayload | undefined = useLocal
    ? localLoading
      ? undefined
      : (localDetails ?? remoteDetails ?? undefined)
    : (remoteDetails ?? localDetails ?? undefined);
  const loading = useLocal
    ? localLoading && details === undefined
    : remoteDetails === undefined && details === undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={details?.title ?? "Metric detail"}
        description={`${start} → ${end}${useLocal ? " · Offline records on this device" : ""}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/analytics">
              <ArrowLeft className="h-4 w-4" />
              Analytics
            </Link>
          </Button>
        }
      />
      {loading ? (
        <LoadingState label="Loading records…" variant="table" />
      ) : !details || details.rows.length === 0 ? (
        <EmptyState title="No records in this range" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {details.columns.map((column) => (
                    <th key={column} className="px-4 py-3 font-medium">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {details.rows.map((row) => (
                  <ClickableTableRow key={row.id} href={row.href}>
                    {row.cells.map((cell, index) => (
                      <td key={`${row.id}-${index}`} className="px-4 py-3">
                        {formatCell(details.columns[index] ?? "", cell)}
                      </td>
                    ))}
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
