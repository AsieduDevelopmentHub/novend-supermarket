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

const METRICS = [
  "grossSales",
  "refunds",
  "netSales",
  "orders",
  "itemsSold",
  "itemsReturned",
  "averageOrder",
] as const;

type ReportMetric = (typeof METRICS)[number];

function isMetric(value: string): value is ReportMetric {
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
  if (["Amount", "Total", "Refunded"].includes(column)) {
    const n = Number(value);
    return Number.isFinite(n) ? formatCurrency(n) : value;
  }
  return value;
}

export function ReportMetricDetailView({ metric }: { metric: string }) {
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

  const details = useQuery(
    api.reports.details,
    online && range && isMetric(metric)
      ? {
          metric,
          ...range,
          branchId: branch ? (branch as Id<"branches">) : undefined,
        }
      : "skip",
  );
  const preferLocal = usePreferLocalData(details !== undefined);

  if (!isMetric(metric) || !range) {
    return <ErrorState message="Choose a valid metric and date range from Reports." />;
  }

  const loading = online && !preferLocal && details === undefined;
  const unavailableOffline = (!online || preferLocal) && details === undefined;

  return (
    <div className="min-w-0 max-w-full space-y-6 overflow-x-hidden">
      <PageHeader
        title={details?.title ?? "Report detail"}
        description={`${start} → ${end}`}
        actions={
          <Button asChild variant="outline">
            <Link href="/reports">
              <ArrowLeft className="h-4 w-4" />
              Reports
            </Link>
          </Button>
        }
      />
      {loading ? (
        <LoadingState label="Loading records…" variant="table" />
      ) : unavailableOffline ? (
        <EmptyState
          title="Detail rows need a connection"
          description="Summary reports still work offline from this device. Reconnect to open line-item drill-down."
        />
      ) : details && details.rows.length === 0 ? (
        <EmptyState title="No records in this range" />
      ) : details ? (
        <Card className="min-w-0 overflow-hidden">
          <CardContent className="min-w-0 max-w-full overflow-x-auto p-0">
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
      ) : (
        <EmptyState title="No records in this range" />
      )}
    </div>
  );
}
