"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { CreditCard, Eye } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { formatPlanBytes } from "@/convex/shared/plans";

export function PlatformSubscriptionsView() {
  const rows = useQuery(api.platformAnalytics.listSubscriptions, {});

  if (rows === undefined) {
    return <LoadingState label="Loading subscriptions…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Every organization licence, renewal date, seats, devices, and storage footprint."
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={CreditCard} title="No organizations yet" />
            </div>
          ) : (
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Plan</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Renewal</th>
                  <th className="px-4 py-3 font-medium">Users</th>
                  <th className="px-4 py-3 font-medium">Devices</th>
                  <th className="px-4 py-3 font-medium">Storage</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <ClickableTableRow key={row.id} href={`/platform/${row.id}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{row.name}</p>
                      <p className="text-muted-foreground text-xs">{row.slug}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span>{row.plan}</span>
                        {row.billingCycle ? (
                          <span className="text-muted-foreground text-xs capitalize">
                            {row.billingCycle}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={row.status === "active" ? "success" : "secondary"}>
                          {row.status}
                        </Badge>
                        {row.subscriptionStatus ? (
                          <Badge variant="outline">{row.subscriptionStatus}</Badge>
                        ) : null}
                        {row.isLifetime ? <Badge variant="outline">Lifetime</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.renewalDate ? formatDateTime(row.renewalDate) : "—"}
                    </td>
                    <td className="px-4 py-3">{row.users}</td>
                    <td className="px-4 py-3">{row.devices}</td>
                    <td className="px-4 py-3">{formatPlanBytes(row.storageBytes)}</td>
                    <td className="px-4 py-3">
                      {row.amount > 0 ? formatCurrency(row.amount) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/platform/${row.id}`}>
                          <Eye className="h-4 w-4" />
                          Open
                        </Link>
                      </Button>
                    </td>
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
