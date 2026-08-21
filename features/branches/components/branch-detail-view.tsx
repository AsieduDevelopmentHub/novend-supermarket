"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { getMirroredBranch, listMirroredUsers } from "@/lib/offline/mirror-queries";
import { buildLocalAnalyticsSummary } from "@/lib/offline/analytics-engine";
import { formatCurrency } from "@/lib/currency";
import { ArrowLeft } from "lucide-react";

export function BranchDetailView({ branchId }: { branchId: string }) {
  const { canManageBranches } = usePermissions();
  const online = useConnectivity();
  const overviewRemote = useQuery(
    api.branches.getOverview,
    online && canManageBranches ? { id: branchId as Id<"branches"> } : "skip",
  );
  const [localOverview, setLocalOverview] = useState<{
    name: string;
    code: string;
    address: string | null;
    phone: string | null;
    email: string | null;
    status: string;
    kpis: { inventoryValue: number; revenue: number; profit: number; expenses: number; refunds: number };
    manager: { id: string; name: string } | null;
    staff: Array<{ id: string; name: string; role: string }>;
    recentSales: Array<{ id: string; invoiceNumber: string; total: number; completedAt: number; customerName: string }>;
  } | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const branch = await getMirroredBranch(branchId);
      if (!branch) {
        if (!cancelled) setLocalOverview(null);
        return;
      }
      const now = Date.now();
      const summary = await buildLocalAnalyticsSummary({
        startDate: now - 30 * 24 * 60 * 60 * 1000,
        endDate: now,
        granularity: "day",
        branchId,
      });
      const staff = (await listMirroredUsers()).filter((user) => user.branchId === branchId);
      if (cancelled) return;
      setLocalOverview({
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
        email: null,
        status: branch.status,
        kpis: {
          inventoryValue: 0,
          revenue: summary.kpis.revenue,
          profit: summary.kpis.netProfit,
          expenses: summary.kpis.operatingExpenses,
          refunds: summary.kpis.totalRefunds,
        },
        manager: staff.find((user) => user.role === "manager") ?? null,
        staff: staff.map((user) => ({ id: user.id, name: user.name, role: user.role })),
        recentSales: [],
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [branchId]);

  if (!canManageBranches) {
    return <ErrorState message="Branch overview is administrator-only." />;
  }

  const overview = overviewRemote ?? localOverview;
  if (overview === undefined) {
    return <LoadingState label="Loading branch…" />;
  }
  if (!overview) {
    return <ErrorState message="Branch not found." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={overview.name}
        description={`${overview.code} · last 30 days`}
        actions={
          <Button asChild variant="outline">
            <Link href="/branches">
              <ArrowLeft className="h-4 w-4" />
              Branches
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Address" value={overview.address ?? "—"} />
        <Info label="Phone" value={overview.phone ?? "—"} />
        <Info label="Email" value={overview.email ?? "—"} />
        <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
          <p className="text-muted-foreground text-sm">Status</p>
          <div className="mt-2">
            <Badge variant={overview.status === "active" ? "success" : "secondary"}>
              {overview.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      <Grid cols={5}>
        <Kpi title="Inventory value" value={formatCurrency(overview.kpis.inventoryValue)} />
        <Kpi title="Revenue" value={formatCurrency(overview.kpis.revenue)} />
        <Kpi title="Profit" value={formatCurrency(overview.kpis.profit)} />
        <Kpi title="Expenses" value={formatCurrency(overview.kpis.expenses)} />
        <Kpi title="Refunds" value={formatCurrency(overview.kpis.refunds)} />
      </Grid>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Staff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Manager: </span>
              {overview.manager ? (
                <Link href={`/users/${overview.manager.id}`} className="hover:underline">
                  {overview.manager.name}
                </Link>
              ) : (
                "Not assigned"
              )}
            </p>
            {overview.staff.length === 0 ? (
              <EmptyState title="No staff assigned" />
            ) : (
              <ul className="space-y-2">
                {overview.staff.map((member) => (
                  <li key={member.id} className="flex items-center justify-between">
                    <Link href={`/users/${member.id}`} className="hover:underline">
                      {member.name}
                    </Link>
                    <span className="text-muted-foreground capitalize">{member.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent sales</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {overview.recentSales.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No sales in the last 30 days" />
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 font-medium">Invoice</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentSales.map((sale) => (
                    <ClickableTableRow key={sale.id} href={`/orders/${sale.id}`}>
                      <td className="px-4 py-2 font-medium">{sale.invoiceNumber}</td>
                      <td className="px-4 py-2">{sale.customerName}</td>
                      <td className="px-4 py-2">{formatCurrency(sale.total)}</td>
                    </ClickableTableRow>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardContent className="min-w-0 p-5">
        <p className="text-muted-foreground text-sm">{title}</p>
        <p className="mt-2 truncate text-2xl font-semibold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}
