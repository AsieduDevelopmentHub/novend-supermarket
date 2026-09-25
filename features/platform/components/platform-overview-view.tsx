"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  Clock,
  CreditCard,
  Crown,
  FileDown,
  FileUp,
  GitBranch,
  HardDrive,
  MonitorSmartphone,
  Package,
  ShoppingBag,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatNumber } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { formatPlanBytes } from "@/convex/shared/plans";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformOverviewData } from "@/hooks/use-platform-offline-data";

/**
 * Platform home only mounts `platform.overview`. Revenue and system-health
 * queries stay on their own routes so opening `/platform` does not fan out
 * three heavy Super Admin collects at once.
 */
export function PlatformOverviewView() {
  const online = useConnectivity();
  const { data: overview, loading } = usePlatformOverviewData();

  if (loading || !overview) {
    return <LoadingState label="Loading platform overview…" />;
  }

  const devices = overview.devices;
  const storage = overview.storage;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="SaaS control center for Novend — tenants, usage, releases, and links to revenue and health."
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing cached Super Admin data while offline.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline">
          <Link href="/platform/revenue">
            <TrendingUp className="h-4 w-4" />
            Revenue
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/platform/subscriptions">
            <CreditCard className="h-4 w-4" />
            Subscriptions
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/platform/organizations">
            <Building2 className="h-4 w-4" />
            Organizations
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/platform/releases">
            <Package className="h-4 w-4" />
            Downloads
          </Link>
        </Button>
        <Button asChild size="sm" variant="outline">
          <Link href="/platform/health">
            <MonitorSmartphone className="h-4 w-4" />
            System health
          </Link>
        </Button>
      </div>

      <Grid cols={4}>
        <Kpi
          title="Active organizations"
          value={String(overview.activeOrganizations)}
          hint={
            overview.testOrganizationCount
              ? `${overview.commercialOrganizationCount ?? overview.organizationCount} commercial · ${overview.testOrganizationCount} test`
              : `${overview.organizationCount} total`
          }
          icon={Building2}
          href="/platform/insights/active-organizations"
        />
        <Kpi
          title="Trial organizations"
          value={String(overview.trialOrganizations)}
          icon={Clock}
          href="/platform/insights/trial-organizations"
        />
        <Kpi
          title="Expired subscriptions"
          value={String(overview.expiredOrganizations)}
          icon={XCircle}
          href="/platform/insights/expired-subscriptions"
        />
        <Kpi
          title="Lifetime licenses"
          value={String(overview.lifetimeOrganizations ?? 0)}
          icon={Crown}
          href="/platform/insights/lifetime-licenses"
        />
      </Grid>

      <Grid cols={4}>
        <Kpi
          title="Active devices"
          value={devices ? String(devices.active) : "—"}
          hint={devices ? `${devices.seenLast24h} seen in 24h` : undefined}
          icon={MonitorSmartphone}
          href="/platform/insights/active-devices"
        />
        <Kpi
          title="Cloud storage used"
          value={storage ? formatPlanBytes(storage.totalBytes) : "—"}
          hint={storage ? `${storage.backupCount} backups` : undefined}
          icon={HardDrive}
          href="/platform/insights/cloud-storage"
        />
        <Kpi title="Staff accounts" value={formatNumber(overview.userCount)} icon={Users} />
        <Kpi title="Branches" value={formatNumber(overview.branchCount)} icon={GitBranch} />
      </Grid>

      <Grid cols={4}>
        <Kpi
          title="Completed sales"
          value={formatNumber(overview.saleCount)}
          hint={`${overview.salesLast24h} in the last 24 hours`}
          icon={ShoppingBag}
        />
        <Kpi
          title="Product imports"
          value={formatNumber(overview.importJobCount ?? 0)}
          hint="Completed jobs (counts only)"
          icon={FileUp}
        />
        <Kpi
          title="Failed imports"
          value={formatNumber(overview.failedImportJobs ?? 0)}
          icon={XCircle}
        />
        <Kpi
          title="Exports recorded"
          value={formatNumber(overview.exportEventCount ?? 0)}
          hint={
            overview.exportsByFormat
              ? `CSV ${overview.exportsByFormat.csv} · XLSX ${overview.exportsByFormat.xlsx} · PDF ${overview.exportsByFormat.pdf} · JSON ${overview.exportsByFormat.json}`
              : "Format usage, not a billed quota"
          }
          icon={FileDown}
        />
      </Grid>

      <Grid cols={4}>
        <Kpi
          title="CSV-only organizations"
          value={formatNumber(overview.csvOnlyOrganizations ?? 0)}
          hint="Below Pro — no Excel or PDF"
          icon={FileDown}
        />
        <Kpi
          title="MRR / ARR"
          value="Open"
          hint="Live revenue analytics"
          icon={TrendingUp}
          href="/platform/revenue"
        />
        <Kpi
          title="Net profit"
          value="Open"
          hint="Costs and gross on Revenue"
          icon={CreditCard}
          href="/platform/revenue"
        />
        <Kpi
          title="System health"
          value="Open"
          hint="Devices, billing ops, releases"
          icon={MonitorSmartphone}
          href="/platform/health"
        />
      </Grid>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent organizations</CardTitle>
            <Button asChild size="sm" variant="ghost">
              <Link href="/platform/organizations">All</Link>
            </Button>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {overview.recentOrganizations.length === 0 ? (
              <p className="text-muted-foreground p-6 text-sm">No organizations yet.</p>
            ) : (
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr className="border-border border-b">
                    <th className="px-6 pb-2 font-medium">Business</th>
                    <th className="px-4 pb-2 font-medium">Status</th>
                    <th className="px-4 pb-2 font-medium">Plan</th>
                    <th className="px-4 pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentOrganizations.map((org) => (
                    <ClickableTableRow key={org.id} href={`/platform/${org.id}`}>
                      <td className="px-6 py-3">
                        <p className="font-medium">{org.name}</p>
                        <p className="text-muted-foreground text-xs">{org.slug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant={org.status === "active" ? "success" : "secondary"}>
                            {org.status}
                          </Badge>
                          {org.isTestOrganization ? (
                            <Badge variant="outline">Test</Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize">{org.plan}</td>
                      <td className="px-4 py-3">{formatDateTime(org.createdAt)}</td>
                    </ClickableTableRow>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Downloads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Published desktop and mobile installers are cached on this device for offline review.
              Fresh downloads still need a connection.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/platform/releases">View downloads</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Organizations near product / import cap
          </CardTitle>
          <Button asChild size="sm" variant="ghost">
            <Link href="/platform/organizations">All</Link>
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {(overview.orgsNearImportCap ?? []).length === 0 ? (
            <p className="text-muted-foreground p-6 text-sm">
              No organization is at 80% or more of its product limit. Import row caps follow that
              product limit (including Super Admin overrides).
            </p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-border border-b">
                  <th className="px-6 pb-2 font-medium">Business</th>
                  <th className="px-4 pb-2 font-medium">Products</th>
                  <th className="px-4 pb-2 font-medium">Import cap</th>
                  <th className="px-4 pb-2 font-medium">Used</th>
                </tr>
              </thead>
              <tbody>
                {(overview.orgsNearImportCap ?? []).map((org) => (
                  <ClickableTableRow key={org.id} href={`/platform/${org.id}?tab=licence`}>
                    <td className="px-6 py-3 font-medium">{org.name}</td>
                    <td className="px-4 py-3">
                      {formatNumber(org.productsUsed)} / {formatNumber(org.productLimit)}
                      {org.productLimitOverridden ? (
                        <span className="text-muted-foreground ml-1 text-xs">override</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{formatNumber(org.maxImportRows)} rows / file</td>
                    <td className="px-4 py-3">{org.percent}%</td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  title,
  value,
  hint,
  icon: Icon,
  href,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  href?: string;
}) {
  const content = (
    <Card
      className={
        href
          ? "hover:border-primary/40 focus-within:ring-ring transition-colors focus-within:ring-2"
          : undefined
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground h-4 w-4" />
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  );

  if (!href) return content;
  return (
    <Link href={href} className="block rounded-xl outline-none">
      {content}
    </Link>
  );
}
