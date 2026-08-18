"use client";

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
import { EmptyState } from "@/components/feedback/empty-state";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { ArrowLeft, Eye } from "lucide-react";
import { useRouter } from "next/navigation";

export function CustomerDetailView({ customerId }: { customerId: Id<"customers"> }) {
  const router = useRouter();
  const customer = useQuery(api.customers.get, { id: customerId });
  const history = useQuery(api.customers.purchaseHistory, {
    customerId,
    limit: 30,
  });

  if (customer === undefined || history === undefined) {
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

      <Card>
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <EmptyState title="No purchases yet" />
          ) : (
            <ul className="space-y-3">
              {history.map((sale) => (
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
                        <span className="capitalize">{sale.paymentMethod.replace("_", " ")}</span>
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
