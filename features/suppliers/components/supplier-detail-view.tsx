"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePreferLocalData } from "@/hooks/use-prefer-local-data";
import { usePermissions } from "@/hooks/use-permissions";
import { useProductsList } from "@/hooks/use-offline-lists";
import { getMirroredSupplier } from "@/lib/offline/mirror-queries";
import { subscribeReplicaChanged } from "@/lib/offline/replica-events";
import {
  purchaseBalance,
  purchasePaymentStatus,
  settledAmount,
} from "@/convex/shared/supplierFinance";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueSupplierPayment,
} from "@/lib/offline/replica-writes";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { SETTLEMENT_METHOD_OPTIONS, paymentMethodLabel, type SettlementMethod } from "@/lib/payments";
import { paymentStatusLabel } from "@/convex/shared/supplierFinance";
import { RecordPurchaseDialog } from "@/features/wholesale/components/record-purchase-dialog";
import { SINGLE_STORE } from "@/constants/app";
import { showError } from "@/lib/errors";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

type Delivery = {
  id: string;
  reference: string;
  invoiceNumber: string | null;
  purchasedAt: number;
  totalCost: number;
  balance: number;
  paymentStatus: "paid" | "partial" | "owed";
  legacy: boolean;
  items: Array<{ productName: string; quantity: number; unitCost: number; lineTotal: number }>;
};

type PaymentRow = {
  id: string;
  purchaseReference: string | null;
  amount: number;
  paidAt: number;
  method: string;
  note: string | null;
};

const STATUS_VARIANT = {
  paid: "success",
  partial: "warning",
  owed: "destructive",
} as const;

