"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { ReceiptPreviewDialog } from "@/features/receipts/components/receipt-preview-dialog";
import type { ReceiptPayload } from "@/features/receipts/types";
import { ReturnOrderDialog } from "@/features/orders/components/return-order-dialog";
import { getOfflineDb } from "@/lib/offline/db";
import {
  listUnsyncedLocalReturns,
  returnedQtyBySaleItem,
} from "@/lib/offline/returns-repository";
import { ArrowLeft, ChevronRight, Printer, Undo2 } from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useConnectivity } from "@/hooks/use-connectivity";
import { useAppNavigation } from "@/hooks/use-app-navigation";

type OrderDetail = {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  cashierName: string;
  paymentMethod: "cash" | "card" | "mobile_money";
  subtotal: number;
  discount: number;
  total: number;
  completedAt: number;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
    returnedQuantity: number;
    remainingQuantity: number;
  }>;
  refundedAmount: number;
  remainingRefundable: number;
  canReturn: boolean;
  returns: Array<{
    id: string;
    returnNumber: string;
    refundAmount: number;
    reason: string;
    notes: string | null;
    itemCount: number;
    completedAt: number;
  }>;
  receiptPayload: ReceiptPayload | null;
  syncHint?: string;
};

async function overlayPendingReturns(base: OrderDetail): Promise<OrderDetail> {
  const extraReturned = await returnedQtyBySaleItem(base.id);
  const pending = await listUnsyncedLocalReturns(base.id);
  if (extraReturned.size === 0 && pending.length === 0) return base;

  const items = base.items.map((item) => {
    const returnedQuantity = item.returnedQuantity + (extraReturned.get(item.id) ?? 0);
    return {
      ...item,
      returnedQuantity,
      remainingQuantity: Math.max(0, item.quantity - returnedQuantity),
    };
  });
  const extraRefund = pending.reduce((sum, row) => sum + row.refundAmount, 0);
  const refundedAmount = base.refundedAmount + extraRefund;
  const pendingIds = new Set(pending.map((row) => row.id));
  const returns = [
    ...base.returns.filter((row) => !pendingIds.has(row.id)),
    ...pending.map((row) => ({
      id: row.id,
      returnNumber: row.returnNumber,
      refundAmount: row.refundAmount,
      reason: row.reason,
      notes: row.notes ?? null,
      itemCount: row.itemCount,
      completedAt: row.completedAt,
    })),
  ].sort((a, b) => b.completedAt - a.completedAt);

  return {
    ...base,
    items,
    refundedAmount,
    remainingRefundable: Math.max(0, base.total - refundedAmount),
    canReturn: items.some((item) => item.remainingQuantity > 0),
    returns,
  };
}

function isLocalSaleId(id: string): boolean {
  return id.startsWith("lsale_");
}

function mapRemoteOrder(remote: {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  cashierName: string;
  paymentMethod: "cash" | "card" | "mobile_money";
  subtotal: number;
  discount: number;
  total: number;
  completedAt: number;
  items: OrderDetail["items"];
  refundedAmount: number;
  remainingRefundable: number;
  canReturn: boolean;
  returns: OrderDetail["returns"];
  receiptPayload: unknown;
}): OrderDetail {
  return {
    id: remote.id,
    invoiceNumber: remote.invoiceNumber,
    customerId: remote.customerId,
    customerName: remote.customerName,
    cashierName: remote.cashierName,
    paymentMethod: remote.paymentMethod,
    subtotal: remote.subtotal,
    discount: remote.discount,
    total: remote.total,
    completedAt: remote.completedAt,
    items: remote.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      lineTotal: item.lineTotal,
      returnedQuantity: item.returnedQuantity,
      remainingQuantity: item.remainingQuantity,
    })),
    refundedAmount: remote.refundedAmount,
    remainingRefundable: remote.remainingRefundable,
    canReturn: remote.canReturn,
    returns: remote.returns,
    receiptPayload: remote.receiptPayload as ReceiptPayload | null,
  };
}

async function loadLocalOrder(localSaleId: string): Promise<OrderDetail | null> {
  const offlineDb = await getOfflineDb();
  if (!offlineDb) return null;

  const sale = await offlineDb.localSales.get(localSaleId);
  if (!sale) return null;

  const [items, receipt] = await Promise.all([
    offlineDb.localSaleItems.where("localSaleId").equals(localSaleId).toArray(),
    offlineDb.localReceipts.where("localSaleId").equals(localSaleId).first(),
  ]);

  let receiptPayload: ReceiptPayload | null = null;
  if (receipt?.payloadJson) {
    try {
      receiptPayload = JSON.parse(receipt.payloadJson) as ReceiptPayload;
    } catch {
      receiptPayload = null;
    }
  }

  const syncHint =
    sale.syncStatus === "pending"
      ? "Saved on this device — waiting to sync"
      : sale.syncStatus === "failed"
        ? sale.lastError
          ? `Sync failed: ${sale.lastError}`
          : "Sync failed"
        : undefined;

  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerId: sale.customerId ?? null,
    customerName: sale.customerName,
    cashierName: sale.cashierName,
    paymentMethod: sale.paymentMethod,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    completedAt: sale.completedAt,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      lineTotal: item.lineTotal,
      returnedQuantity: 0,
      remainingQuantity: item.quantity,
    })),
    refundedAmount: 0,
    remainingRefundable: sale.total,
    canReturn: false,
    returns: [],
    receiptPayload,
    syncHint,
  };
}

