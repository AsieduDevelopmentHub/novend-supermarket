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
import { ArrowLeft, Printer } from "lucide-react";
import { useConnectivity } from "@/hooks/use-connectivity";
import { getMirroredReturn } from "@/lib/offline/mirror-queries";

export function ReturnDetailView({ returnId }: { returnId: string }) {
  const online = useConnectivity();
  const [previewOpen, setPreviewOpen] = useState(false);
  const remote = useQuery(
    api.returns.get,
    online && !returnId.startsWith("local_") ? { id: returnId as Id<"saleReturns"> } : "skip",
  );
  const [local, setLocal] = useState<Awaited<ReturnType<typeof getMirroredReturn>> | undefined>(
    undefined,
  );
  useEffect(() => {
    let cancelled = false;
    void getMirroredReturn(returnId).then((row) => {
      if (!cancelled) setLocal(row);
    });
    return () => {
      cancelled = true;
    };
  }, [returnId]);
  const isLocalId = returnId.startsWith("local_");
  const record =
    online && !isLocalId && remote === null
      ? null
      : (remote ??
        (local
          ? {
              ...local,
              items: [] as Array<{
                id: string;
                productName: string;
                quantity: number;
                unitPrice: number;
                lineRefund: number;
              }>,
              reason: "",
              notes: null,
              invoiceNumber: local.invoiceNumber,
              customerName: local.customerName ?? "Customer",
              cashierName: local.cashierName ?? "Cashier",
              status: local.status ?? "completed",
              receiptPayload: null,
              refundMethod: "cash" as const,
            }
          : remote === undefined && local === undefined
            ? undefined
            : null));

  if (record === undefined) {
    return <LoadingState label="Loading return…" />;
  }
  if (!record) {
    return <ErrorState message="Return not found." />;
  }

  const receipt = record.receiptPayload as ReceiptPayload | null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={record.returnNumber}
        description={formatDateTime(record.completedAt)}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/returns">
                <ArrowLeft className="h-4 w-4" />
                Returns
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/orders/${record.saleId}`}>Original order</Link>
            </Button>
            {receipt ? (
              <Button type="button" onClick={() => setPreviewOpen(true)}>
                <Printer className="h-4 w-4" />
                Receipt
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Meta label="Customer" value={record.customerName} />
        <Meta label="Processed by" value={record.cashierName} />
        <Meta label="Branch" value={record.branchName ?? "—"} />
        <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
          <p className="text-muted-foreground text-sm">Type</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant={record.kind === "full" ? "warning" : "secondary"}>
              {record.kind === "full" ? "Full return" : "Partial return"}
            </Badge>
            <Badge variant="success">
              {record.status === "completed" ? "Completed" : "Pending"}
            </Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Returned items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {record.items.map((item) => (
            <div
              key={item.id}
              className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm"
            >
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-muted-foreground text-xs">
                  {item.quantity} × {formatCurrency(item.unitPrice)}
                </p>
              </div>
              <p className="font-semibold">{formatCurrency(item.lineRefund)}</p>
            </div>
          ))}
          <div className="flex justify-between border-t pt-3 text-base font-semibold">
            <span>Refund</span>
            <span className="text-primary">{formatCurrency(record.refundAmount)}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reason</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>{record.reason}</p>
          {record.notes ? <p className="text-muted-foreground">{record.notes}</p> : null}
          <p className="text-muted-foreground text-xs capitalize">
            Refund method: {record.refundMethod.replace("_", " ")}
          </p>
        </CardContent>
      </Card>

      <ReceiptPreviewDialog open={previewOpen} onOpenChange={setPreviewOpen} payload={receipt} />
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-card rounded-xl border p-4 shadow-sm">
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
