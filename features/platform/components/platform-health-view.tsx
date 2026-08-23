"use client";

import Link from "next/link";
import { Activity, Cloud, MonitorSmartphone, Package, RefreshCw, Server } from "lucide-react";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatNumber } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { formatPlanBytes } from "@/convex/shared/plans";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformHealthData } from "@/hooks/use-platform-offline-data";
import { cn } from "@/lib/utils";

export function PlatformHealthView() {
  const online = useConnectivity();
  const { data: health, loading } = usePlatformHealthData();

  if (loading || health === undefined) {
    return <LoadingState label="Loading system health…" />;
  }
  if (!health) {
    return (
      <EmptyState
        icon={Activity}
        title="No health snapshot yet"
        description="Open this page online once to cache a system health snapshot for offline review."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System health"
        description="Platform connectivity snapshot, devices, storage, and latest published builds."
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing the last cached health snapshot while offline.
        </p>
      ) : null}

      <Grid cols={4}>
        <Card className="border-l-primary border-l-[3px]">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-muted-foreground text-sm">Convex</p>
              <p className="mt-2 text-2xl font-semibold capitalize">{health.convexStatus}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Checked {formatDateTime(health.checkedAt)}
              </p>
            </div>
            <div className="bg-accent text-accent-foreground flex h-10 w-10 items-center justify-center rounded-full">
              <Server className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
        <HealthKpiCard
          href="/platform/organizations"
          label="Organizations"
          value={formatNumber(health.organizationCount)}
          hint={`${formatNumber(health.profileCount)} staff profiles`}
        />
        <HealthKpiCard
          href="/platform/insights/active-devices"
          label="Active devices"
          value={formatNumber(health.devices.active)}
          hint={`${formatNumber(health.devices.seenLast24h)} seen in 24h`}
        />
        <HealthKpiCard
          href="/platform/insights/cloud-storage"
          label="Cloud storage"
          value={formatPlanBytes(health.storage.totalBytes)}
          hint={`${formatNumber(health.storage.backupCount)} backups`}
        />
      </Grid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge variant="success">Active {health.subscriptionCounts.active}</Badge>
            <Badge variant="secondary">Trialing {health.subscriptionCounts.trialing}</Badge>
            <Badge variant="warning">Past due {health.subscriptionCounts.pastDue}</Badge>
            <Badge variant="outline">Cancelled {health.subscriptionCounts.cancelled}</Badge>
            <Badge variant="outline">Expired {health.subscriptionCounts.expired}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4" />
              Connected runtimes
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Metric label="Desktop" value={String(health.devices.desktop)} />
            <Metric label="Web / PWA" value={String(health.devices.web)} />
            <Metric label="Registered" value={String(health.devices.total)} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync freshness
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <Metric
              label="Backups (24h)"
              value={String(health.sync.backupsLast24h)}
            />
            <Metric
              label="Devices synced (24h)"
              value={String(health.sync.devicesSeenLast24h)}
            />
            <Metric
              label="Stale devices"
              value={String(health.sync.devicesStale)}
              tone={health.sync.devicesStale > 0 ? "warning" : undefined}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Latest desktop release
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {health.latestDesktopVersion ? (
              <p>
                <span className="font-semibold">{health.latestDesktopTag}</span>
                <span className="text-muted-foreground"> · {health.latestDesktopVersion}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">No desktop release published yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-4 w-4" />
              Latest mobile release
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {health.latestMobileVersion ? (
              <p>
                <span className="font-semibold">{health.latestMobileTag}</span>
                <span className="text-muted-foreground"> · {health.latestMobileVersion}</span>
              </p>
            ) : (
              <p className="text-muted-foreground">No mobile release published yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warning";
}) {
  return (
    <div className="bg-muted/40 rounded-xl p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold", tone === "warning" && "text-warning")}>
        {value}
      </p>
    </div>
  );
}

function HealthKpiCard({
  href,
  label,
  value,
  hint,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Link href={href} className="block">
      <Card className="hover:border-primary/40 transition-colors">
        <CardContent className="p-5">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
          <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
