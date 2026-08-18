"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { BranchFilter } from "@/components/filters/branch-filter";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useOrdersList } from "@/hooks/use-offline-lists";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { Eye, ShoppingBag } from "lucide-react";

export function OrdersView() {
  const { isAdmin, branchId: myBranchId, branchName } = usePermissions();
  const online = useConnectivity();
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<Id<"branches"> | "all">("all");
  const branches = useQuery(api.branches.list, isAdmin && online ? {} : "skip");
  const { orders } = useOrdersList({
    search,
    branchId: isAdmin && branchFilter !== "all" ? branchFilter : undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="All completed sales — search by invoice or customer to reprint or assist."
        actions={
          <Button asChild>
            <Link href="/sales">New Sale</Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoice or customer…"
          className="max-w-md"
        />
        {isAdmin ? (
          <BranchFilter
            branches={branches}
            value={branchFilter}
            onChange={setBranchFilter}
            allowAll
            className="w-full sm:w-auto"
          />
        ) : branchName ? (
          <BranchFilter
            branches={undefined}
            value={myBranchId}
            onChange={() => undefined}
            lockedLabel={branchName}
            className="w-full sm:w-auto"
          />
        ) : null}
      </div>

      {orders === undefined ? (
        <LoadingState label="Loading orders…" variant="table" />
      ) : orders.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders yet" />
      ) : (
        <>
          <div className="hidden md:block">
            <Card>
              <CardContent className="overflow-x-auto p-0">
                <table className="w-full min-w-[960px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Invoice</th>
                      <th className="px-4 py-3 font-medium">Date</th>
                      <th className="px-4 py-3 font-medium">Branch</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Cashier</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Payment</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <ClickableTableRow key={order.id} href={`/orders/${order.id}`}>
                        <td className="px-4 py-3 font-medium">{order.invoiceNumber}</td>
                        <td className="px-4 py-3">{formatDateTime(order.completedAt)}</td>
                        <td className="px-4 py-3">{order.branchName ?? "—"}</td>
                        <td className="px-4 py-3">
                          {order.customerId ? (
                            <Link
                              href={`/customers/${order.customerId}`}
                              className="hover:underline"
                            >
                              {order.customerName}
                            </Link>
                          ) : (
                            order.customerName
                          )}
                        </td>
                        <td className="px-4 py-3">{order.cashierName}</td>
                        <td className="px-4 py-3">{order.itemCount}</td>
                        <td className="px-4 py-3 capitalize">
                          {order.paymentMethod.replace("_", " ")}
                        </td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(order.total)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="success">Completed</Badge>
                            {"refundedAmount" in order && Number(order.refundedAmount) > 0 ? (
                              <Badge variant="warning">Returned</Badge>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            asChild
                            size="icon"
                            variant="ghost"
                            aria-label="View order details"
                          >
                            <Link href={`/orders/${order.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </td>
                      </ClickableTableRow>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3 md:hidden">
            {orders.map((order) => (
              <Card key={order.id}>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">{order.invoiceNumber}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(order.completedAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      <Badge variant="success">Completed</Badge>
                      {"refundedAmount" in order && Number(order.refundedAmount) > 0 ? (
                        <Badge variant="warning">Returned</Badge>
                      ) : null}
                    </div>
                  </div>
                  <p className="text-sm">{order.customerName}</p>
                  <p className="text-muted-foreground text-xs">
                    {order.branchName ? `${order.branchName} · ` : ""}
                    Cashier: {order.cashierName}
                  </p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground capitalize">
                      {order.paymentMethod.replace("_", " ")} · {order.itemCount} items
                    </span>
                    <span className="font-semibold">{formatCurrency(order.total)}</span>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link href={`/orders/${order.id}`}>
                      <Eye className="h-4 w-4" />
                      View details
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