export function SupplierDetailView({ supplierId }: { supplierId: string }) {
  const { canManageProducts } = usePermissions();
  const online = useConnectivity();
  const isLocal = supplierId.startsWith("local_");
  const remote = useAuthedQuery(
    api.suppliers.get,
    online && !isLocal ? { id: supplierId as Id<"suppliers"> } : "skip",
  );
  const preferLocal = usePreferLocalData(remote !== undefined);
  const { products } = useProductsList({
    search: "",
    includeInactive: false,
    canViewCost: true,
    preferLocal: true,
  });
  const recordPayment = useMutation(api.suppliers.recordPayment);
  const [local, setLocal] = useState<Awaited<ReturnType<typeof getMirroredSupplier>> | undefined>(
    undefined,
  );
  const [localReady, setLocalReady] = useState(false);
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<SettlementMethod>("cash");
  const [purchaseId, setPurchaseId] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function load() {
      void getMirroredSupplier(supplierId)
        .then((row) => {
          if (cancelled) return;
          setLocal(row);
          setLocalReady(true);
        })
        .catch(() => {
          if (cancelled) return;
          setLocal(null);
          setLocalReady(true);
        });
    }
    load();
    const unsubscribe = subscribeReplicaChanged(load);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [supplierId]);

  if (!canManageProducts) {
    return (
      <EmptyState
        title="Access required"
        description="Supplier records are for managers and administrators."
      />
    );
  }

  const pendingOnDevice =
    Boolean(local?.payments.some((row) => row.id.startsWith("local_"))) ||
    Boolean(local?.purchases.some((row) => row.id.startsWith("local_")));
  // Dexie while offline / Cap false-online / local-only id / pending device writes.
  const forceLocal = !online || preferLocal || isLocal || pendingOnDevice;
  const source = forceLocal ? local : (remote ?? local);

  if (forceLocal && !localReady) {
    return <LoadingState label="Loading supplier…" />;
  }
  if (!forceLocal && source === undefined && !localReady) {
    return <LoadingState label="Loading supplier…" />;
  }
  if (!source) {
    return (
      <ErrorState message="Supplier not found. Open Suppliers and select a contact from the list." />
    );
  }

  const purchaseRows = source.purchases ?? [];
  const deliveries: Delivery[] = purchaseRows.map((row) => {
    const amountPaid =
      "amountPaid" in row ? (row.amountPaid as number | null | undefined) : undefined;
    const balance =
      "balance" in row && typeof row.balance === "number"
        ? row.balance
        : purchaseBalance({ totalCost: row.totalCost, amountPaid });
    const rawStatus =
      "paymentStatus" in row && row.paymentStatus
        ? row.paymentStatus
        : purchasePaymentStatus({ totalCost: row.totalCost, amountPaid });
    const paymentStatus: Delivery["paymentStatus"] =
      rawStatus === "paid" || rawStatus === "partial" || rawStatus === "owed"
        ? rawStatus
        : purchasePaymentStatus({ totalCost: row.totalCost, amountPaid });
    return {
      id: String(row.id),
      reference: row.reference,
      invoiceNumber: row.invoiceNumber,
      purchasedAt: row.purchasedAt,
      totalCost: row.totalCost,
      balance,
      paymentStatus,
      legacy: "legacy" in row ? Boolean(row.legacy) : amountPaid === undefined,
      items: "items" in row && Array.isArray(row.items) ? row.items : [],
    };
  });
  const payments: PaymentRow[] =
    "payments" in source && Array.isArray(source.payments)
      ? source.payments.map((row) => ({
          id: String(row.id),
          purchaseReference: row.purchaseReference ?? null,
          amount: row.amount,
          paidAt: row.paidAt,
          method: row.method,
          note: row.note ?? null,
        }))
      : [];
  const purchased =
    typeof source.purchased === "number"
      ? source.purchased
      : purchaseRows.reduce((sum, row) => sum + row.totalCost, 0);
  const paid =
    typeof source.paid === "number"
      ? source.paid
      : purchaseRows.reduce(
          (sum, row) =>
            sum +
            settledAmount({
              totalCost: row.totalCost,
              amountPaid: "amountPaid" in row ? (row.amountPaid as number | null) : undefined,
            }),
          0,
        );
  const owed =
    typeof source.owed === "number"
      ? source.owed
      : purchaseRows.reduce(
          (sum, row) =>
            sum +
            purchaseBalance({
              totalCost: row.totalCost,
              amountPaid: "amountPaid" in row ? (row.amountPaid as number | null) : undefined,
            }),
          0,
        );
  const openDeliveries = deliveries.filter((row) => row.balance > 0);

  async function onPayment(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Enter an amount greater than zero");
      }
      const paidAt = Date.now();
      const selectedPurchase = purchaseId || undefined;
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          recordPayment({
            supplierId: supplierId as Id<"suppliers">,
            purchaseId: selectedPurchase as Id<"supplierPurchases"> | undefined,
            amount: value,
            paidAt,
            method,
            note: note.trim() || undefined,
          }),
        local: () =>
          queueSupplierPayment({
            supplierId,
            purchaseId: selectedPurchase,
            amount: value,
            paidAt,
            method,
            note: note.trim() || undefined,
          }),
      });
      toast.success(queuedSaveMessage(kind, "Payment recorded"));
      setPaymentOpen(false);
      setAmount("");
      setNote("");
      setPurchaseId("");
    } catch (error) {
      showError(error, "Could not record payment");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={source.name}
        description={
          SINGLE_STORE
            ? "Supplier contact. Restock shelf stock from Inventory → Adjust → Supplier restock."
            : "Deliveries, payments, and what is still owed"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/suppliers">
                <ArrowLeft className="h-4 w-4" />
                Suppliers
              </Link>
            </Button>
            {!SINGLE_STORE ? (
              <>
                <Button type="button" variant="outline" onClick={() => setDeliveryOpen(true)}>
                  Record delivery
                </Button>
                <Button type="button" onClick={() => setPaymentOpen(true)} disabled={owed <= 0}>
                  Record payment
                </Button>
              </>
            ) : (
              <Button asChild>
                <Link href="/inventory">Go to inventory</Link>
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>{source.contactName || "No contact name"}</p>
            <p>{source.phone || "No phone"}</p>
            <p>{source.email || "No email"}</p>
            <p>{source.address || "No address"}</p>
            {source.notes ? <p className="text-muted-foreground">{source.notes}</p> : null}
            <Badge variant={source.status === "active" ? "success" : "secondary"}>
              {source.status}
            </Badge>
          </CardContent>
        </Card>
        {!SINGLE_STORE ? (
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm">Purchased</p>
                <p className="mt-1 text-2xl font-semibold">{formatCurrency(purchased)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm">Paid</p>
                <p className="mt-1 text-2xl font-semibold">{formatCurrency(paid)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm">Owed</p>
                <p className="mt-1 text-2xl font-semibold">{formatCurrency(owed)}</p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>How to restock</CardTitle>
            </CardHeader>
            <CardContent className="text-muted-foreground space-y-2 text-sm">
              <p>
                Millie&apos;s keeps suppliers as a contact list. To put goods on the shelf, open{" "}
                <Link href="/inventory" className="text-foreground font-medium underline">
                  Inventory
                </Link>
                , choose the product, Adjust → Add stock → <strong>Supplier restock</strong>, and
                optionally note this supplier in the note field.
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {!SINGLE_STORE ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Deliveries</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {deliveries.length === 0 ? (
                <p className="text-muted-foreground text-sm">No deliveries recorded yet.</p>
              ) : (
                deliveries.map((delivery) => (
                  <article
                    key={delivery.id}
                    className="border-border space-y-2 border-b pb-4 last:border-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">
                          {delivery.reference}
                          {delivery.invoiceNumber ? ` · ${delivery.invoiceNumber}` : ""}
                        </p>
                        <p className="text-muted-foreground text-xs">
                          {formatDateTime(delivery.purchasedAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span>{formatCurrency(delivery.totalCost)}</span>
                        <Badge variant={STATUS_VARIANT[delivery.paymentStatus]}>
                          {paymentStatusLabel(delivery.paymentStatus)}
                        </Badge>
                      </div>
                    </div>
                    {delivery.balance > 0 ? (
                      <p className="text-sm">Still owed {formatCurrency(delivery.balance)}</p>
                    ) : null}
                    {delivery.legacy ? (
                      <p className="text-muted-foreground text-xs">
                        Recorded before supplier balances. Treated as paid.
                      </p>
                    ) : null}
                    {delivery.items.length > 0 ? (
                      <ul className="text-muted-foreground space-y-1 text-sm">
                        {delivery.items.map((item) => (
                          <li
                            key={`${delivery.id}-${item.productName}-${item.quantity}-${item.unitCost}`}
                          >
                            {item.productName} · {item.quantity} · cost{" "}
                            {formatCurrency(item.unitCost)} · {formatCurrency(item.lineTotal)}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </article>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-muted-foreground text-sm">No payments recorded yet.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex flex-wrap items-baseline justify-between gap-2"
                    >
                      <span>
                        {formatCurrency(payment.amount)} · {paymentMethodLabel(payment.method)}
                        {payment.purchaseReference ? ` · ${payment.purchaseReference}` : ""}
                        {payment.note ? ` · ${payment.note}` : ""}
                      </span>
                      <span className="text-muted-foreground">
                        {formatDateTime(payment.paidAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <RecordPurchaseDialog
            key={deliveryOpen ? "delivery-open" : "delivery-closed"}
            open={deliveryOpen}
            onOpenChange={setDeliveryOpen}
            suppliers={[{ id: supplierId, name: source.name }]}
            products={products ?? []}
            defaultSupplierId={supplierId}
            lockSupplier
          />

          <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
            <DialogContent>
              <form onSubmit={(event) => void onPayment(event)}>
                <DialogHeader>
                  <DialogTitle>Record a payment</DialogTitle>
                  <DialogDescription>
                    Apply this to one delivery, or leave the delivery blank to pay the oldest
                    balance first.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Delivery</Label>
                    <SearchableSelect
                      options={[
                        { value: "oldest", label: "Oldest open delivery" },
                        ...openDeliveries.map((row) => ({
                          value: row.id,
                          label: `${row.reference} · owed ${formatCurrency(row.balance)}`,
                        })),
                      ]}
                      value={purchaseId || "oldest"}
                      onValueChange={(value) => setPurchaseId(value === "oldest" ? "" : value)}
                      placeholder="Oldest open delivery"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Paid with</Label>
                    <select
                      className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                      value={method}
                      onChange={(event) => setMethod(event.target.value as SettlementMethod)}
                    >
                      {SETTLEMENT_METHOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Note</Label>
                    <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={pending}>
                    Save payment
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
    </div>
  );
}