async function loadMirroredOrder(saleId: string): Promise<OrderDetail | null> {
  const db = await getOfflineDb();
  if (!db) return null;
  const sale = await db.orders.get(saleId);
  if (!sale) return null;
  const [items, mirroredReturns] = await Promise.all([
    db.orderItems.where("orderId").equals(saleId).toArray(),
    db.returns.where("saleId").equals(saleId).toArray(),
  ]);
  const base: OrderDetail = {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerId: sale.customerId,
    customerName: sale.customerName,
    cashierName: sale.cashierName,
    paymentMethod: sale.paymentMethod,
    subtotal: sale.subtotal,
    discount: sale.discount,
    total: sale.total,
    completedAt: sale.completedAt,
    items: items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
      lineTotal: item.lineTotal,
      returnedQuantity: item.returnedQuantity,
      remainingQuantity: Math.max(0, item.quantity - item.returnedQuantity),
    })),
    refundedAmount: sale.refundedAmount ?? 0,
    remainingRefundable: Math.max(0, sale.total - (sale.refundedAmount ?? 0)),
    canReturn: items.some((item) => item.quantity - item.returnedQuantity > 0),
    returns: mirroredReturns
      .map((row) => ({
        id: row.id,
        returnNumber: row.returnNumber,
        refundAmount: row.refundAmount,
        reason: row.reason ?? "—",
        notes: null,
        itemCount: row.itemCount,
        completedAt: row.completedAt,
      }))
      .sort((a, b) => b.completedAt - a.completedAt),
    receiptPayload: null,
  };
  return overlayPendingReturns(base);
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  const local = isLocalSaleId(orderId);
  const online = useConnectivity();
  const { canProcessReturns } = usePermissions();
  const [localOrder, setLocalOrder] = useState<OrderDetail | null | undefined>(
    local ? undefined : null,
  );
  const [mirroredOrder, setMirroredOrder] = useState<OrderDetail | null>(null);
  const [overlaidRemote, setOverlaidRemote] = useState<OrderDetail | null>(null);
  const [resolvedServerId, setResolvedServerId] = useState<Id<"sales"> | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState<ReceiptPayload | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!local) {
      queueMicrotask(() => {
        setLocalOrder(null);
        setResolvedServerId(null);
      });
      return;
    }

    let cancelled = false;
    void (async () => {
      const offlineDb = await getOfflineDb();
      if (cancelled) return;
      if (!offlineDb) {
        setLocalOrder(null);
        return;
      }
      const sale = await offlineDb.localSales.get(orderId);
      if (cancelled) return;
      if (sale?.serverSaleId) {
        setResolvedServerId(sale.serverSaleId as Id<"sales">);
        setLocalOrder(null);
        return;
      }
      const detail = await loadLocalOrder(orderId);
      if (!cancelled) {
        setResolvedServerId(null);
        setLocalOrder(detail);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [local, orderId, refreshKey]);

  const remoteId: Id<"sales"> | null = local ? resolvedServerId : (orderId as Id<"sales">);
  const remote = useQuery(
    api.sales.getOrder,
    online && remoteId ? { id: remoteId } : "skip",
  );

  useEffect(() => {
    if (!online || !remote) {
      queueMicrotask(() => setOverlaidRemote(null));
      return;
    }
    let cancelled = false;
    void overlayPendingReturns(mapRemoteOrder(remote)).then((detail) => {
      if (!cancelled) setOverlaidRemote(detail);
    });
    return () => {
      cancelled = true;
    };
  }, [online, remote, refreshKey]);

  useEffect(() => {
    if (online && remote) return;
    const saleId = remoteId ?? (local ? null : orderId);
    if (!saleId || isLocalSaleId(saleId)) {
      queueMicrotask(() => setMirroredOrder(null));
      return;
    }
    let cancelled = false;
    void loadMirroredOrder(saleId).then((detail) => {
      if (!cancelled) setMirroredOrder(detail);
    });
    return () => {
      cancelled = true;
    };
  }, [online, remote, remoteId, local, orderId, refreshKey]);

  let order: OrderDetail | null | undefined;
  if (local && !resolvedServerId) {
    order = localOrder;
  } else if (online && remote === undefined) {
    order = mirroredOrder ?? undefined;
  } else if (online && remote) {
    order = overlaidRemote ?? mapRemoteOrder(remote);
  } else {
    order = mirroredOrder ?? (local ? (localOrder ?? null) : null);
  }

  if (order === undefined) {
    return <LoadingState label="Loading order…" />;
  }

  if (!order) {
    return <ErrorState message="Order not found." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={order.invoiceNumber}
        description={formatDateTime(order.completedAt)}
        compactActions={[
          { key: "back", label: "Orders", icon: ArrowLeft, href: "/orders" },
          ...(order.receiptPayload
            ? [
                {
                  key: "receipt",
                  label: "Receipt",
                  icon: Printer,
                  onClick: () => setPreviewOpen(true),
                } as const,
              ]
            : []),
          ...(canProcessReturns && order.canReturn
            ? [
                {
                  key: "return",
                  label: "Return",
                  icon: Undo2,
                  onClick: () => setReturnOpen(true),
                } as const,
              ]
            : []),
        ]}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/orders">
                <ArrowLeft className="h-4 w-4" />
                Orders
              </Link>
            </Button>
            {order.receiptPayload ? (
              <Button type="button" onClick={() => setPreviewOpen(true)}>
                <Printer className="h-4 w-4" />
                Receipt
              </Button>
            ) : null}
            {canProcessReturns && order.canReturn ? (
              <Button type="button" variant="outline" onClick={() => setReturnOpen(true)}>
                <Undo2 className="h-4 w-4" />
                Return
              </Button>
            ) : null}
          </div>
        }
      />

      {order.syncHint ? (
        <p className="text-muted-foreground text-sm" role="status">
          {order.syncHint}
        </p>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetaCard label="Customer" value={order.customerName} />
        <MetaCard label="Cashier" value={order.cashierName} />
        <MetaCard label="Payment" value={order.paymentMethod.replace("_", " ")} capitalize />
        <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
          <p className="text-muted-foreground text-sm">Status</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="success">Completed</Badge>
            {order.refundedAmount > 0 ? (
              <Badge variant="warning">
                {order.canReturn ? "Partial return" : "Returned"}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item) => {
            const returned = item.returnedQuantity > 0;
            return (
              <div
                key={item.id}
                className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
              >
                <div className="min-w-0">
                  <Link href={`/products/${item.productId}`} className="font-medium hover:underline">
                    {item.productName}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {item.quantity} × {formatCurrency(item.unitPrice)}
                    {item.discount > 0 ? ` (−${formatCurrency(item.discount)})` : ""}
                  </p>
                  {returned ? (
                    <p className="text-warning mt-1 text-xs font-medium">
                      Returned {item.returnedQuantity}
                      {item.remainingQuantity > 0
                        ? ` · ${item.remainingQuantity} remaining`
                        : " · fully returned"}
                    </p>
                  ) : null}
                </div>
                <p className="font-semibold">{formatCurrency(item.lineTotal)}</p>
              </div>
            );
          })}
          <div className="space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>{formatCurrency(order.discount)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span className="text-primary">{formatCurrency(order.total)}</span>
            </div>
            {order.refundedAmount > 0 ? (
              <>
                <div className="flex justify-between text-warning">
                  <span>Refunded</span>
                  <span>−{formatCurrency(order.refundedAmount)}</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>Net</span>
                  <span>{formatCurrency(order.remainingRefundable === 0 ? 0 : order.total - order.refundedAmount)}</span>
                </div>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {order.returns.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Returns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {order.returns.map((row) => (
              <OrderReturnRow key={row.id} row={row} />
            ))}
          </CardContent>
        </Card>
      ) : null}

      {canProcessReturns && !order.canReturn && isLocalSaleId(order.id) ? (
        <p className="text-muted-foreground text-sm">
          Sync this sale before returning items.
        </p>
      ) : null}

      <ReceiptPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        payload={order.receiptPayload}
      />
      <ReceiptPreviewDialog
        open={returnReceipt !== null}
        onOpenChange={(open) => {
          if (!open) setReturnReceipt(null);
        }}
        payload={returnReceipt}
      />
      <ReturnOrderDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        saleId={order.id}
        invoiceNumber={order.invoiceNumber}
        saleTotal={order.total}
        saleSubtotal={order.subtotal}
        saleDiscount={order.discount}
        alreadyRefunded={order.refundedAmount}
        items={order.items}
        onCompleted={({ receiptPayload }) => {
          setReturnReceipt(receiptPayload);
          setRefreshKey((value) => value + 1);
        }}
      />
    </div>
  );
}

function OrderReturnRow({
  row,
}: {
  row: OrderDetail["returns"][number];
}) {
  const { navigate } = useAppNavigation();

  function openReturn() {
    navigate(`/returns/${row.id}`);
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={openReturn}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openReturn();
        }
      }}
      className="border-border hover:bg-muted/40 focus-visible:bg-muted/40 flex cursor-pointer items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-visible:outline-none"
    >
      <div className="min-w-0">
        <p className="font-medium">{row.returnNumber}</p>
        <p className="text-muted-foreground text-xs">
          {formatDateTime(row.completedAt)} · {row.reason} · {row.itemCount} items
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <p className="font-semibold">{formatCurrency(row.refundAmount)}</p>
        <ChevronRight className="text-muted-foreground h-4 w-4" aria-hidden />
      </div>
    </div>
  );
}

function MetaCard({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className={`mt-1 font-medium ${capitalize ? "capitalize" : ""}`}>{value}</p>
    </div>
  );
}
