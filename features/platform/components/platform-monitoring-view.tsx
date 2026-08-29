"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  Building2,
  CloudDownload,
  CreditCard,
  Gauge,
  MonitorSmartphone,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { PlatformKpiCard } from "./platform-kpi-card";
import { usePlatformMonitoringData } from "@/hooks/use-platform-offline-data";
import type { PlatformMonitoringRange } from "@/lib/offline/platform-cache";
import { useConnectivity } from "@/hooks/use-connectivity";
import { formatCurrency, formatNumber } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { formatPlanBytes } from "@/convex/shared/plans";

const RANGES: Array<{ id: PlatformMonitoringRange; label: string }> = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "12m", label: "12 months" },
  { id: "all", label: "All time" },
];

const PIE_COLORS = [
  "var(--primary)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function PlatformMonitoringView() {
  const online = useConnectivity();
  const [range, setRange] = useState<PlatformMonitoringRange>("30d");
  const { data, loading } = usePlatformMonitoringData(range);

  if (loading || data === undefined) {
    return <LoadingState label="Loading platform monitoring…" />;
  }
  if (!data) {
    return (
      <EmptyState
        icon={Gauge}
        title="No monitoring snapshot yet"
        description="Open the platform online once to cache an operational snapshot."
      />
    );
  }

  const runtimeData = Object.entries(data.runtimeCounts).map(([runtime, count]) => ({
    runtime: runtime === "electron" ? "Electron" : runtime.toUpperCase(),
    count,
  }));
  const planTotal = data.planDistribution.reduce((sum, item) => sum + item.count, 0) || 1;
  const alerts = [
    data.operations.stalePendingPayments > 0
      ? `${data.operations.stalePendingPayments} stale pending payment${data.operations.stalePendingPayments === 1 ? "" : "s"}`
      : null,
    data.operations.failedPayments > 0
      ? `${data.operations.failedPayments} failed payment${data.operations.failedPayments === 1 ? "" : "s"}`
      : null,
    data.operations.staleDevices > 0
      ? `${data.operations.staleDevices} active device${data.operations.staleDevices === 1 ? "" : "s"} not seen in 24 hours`
      : null,
    data.operations.syncFailures > 0
      ? `${data.operations.syncFailures} reported sync failure${data.operations.syncFailures === 1 ? "" : "s"}`
      : null,
  ].filter((alert): alert is string => Boolean(alert));

  return (
    <div className="space-y-6" data-tour="platform-overview">
      <PageHeader
        title="Platform monitoring"
        description="Executive SaaS view of growth, usage, revenue, releases, and operational health."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link href="/platform/activity">Activity</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/platform/exports">Export report</Link>
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {!online ? (
          <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
            Showing the last cached monitoring snapshot.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Updated {formatDateTime(data.generatedAt)}
          </p>
        )}
        <div className="flex flex-wrap gap-1" aria-label="Analytics range">
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

      {alerts.length > 0 ? (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="text-warning h-4 w-4" />
              Needs attention
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {alerts.map((alert) => (
              <Badge key={alert} variant="warning">
                {alert}
              </Badge>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Grid cols={4}>
        <PlatformKpiCard
          label="Monthly recurring revenue"
          value={formatCurrency(data.kpis.mrr)}
          hint={`ARR ${formatCurrency(data.kpis.arr)}`}
          icon={Wallet}
        />
        <PlatformKpiCard
          label="Active organizations"
          value={formatNumber(data.kpis.activeOrganizations)}
          hint={`${formatNumber(data.kpis.organizations)} total · ${formatComparison(data.comparisons.organizationGrowth)}`}
          icon={Building2}
        />
        <PlatformKpiCard
          label="Monthly active users"
          value={formatNumber(data.kpis.mau)}
          hint={`DAU ${formatNumber(data.kpis.dau)} · WAU ${formatNumber(data.kpis.wau)}`}
          icon={Users}
        />
        <PlatformKpiCard
          label="Lifetime downloads"
          value={formatNumber(data.kpis.downloads)}
          hint={
            data.trackingStartedAt
              ? `Historical baseline + tracked since ${new Date(data.trackingStartedAt).toLocaleDateString()}`
              : `Tracking begins with baseline import · ${formatComparison(data.comparisons.downloads)}`
          }
          icon={CloudDownload}
        />
      </Grid>

      <Grid cols={4}>
        <PlatformKpiCard
          label="Active devices"
          value={formatNumber(data.kpis.activeDevices)}
          hint={`${formatNumber(data.operations.devicesSeenLast24h)} seen in 24h`}
          icon={MonitorSmartphone}
        />
        <PlatformKpiCard
          label="Gross revenue"
          value={formatCurrency(data.kpis.grossRevenue)}
          hint={`${formatComparison(data.comparisons.revenue)} vs previous period`}
          icon={CreditCard}
        />
        <PlatformKpiCard
          label="Staff accounts"
          value={formatNumber(data.kpis.staffAccounts)}
          hint="Across all organizations"
          icon={Users}
        />
        <PlatformKpiCard
          label="Client errors"
          value={formatNumber(data.operations.clientErrors)}
          hint={`${formatComparison(data.comparisons.clientErrors)} vs previous period`}
          icon={Activity}
          tone={data.operations.clientErrors > 0 ? "warning" : "default"}
        />
      </Grid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Engagement and release activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.series.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="Telemetry is warming up"
                description="Daily active users and tracked events will appear as clients check in."
              />
            ) : (
              <>
                <p className="sr-only">
                  Daily series for active users, installer downloads, and client errors.
                </p>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.series}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={36} />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="activeUsers"
                        name="Active users"
                        stroke="var(--primary)"
                        fill="var(--primary)"
                        fillOpacity={0.18}
                      />
                      <Area
                        type="monotone"
                        dataKey="downloads"
                        name="Downloads"
                        stroke="var(--chart-2)"
                        fill="var(--chart-2)"
                        fillOpacity={0.12}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Client runtime mix</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={runtimeData}
                    dataKey="count"
                    nameKey="runtime"
                    innerRadius={48}
                    outerRadius={82}
                    paddingAngle={2}
                  >
                    {runtimeData.map((entry, index) => (
                      <Cell key={entry.runtime} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatNumber(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {runtimeData.map((item) => (
                <div key={item.runtime} className="bg-muted/40 rounded-lg p-2">
                  <dt className="text-muted-foreground text-xs">{item.runtime}</dt>
                  <dd className="mt-1 font-semibold">{formatNumber(item.count)}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Feature adoption</CardTitle>
          </CardHeader>
          <CardContent>
            {data.featureAdoption.length === 0 ? (
              <p className="text-muted-foreground text-sm">No feature events in this range yet.</p>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.featureAdoption.slice(0, 10)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis
                      type="category"
                      dataKey="feature"
                      width={76}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip formatter={(value) => formatNumber(Number(value))} />
                    <Bar dataKey="count" name="Usage events" fill="var(--primary)" radius={[0, 5, 5, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organizations by plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.planDistribution.map((plan, index) => (
              <div key={plan.planKey}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium">{plan.name}</span>
                  <span className="text-muted-foreground">
                    {formatNumber(plan.count)} · {Math.round((plan.count / planTotal) * 100)}%
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(plan.count / planTotal) * 100}%`,
                      backgroundColor: PIE_COLORS[index % PIE_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Growth and activation funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {data.activationFunnel.map((stage, index) => {
              const first = data.activationFunnel[0]?.count || 1;
              return (
                <div key={stage.stage} className="bg-muted/40 rounded-xl p-4">
                  <p className="text-muted-foreground text-xs">
                    {index + 1}. {stage.stage}
                  </p>
                  <p className="mt-2 text-2xl font-semibold">{formatNumber(stage.count)}</p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {Math.round((stage.count / first) * 100)}% of created
                  </p>
                </div>
              );
            })}
          </div>
          <div className="border-border mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
            <Metric
              label="Activation rate"
              value={`${Math.round(data.kpis.activationRate * 100)}%`}
            />
            <Metric
              label="Subscription churn"
              value={`${Math.round(data.kpis.churnRate * 100)}%`}
              warning={data.kpis.churnRate > 0.05}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Release adoption</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/platform/releases">Release details</Link>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {data.releaseAdoption.length === 0 ? (
              <p className="text-muted-foreground p-6 text-sm">
                Seed GitHub baselines or publish a tracked release to see adoption.
              </p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3 font-medium">Version</th>
                    <th className="px-5 py-3 font-medium">Downloads</th>
                    <th className="px-5 py-3 font-medium">Active devices</th>
                  </tr>
                </thead>
                <tbody>
                  {data.releaseAdoption.slice(0, 10).map((release) => (
                    <tr key={release.version} className="border-border border-t">
                      <td className="px-5 py-3 font-medium">{release.version}</td>
                      <td className="px-5 py-3">{formatNumber(release.downloads)}</td>
                      <td className="px-5 py-3">{formatNumber(release.activeDevices)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Downloads by asset</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.downloadAssets.slice(0, 6).map((asset) => (
                <div
                  key={asset.assetGroup}
                  className="bg-muted/40 flex items-center justify-between rounded-lg px-3 py-2 text-sm"
                >
                  <span className="capitalize">{asset.assetGroup.replace(/-/g, " ")}</span>
                  <span className="font-semibold">{formatNumber(asset.count)}</span>
                </div>
              ))}
              {data.downloadAssets.length === 0 ? (
                <p className="text-muted-foreground text-sm">No installer downloads yet.</p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Operations</CardTitle>
              <Button asChild size="sm" variant="ghost">
                <Link href="/platform/costs">Record costs</Link>
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Metric label="Cloud storage" value={formatPlanBytes(data.operations.storageBytes)} />
              <Metric label="Backups" value={formatNumber(data.operations.backupCount)} />
              <Metric label="Imports" value={formatNumber(data.operations.imports)} />
              <Metric label="Exports" value={formatNumber(data.operations.exports)} />
              <Metric
                label="Failed imports"
                value={formatNumber(data.operations.failedImports)}
                warning={data.operations.failedImports > 0}
              />
              <Metric
                label="Sync failures"
                value={formatNumber(data.operations.syncFailures)}
                warning={data.operations.syncFailures > 0}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent organizations</CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/platform/organizations">View all</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[580px] text-left text-sm">
            <thead className="bg-muted/40 text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Organization</th>
                <th className="px-5 py-3 font-medium">Plan</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {data.recentOrganizations.map((organization) => (
                <ClickableTableRow key={organization.id} href={`/platform/${organization.id}`}>
                  <td className="px-5 py-3">
                    <p className="font-medium">{organization.name}</p>
                    <p className="text-muted-foreground text-xs">{organization.slug}</p>
                  </td>
                  <td className="px-5 py-3 capitalize">{organization.planKey}</td>
                  <td className="px-5 py-3">
                    <Badge variant={organization.status === "active" ? "success" : "secondary"}>
                      {organization.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">{formatDateTime(organization.createdAt)}</td>
                </ClickableTableRow>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({
  label,
  value,
  warning,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className="bg-muted/40 rounded-xl p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={warning ? "text-warning mt-1 font-semibold" : "mt-1 font-semibold"}>{value}</p>
    </div>
  );
}

function formatComparison(value: number | null) {
  if (value === null) return "No prior baseline";
  const percent = Math.round(Math.abs(value) * 100);
  if (value === 0) return "No change";
  return `${value > 0 ? "↑" : "↓"} ${percent}%`;
}
