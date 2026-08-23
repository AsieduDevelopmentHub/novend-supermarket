"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { formatPlanBytes } from "@/convex/shared/plans";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformInsightData } from "@/hooks/use-platform-offline-data";
import type { PlatformInsightMetric } from "@/convex/platformAnalytics";
import type { PlatformRevenueRange } from "@/lib/offline/platform-cache";

const RANGES: { id: PlatformRevenueRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "12m", label: "12 months" },
];

const MONEY_METRICS = new Set<PlatformInsightMetric>(["mrr", "arr"]);
const BYTES_METRICS = new Set<PlatformInsightMetric>(["cloud-storage"]);

function formatMetricValue(metric: PlatformInsightMetric, value: number) {
  if (MONEY_METRICS.has(metric)) return formatCurrency(value);
  if (BYTES_METRICS.has(metric)) return formatPlanBytes(value);
  return formatNumber(value);
}

export function PlatformInsightDetailView({ metric }: { metric: PlatformInsightMetric }) {
  const online = useConnectivity();
  const [range, setRange] = useState<PlatformRevenueRange>("12m");
  const { data, loading } = usePlatformInsightData(metric, range);

  if (loading || data === undefined) {
    return <LoadingState label="Loading insight…" />;
  }
  if (!data) {
    return (
      <ErrorState
        title="No data cached for this insight"
        message="Open this page online once so it can be reviewed offline afterward."
      />
    );
  }

  const isTrendMoney = MONEY_METRICS.has(metric);
  const isTrendBytes = BYTES_METRICS.has(metric);
  const trendValueFormatter = (value: number) =>
    isTrendMoney ? formatCurrency(value) : isTrendBytes ? formatPlanBytes(value) : formatNumber(value);

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.title}
        description={data.description}
        actions={
          <Button asChild variant="outline">
            <Link href="/platform">
              <ArrowLeft className="h-4 w-4" />
              Dashboard
            </Link>
          </Button>
        }
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing the last cached snapshot for this range while offline.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Card className="border-l-primary min-w-[220px] border-l-[3px]">
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm">Current value</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight">
              {formatMetricValue(metric, data.value)}
            </p>
          </CardContent>
        </Card>
        <div className="flex flex-wrap gap-1">
          {RANGES.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={range === item.id ? "default" : "outline"}
              onClick={() => setRange(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {data.trend.length === 0 ? (
            <EmptyState title="No trend data in this range" />
          ) : (
            <div className="h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trend} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="insightFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                  <YAxis width={48} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => trendValueFormatter(Number(value))} />
                  <Area type="monotone" dataKey="value" stroke="#38bdf8" fill="url(#insightFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{data.rowsLabel}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <InsightRowsTable metric={metric} rows={data.rows} />
        </CardContent>
      </Card>
    </div>
  );
}

function InsightRowsTable({
  metric,
  rows,
}: {
  metric: PlatformInsightMetric;
  rows: Array<Record<string, unknown>>;
}) {
  if (rows.length === 0) {
    return (
      <div className="p-6">
        <EmptyState title="Nothing to show yet" />
      </div>
    );
  }

  if (metric === "mrr" || metric === "arr") {
    return (
      <table className="w-full min-w-[360px] text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Plan</th>
            <th className="px-4 py-3 font-medium">Monthly contribution</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.name)} className="border-border border-t">
              <td className="px-4 py-3 font-medium">{String(row.name)}</td>
              <td className="px-4 py-3">{formatCurrency(Number(row.amount))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (metric === "active-devices") {
    return (
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Organization</th>
            <th className="px-4 py-3 font-medium">Device</th>
            <th className="px-4 py-3 font-medium">Platform</th>
            <th className="px-4 py-3 font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-border border-t">
              <td className="px-4 py-3">{String(row.organizationName)}</td>
              <td className="px-4 py-3">{String(row.name)}</td>
              <td className="px-4 py-3 capitalize">
                {String(row.platform)} · {String(row.runtime)}
              </td>
              <td className="px-4 py-3">{formatDateTime(Number(row.lastSeenAt))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (metric === "cloud-storage") {
    return (
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="bg-muted/50 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Organization</th>
            <th className="px-4 py-3 font-medium">Storage used</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-border border-t">
              <td className="px-4 py-3">
                <Link
                  href={`/platform/${String(row.organizationId)}`}
                  className="font-medium hover:underline"
                >
                  {String(row.name)}
                </Link>
              </td>
              <td className="px-4 py-3">{formatPlanBytes(Number(row.bytes))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <table className="w-full min-w-[560px] text-left text-sm">
      <thead className="bg-muted/50 text-muted-foreground">
        <tr>
          <th className="px-4 py-3 font-medium">Organization</th>
          <th className="px-4 py-3 font-medium">Plan</th>
          <th className="px-4 py-3 font-medium">Created</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr key={i} className="border-border border-t">
            <td className="px-4 py-3">
              <Link
                href={`/platform/${String(row.organizationId)}`}
                className="font-medium hover:underline"
              >
                {String(row.name)}
              </Link>
              <p className="text-muted-foreground text-xs">{String(row.slug)}</p>
            </td>
            <td className="px-4 py-3">{String(row.plan)}</td>
            <td className="px-4 py-3">{formatDateTime(Number(row.createdAt))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
