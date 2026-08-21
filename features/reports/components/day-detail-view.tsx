"use client";

import { useQuery } from "convex/react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ClickableTableRow } from "@/components/ui/clickable-table-row";
import { LoadingState } from "@/components/feedback/loading-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatCurrency } from "@/lib/currency";
import { formatDate, formatDateTime } from "@/lib/date";
import { ArrowLeft } from "lucide-react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { listLocalOrders } from "@/lib/offline/mirror-queries";
import { useEffect, useState } from "react";

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function ReportDayDetailView() {
  const online = useConnectivity();
  const params = useSearchParams();
  const date = params.get("date") ?? "";
  const branch = params.get("branch");
  const rangeStart = params.get("start");
  const rangeEnd = params.get("end");

  const details = useQuery(
    api.reports.dayDetails,
    online && isIsoDate(date)
      ? {
          date,
          branchId: branch ? (branch as Id<"branches">) : undefined,
        }
      : "skip",
  );

  const backHref = (() => {
    const q = new URLSearchParams();
    if (rangeStart) q.set("start", rangeStart);
    if (rangeEnd) q.set("end", rangeEnd);
    if (branch) q.set("branch", branch);
    const suffix = q.toString();
    return suffix ? `/reports?${suffix}` : "/reports";
  })();

  if (!isIsoDate(date)) {
    return <ErrorState message="Choose a day from the Reports daily breakdown." />;
  }

  if (!online) {
    return <LocalDayFallback date={date} backHref={backHref} />;
  }

  const titleDate = formatDate(new Date(`${date}T00:00:00Z`));

  return (
    <div className="space-y-6">
      <PageHeader
        title={titleDate}
        description="Orders and refunds that make up this day's report row."
        actions={
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Reports
            </Link>
          </Button>
        }
      />

      {details === undefined ? (
        <LoadingState label="Loading day…" variant="cards" />
      ) : (
        <>
          <Grid cols={5}>
            <Kpi title="Orders" value={String(details.kpis.orders)} />
            <Kpi title="Items sold" value={String(details.kpis.itemsSold)} />
            <Kpi title="Gross sales" value={formatCurrency(details.kpis.grossSales)} />
            <Kpi title="Refunds" value={formatCurrency(details.kpis.refunds)} />
            <Kpi title="Net sales" value={formatCurrency(details.kpis.netSales)} />
          </Grid>

          <Card>
            <CardHeader>
              <CardTitle>Orders</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {details.orders.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No orders this day" />
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Invoice</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Cashier</th>
                      <th className="px-4 py-3 font-medium">Branch</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.orders.map((order) => (
                      <ClickableTableRow key={order.id} href={`/orders/${order.id}`}>
                        <td className="px-4 py-3 font-medium">{order.invoiceNumber}</td>
                        <td className="px-4 py-3">{formatDateTime(order.completedAt)}</td>
                        <td className="px-4 py-3">{order.customerName}</td>
                        <td className="px-4 py-3">{order.cashierName}</td>
                        <td className="px-4 py-3">{order.branchName ?? "—"}</td>
                        <td className="px-4 py-3">{order.itemCount}</td>
                        <td className="px-4 py-3 font-medium">{formatCurrency(order.total)}</td>
                      </ClickableTableRow>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Returns</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              {details.returns.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No returns this day" />
                </div>
              ) : (
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3 font-medium">Return</th>
                      <th className="px-4 py-3 font-medium">Time</th>
                      <th className="px-4 py-3 font-medium">Order</th>
                      <th className="px-4 py-3 font-medium">Customer</th>
                      <th className="px-4 py-3 font-medium">Reason</th>
                      <th className="px-4 py-3 font-medium">Items</th>
                      <th className="px-4 py-3 font-medium">Refund</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.returns.map((row) => (
                      <ClickableTableRow key={row.id} href={`/returns/${row.id}`}>
                        <td className="px-4 py-3 font-medium">{row.returnNumber}</td>
                        <td className="px-4 py-3">{formatDateTime(row.completedAt)}</td>
                        <td className="px-4 py-3">{row.invoiceNumber}</td>
                        <td className="px-4 py-3">{row.customerName}</td>
                        <td className="px-4 py-3 max-w-[180px] truncate">{row.reason}</td>
                        <td className="px-4 py-3">{row.itemCount}</td>
                        <td className="px-4 py-3 font-medium">
                          {formatCurrency(row.refundAmount)}
                        </td>
                      </ClickableTableRow>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
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

function LocalDayFallback({ date, backHref }: { date: string; backHref: string }) {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listLocalOrders>>>(null);
  useEffect(() => {
    const start = new Date(`${date}T00:00:00`).getTime();
    const end = start + 24 * 60 * 60 * 1000 - 1;
    let cancelled = false;
    void listLocalOrders({ startDate: start, endDate: end }).then((rows) => {
      if (!cancelled) setOrders(rows);
    });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatDate(new Date(`${date}T00:00:00`))}
        description="Orders saved on this device"
        actions={
          <Button asChild variant="outline">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              Reports
            </Link>
          </Button>
        }
      />
      {orders === null ? (
        <LoadingState label="Loading local orders…" />
      ) : orders.length === 0 ? (
        <EmptyState title="No local orders for this day" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <ClickableTableRow key={order.id} href={`/orders/${order.id}`}>
                    <td className="px-4 py-3 font-medium">{order.invoiceNumber}</td>
                    <td className="px-4 py-3">{order.customerName}</td>
                    <td className="px-4 py-3">{formatCurrency(order.total)}</td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
