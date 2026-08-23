"use client";

import Link from "next/link";
import { ArrowLeft, Building2, CreditCard } from "lucide-react";
import { PageHeader, Grid } from "@/components/layout/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { useConnectivity } from "@/hooks/use-connectivity";
import { usePlatformPaymentData } from "@/hooks/use-platform-offline-data";

export function PlatformPaymentDetailView({ paymentId }: { paymentId: string }) {
  const online = useConnectivity();
  const { data: payment, loading } = usePlatformPaymentData(paymentId);

  if (loading || payment === undefined) {
    return <LoadingState label="Loading payment…" />;
  }
  if (!payment) {
    return (
      <ErrorState
        title="Payment not found"
        message="This billing record is missing or was never synced to this device."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={formatCurrency(payment.amount)}
        description={payment.description}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/platform/revenue">
                <ArrowLeft className="h-4 w-4" />
                Revenue
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/platform/${payment.organizationId}`}>
                <Building2 className="h-4 w-4" />
                Open organization
              </Link>
            </Button>
          </div>
        }
      />

      {!online ? (
        <p className="text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 text-sm">
          Showing cached payment details while offline.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Badge variant={payment.status === "success" ? "success" : "secondary"}>
          {payment.status}
        </Badge>
        <Badge variant="outline" className="capitalize">
          {payment.gateway}
        </Badge>
        {payment.plan ? <Badge variant="outline">{payment.plan}</Badge> : null}
        {payment.billingCycle ? (
          <Badge variant="outline" className="capitalize">
            {payment.billingCycle}
          </Badge>
        ) : null}
      </div>

      <Grid cols={4}>
        <InfoCard label="Organization" value={payment.organizationName} />
        <InfoCard label="Reference" value={payment.reference} />
        <InfoCard
          label="Paid"
          value={payment.paidAt ? formatDateTime(payment.paidAt) : "—"}
        />
        <InfoCard label="Created" value={formatDateTime(payment.createdAt)} />
      </Grid>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Payment details
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="Amount" value={formatCurrency(payment.amount)} />
          <Info label="Currency" value={payment.currency} />
          <Info label="Gateway" value={payment.gateway} />
          <Info label="Status" value={payment.status} />
          <Info label="Plan" value={payment.plan ?? payment.planKey ?? "—"} />
          <Info label="Billing cycle" value={payment.billingCycle ?? "—"} />
          <Info label="Organization slug" value={payment.organizationSlug ?? "—"} />
          <Info label="Updated" value={formatDateTime(payment.updatedAt)} />
        </CardContent>
      </Card>

      {payment.metadata ? (
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted/40 max-h-60 overflow-auto rounded-lg p-3 text-xs whitespace-pre-wrap">
              {payment.metadata}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold">{value}</p>
      </CardContent>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 font-medium break-all">{value}</p>
    </div>
  );
}
