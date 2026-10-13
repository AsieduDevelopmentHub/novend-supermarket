"use client";

import { useEffect, useState } from "react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { PageHeader } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatCurrency } from "@/lib/currency";
import { paymentMethodLabel } from "@/lib/payments";
import { formatDateTime } from "@/lib/date";
import { ArrowLeft, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import { getMirroredCustomerDetail } from "@/lib/offline/mirror-queries";
import { usePermissions } from "@/hooks/use-permissions";
import { useBusinessCapabilities } from "@/hooks/use-business-capabilities";
import { summarizeAging } from "@/convex/shared/customerCredit";
import { CustomerCreditCard, type CreditLedgerRow } from "./customer-credit-card";

export function CustomerDetailView({ customerId }: { customerId: Id<"customers"> }) {
  const router = useRouter();
  const online = useConnectivity();
  const { isAdmin, isManager } = usePermissions();
  const { hasCapability } = useBusinessCapabilities();
  const remote = useAuthedQuery(api.customers.get, online ? { id: customerId } : "skip");
  const history = useAuthedQuery(
    api.customers.purchaseHistory,
    online ? { customerId, limit: 30 } : "skip",
  );
  const [local, setLocal] = useState<
    Awaited<ReturnType<typeof getMirroredCustomerDetail>> | undefined
  >(undefined);
  useEffect(() => {
    let cancelled = false;
    void getMirroredCustomerDetail(customerId).then((row) => {
      if (!cancelled) setLocal(row);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const customer =
    remote ??
    (local?.customer
      ? {
          ...local.customer,
          _id: customerId,
        }
      : remote === undefined && local === undefined
        ? undefined
        : null);
  const localHistory = local?.orders.map((order) => ({
    id: order.id,
    invoiceNumber: order.invoiceNumber,
    completedAt: order.completedAt,
    total: order.total,
    itemCount: order.itemCount,
    paymentMethod: order.paymentMethod,
  }));
  const purchases = history ?? localHistory;

  const creditOn = hasCapability("customer_credit");
  const canRecordPayment = creditOn && (isAdmin || isManager);
  const remoteBalance = useAuthedQuery(
    api.customerLedger.balance,
    online && creditOn ? { customerId } : "skip",
  );
  const remoteEntries = useAuthedQuery(
    api.customerLedger.listForCustomer,
    online && canRecordPayment ? { customerId, limit: 20 } : "skip",
  );
  const localLedger: CreditLedgerRow[] = (local?.ledger ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    amount: row.amount,
    method: row.method ?? null,
    note: row.note ?? null,
    occurredAt: row.occurredAt,
  }));
  const creditEntries: CreditLedgerRow[] = (remoteEntries ?? localLedger).slice(0, 20);
  const creditBalance = remoteBalance?.balance ?? local?.customer.balance ?? 0;
  const creditAging =
    remoteBalance?.aging ??
    summarizeAging(
      localLedger.map((row) => ({ type: row.type, amount: row.amount, occurredAt: row.occurredAt })),
      Date.now(),
    );

  if (customer === undefined || (online && history === undefined && !localHistory)) {
    return <LoadingState label="Loading customer…" />;
  }

  if (!customer) {
    return <ErrorState message="Customer not found." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description="Profile and purchase history"
        actions={
          <Button asChild variant="outline">
            <Link href="/customers">
              <ArrowLeft className="h-4 w-4" />
              Customers
            </Link>
          </Button>
        }
      />

      <Card>
        <CardContent className="grid gap-3 p-5 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Phone</p>
            <p className="mt-1 font-medium">{customer.phone ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="mt-1 font-medium">{customer.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Status</p>
            <Badge
              variant={customer.status === "active" ? "success" : "secondary"}
              className="mt-1"
            >
              {customer.status}
            </Badge>
          </div>
          {customer.notes ? (
            <div className="sm:col-span-2">
              <p className="text-muted-foreground">Notes</p>
              <p className="mt-1">{customer.notes}</p>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {creditOn ? (
        <CustomerCreditCard
          customerId={customerId}
          customerName={customer.name}
          balance={creditBalance}
          creditLimit={remoteBalance?.creditLimit ?? customer.creditLimit ?? null}
          aging={creditAging}
          entries={creditEntries}
          canRecordPayment={canRecordPayment}
        />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
        </CardHeader>
        <CardContent>
          {purchases?.length === 0 ? (
            <EmptyState title="No purchases yet" />
          ) : (
            <ul className="space-y-3">
              {(purchases ?? []).map((sale) => (
                <li key={sale.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/orders/${sale.id}`)}
                    className="border-border hover:bg-muted/40 flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors"
                  >
                    <div>
                      <p className="font-medium">{sale.invoiceNumber}</p>
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(sale.completedAt)} · {sale.itemCount} items ·{" "}
                        <Badge variant="secondary">{paymentMethodLabel(sale.paymentMethod)}</Badge>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{formatCurrency(sale.total)}</p>
                      <Eye className="text-muted-foreground h-4 w-4" aria-hidden />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
