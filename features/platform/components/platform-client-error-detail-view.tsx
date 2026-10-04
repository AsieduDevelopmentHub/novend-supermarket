"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { ArrowLeft } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatNumber } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { useConnectivity } from "@/hooks/use-connectivity";
import type { PlatformRevenueRange } from "@/lib/offline/platform-cache";

const RANGES: { id: PlatformRevenueRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "12m", label: "12 months" },
];

const KIND_LABEL: Record<string, string> = {
  runtime: "Runtime",
  feature: "Feature",
  action: "Action",
  code: "Error code",
};

function DimensionBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ name: string; count: number }>;
}) {
  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No breakdown yet.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[240px] text-left text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Count</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.name} className="border-border border-t">
                <td className="px-4 py-2 font-medium">{row.name}</td>
                <td className="px-4 py-2">{formatNumber(row.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

/**
 * Super Admin drill-down for one client-error rollup dimension.
 * Events stay privacy-limited (no stacks or messages).
 */
export function PlatformClientErrorDetailView({ code }: { code: string }) {
  const online = useConnectivity();
  const [range, setRange] = useState<PlatformRevenueRange>("30d");
  const decoded = decodeURIComponent(code);
  const data = useAuthedQuery(
    api.platformAnalytics.getClientErrorCodeDetail,
    online ? { code: decoded, range } : "skip",
  );

  if (!online) {
    return (
      <ErrorState
        title="Online only"
        message="Client error event detail needs a live connection. Rollups on the summary page remain available offline when cached."
      />
    );
  }

  if (data === undefined) {
    return <LoadingState label="Loading error detail…" />;
  }

  if (data === null) {
    return (
      <ErrorState
        title="Unknown error code"
        message="Expected a dimension like runtime:android, feature:settings, or code:window_error.TypeError."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.code}
        description={`${KIND_LABEL[data.kind] ?? "Dimension"} rollup — sanitized events only (no stack traces). Use feature, runtime, and app version to narrow where to reproduce.`}
        actions={
          <Button asChild variant="outline">
            <Link href="/platform/insights/client-errors">
              <ArrowLeft className="h-4 w-4" />
              All client errors
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Grid cols={3} className="min-w-0 flex-1">
          <Card className="border-l-primary border-l-[3px]">
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Events (counted)</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(data.total)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Rows returned</p>
              <p className="mt-1 text-2xl font-semibold">{formatNumber(data.eventCount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-sm">Filter</p>
              <p className="mt-1 text-lg font-semibold capitalize">
                {KIND_LABEL[data.kind] ?? data.kind}: {data.value}
              </p>
            </CardContent>
          </Card>
        </Grid>
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

      <div className="grid gap-4 lg:grid-cols-2">
        <DimensionBreakdown title="By error fingerprint" rows={data.byErrorCode} />
        <DimensionBreakdown title="By runtime" rows={data.byRuntime} />
        <DimensionBreakdown title="By feature" rows={data.byFeature} />
        <DimensionBreakdown title="By app version" rows={data.byAppVersion} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {data.events.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No matching events in this range" />
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">Fingerprint</th>
                  <th className="px-4 py-3 font-medium">Feature</th>
                  <th className="px-4 py-3 font-medium">Runtime</th>
                  <th className="px-4 py-3 font-medium">Version</th>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Count</th>
                </tr>
              </thead>
              <tbody>
                {data.events.map((row) => (
                  <tr key={row.id} className="border-border border-t">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {formatDateTime(row.occurredAt)}
                    </td>
                    <td className="px-4 py-3 font-medium">{row.errorCode ?? "—"}</td>
                    <td className="px-4 py-3">{row.feature ?? "—"}</td>
                    <td className="px-4 py-3 capitalize">{row.runtime ?? "—"}</td>
                    <td className="px-4 py-3">{row.appVersion ?? "—"}</td>
                    <td className="px-4 py-3">
                      {row.organizationId ? (
                        <Link
                          href={`/platform/${row.organizationId}`}
                          className="font-medium hover:underline"
                        >
                          {row.organizationName ?? "Organization"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">{formatNumber(row.count)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
