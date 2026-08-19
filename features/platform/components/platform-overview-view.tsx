"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { Building2, GitBranch, Package, ShoppingBag, Users } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatDateTime } from "@/lib/date";

export function PlatformOverviewView() {
  const overview = useQuery(api.platform.overview, {});

  if (overview === undefined) {
    return <LoadingState label="Loading platform overview…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Tenants, usage, and desktop builds for Novend."
        actions={
          <Button asChild>
            <Link href="/platform/organizations">Manage organizations</Link>
          </Button>
        }
      />

      <Grid cols={4}>
        <Kpi
          title="Organizations"
          value={String(overview.organizationCount)}
          hint={`${overview.activeOrganizations} active · ${overview.suspendedOrganizations} suspended`}
          icon={Building2}
        />
        <Kpi title="Staff accounts" value={String(overview.userCount)} icon={Users} />
        <Kpi title="Branches" value={String(overview.branchCount)} icon={GitBranch} />
        <Kpi
          title="Completed sales"
          value={String(overview.saleCount)}
          hint={`${overview.salesLast24h} in the last 24 hours`}
          icon={ShoppingBag}
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
                        <Badge variant={org.status === "active" ? "success" : "secondary"}>
                          {org.status}
                        </Badge>
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
              Desktop channel
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              Windows, macOS, and Linux installers are published from git tags matching{" "}
              <code className="bg-muted rounded px-1">package.json</code> (currently{" "}
              <code className="bg-muted rounded px-1">v0.1.0</code>).
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/platform/releases">View desktop releases</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-l-primary min-w-0 border-l-[3px]">
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-muted-foreground truncate text-sm">{title}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
          {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
        </div>
        <div className="bg-accent text-accent-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}
