"use client";

import { useAuthedQuery } from "@/hooks/use-authed-query";
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
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currency";
import { paymentMethodLabel } from "@/lib/payments";
import { formatDate, formatDateTime } from "@/lib/date";
import { ArrowLeft } from "lucide-react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePreferLocalData } from "@/hooks/use-prefer-local-data";
import { listLocalOrders } from "@/lib/offline/mirror-queries";
import { mergeDayOrdersWithLocal, paymentTotalsFromOrders } from "@/lib/offline/report-merge";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import { PaymentTotalsCard } from "@/components/data-display/payment-totals-card";
import { TillSessionsCard } from "@/features/reports/components/till-sessions-card";
import { useEffect, useState } from "react";

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Match cloud report day keys (UTC) used by salesSummary / buildLocalSalesReport. */
function utcDayBounds(date: string) {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  const end = Date.parse(`${date}T23:59:59.999Z`);
  return { start, end };
}

type LocalOrderRow = NonNullable<Awaited<ReturnType<typeof listLocalOrders>>>[number];

function useLocalDayOrders(date: string, branchId?: string | null) {
  const [orders, setOrders] = useState<LocalOrderRow[] | null>(null);
  useEffect(() => {
    if (!isIsoDate(date)) return;
    let cancelled = false;
    const { start, end } = utcDayBounds(date);
    function load() {
      void listLocalOrders({
        startDate: start,
        endDate: end,
        branchId: branchId || undefined,
      }).then((rows) => {
        if (!cancelled) setOrders(rows ?? []);
      });
    }
    load();
    const unsubscribe = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [date, branchId]);
  return orders;
}

export function ReportDayDetailView() {
  const online = useConnectivity();
  const params = useSearchParams();
  const date = params.get("date") ?? "";
  const branch = params.get("branch");
  const rangeStart = params.get("start");
  const rangeEnd = params.get("end");

  const details = useAuthedQuery(
    api.reports.dayDetails,
    online && isIsoDate(date)
      ? {
          date,
          branchId: branch ? (branch as Id<"branches">) : undefined,
        }
      : "skip",
  );
  const preferLocal = usePreferLocalData(details !== undefined);
  const localOrders = useLocalDayOrders(date, branch);

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

  if (!online || preferLocal) {
    return (
      <LocalDayFallback
        date={date}
        backHref={backHref}
        orders={localOrders}
        offlineNotice
      />
    );
  }

  if (details === undefined) {
    return <LoadingState label="Loading day…" variant="cards" />;
  }

  const mergedOrders = mergeDayOrdersWithLocal(
    details.orders.map((order) => ({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      completedAt: order.completedAt,
      customerName: order.customerName,
      cashierName: order.cashierName,
      branchName: order.branchName,
      paymentMethod: order.paymentMethod,
      itemCount: order.itemCount,
      total: order.total,
      pendingUpload: false,
    })),
    (localOrders ?? []).map((order) => ({
      id: order.id,
      invoiceNumber: order.invoiceNumber,
      completedAt: order.completedAt,
      customerName: order.customerName,
      cashierName: order.cashierName,
      branchName: order.branchName,
      paymentMethod: order.paymentMethod,
      itemCount: order.itemCount,
      total: order.total,
      pendingUpload: order.isLocal,
    })),
  );
  const pendingOrders = mergedOrders.filter((order) => order.pendingUpload);
  const pendingCount = pendingOrders.length;
  const pendingGross = pendingOrders.reduce((sum, order) => sum + order.total, 0);
  const pendingItems = pendingOrders.reduce((sum, order) => sum + order.itemCount, 0);
  const paymentTotals = paymentTotalsFromOrders(mergedOrders);
  const refunds = details.kpis.refunds;
  const grossSales = details.kpis.grossSales + pendingGross;
  const itemsSold = details.kpis.itemsSold + pendingItems;
  const netSales = details.kpis.netSales + pendingGross;
  const titleDate = formatDate(new Date(`${date}T00:00:00Z`));

  return (
    <div className="max-w-full min-w-0 space-y-6 overflow-x-hidden">
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

      <Grid cols={5}>
        <Kpi title="Orders" value={String(mergedOrders.length)} />
        <Kpi title="Items sold" value={String(itemsSold)} />
        <Kpi title="Gross sales" value={formatCurrency(grossSales)} />
        <Kpi title="Refunds" value={formatCurrency(refunds)} />
        <Kpi title="Net sales" value={formatCurrency(netSales)} />
      </Grid>

      <PaymentTotalsCard
        totals={paymentTotals}
        description="Gross tender totals for every order listed below, including unsynced sales."
      />

      <TillSessionsCard mode="day" date={date} />

      {pendingCount > 0 ? (
        <p className="text-muted-foreground text-sm">
          {pendingCount} sale{pendingCount === 1 ? "" : "s"} on this day are still only on this
          till. They are included in the totals and payment breakdown above.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
        </CardHeader>
        <CardContent className="max-w-full min-w-0 overflow-x-auto p-0">
          {mergedOrders.length === 0 ? (
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
                  <th className="px-4 py-3 font-medium">Payment</th>
                  <th className="px-4 py-3 font-medium">Items</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {mergedOrders.map((order) => (
                  <ClickableTableRow key={order.id} href={`/orders/${order.id}`}>
                    <td className="px-4 py-3 font-medium">
                      {order.invoiceNumber}
                      {order.pendingUpload ? (
                        <Badge variant="warning" className="ml-2">
                          Uploading
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">{formatDateTime(order.completedAt)}</td>
                    <td className="px-4 py-3">{order.customerName}</td>
                    <td className="px-4 py-3">{order.cashierName}</td>
                    <td className="px-4 py-3">{order.branchName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">
                        {paymentMethodLabel(order.paymentMethod)}
                      </Badge>
                    </td>
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
        <CardContent className="max-w-full min-w-0 overflow-x-auto p-0">
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
                    <td className="max-w-[180px] truncate px-4 py-3">{row.reason}</td>
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

function LocalDayFallback({
  date,
  backHref,
  orders,
  offlineNotice,
}: {
  date: string;
  backHref: string;
  orders: LocalOrderRow[] | null;
  offlineNotice: boolean;
}) {
  const gross = orders?.reduce((sum, order) => sum + order.total, 0) ?? 0;
  const items = orders?.reduce((sum, order) => sum + order.itemCount, 0) ?? 0;
  const paymentTotals = paymentTotalsFromOrders(orders ?? []);

  return (
    <div className="max-w-full min-w-0 space-y-6 overflow-x-hidden">
      <PageHeader
        title={formatDate(new Date(`${date}T00:00:00Z`))}
        description={
          offlineNotice
            ? "Orders saved on this device for this day. Figures update from the cloud when you reconnect."
            : "Orders saved on this device"
        }
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
        <>
          <Grid cols={3}>
            <Kpi title="Orders" value={String(orders.length)} />
            <Kpi title="Items sold" value={String(items)} />
            <Kpi title="Gross sales" value={formatCurrency(gross)} />
          </Grid>
          <PaymentTotalsCard
            totals={paymentTotals}
            description="Gross tender totals for orders saved on this device."
          />
          <Card>
            <CardContent className="max-w-full min-w-0 overflow-x-auto p-0">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Invoice</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Cashier</th>
                    <th className="px-4 py-3 font-medium">Payment</th>
                    <th className="px-4 py-3 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <ClickableTableRow key={order.id} href={`/orders/${order.id}`}>
                      <td className="px-4 py-3 font-medium">
                        {order.invoiceNumber}
                        {order.isLocal ? (
                          <Badge variant="warning" className="ml-2">
                            On device
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">{formatDateTime(order.completedAt)}</td>
                      <td className="px-4 py-3">{order.customerName}</td>
                      <td className="px-4 py-3">{order.cashierName}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">
                          {paymentMethodLabel(order.paymentMethod)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{formatCurrency(order.total)}</td>
                    </ClickableTableRow>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
      <TillSessionsCard mode="day" date={date} />
    </div>
  );
}
