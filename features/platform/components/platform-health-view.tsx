"use client";

import { Activity, Cloud, MonitorSmartphone, Package, Server } from "lucide-react";
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
        <Card>
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm">Organizations</p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(health.organizationCount)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatNumber(health.profileCount)} staff profiles
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm">Active devices</p>
            <p className="mt-2 text-2xl font-semibold">{formatNumber(health.devices.active)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatNumber(health.devices.seenLast24h)} seen in 24h
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-muted-foreground text-sm">Cloud storage</p>
            <p className="mt-2 text-2xl font-semibold">
              {formatPlanBytes(health.storage.totalBytes)}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatNumber(health.storage.backupCount)} backups
            </p>
          </CardContent>
        </Card>
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
