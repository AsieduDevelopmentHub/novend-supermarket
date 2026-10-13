"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/feedback/empty-state";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime } from "@/lib/date";
import { paymentMethodLabel } from "@/lib/payments";
import type { AgingSummary } from "@/convex/shared/customerCredit";
import { RecordCustomerPaymentDialog } from "./record-customer-payment-dialog";

export type CreditLedgerRow = {
  id: string;
  type: "sale_charge" | "payment" | "adjustment";
  /** Signed effect on what the customer owes. */
  amount: number;
  method: string | null;
  note: string | null;
  occurredAt: number;
};

type CustomerCreditCardProps = {
  customerId: string;
  customerName: string;
  balance: number;
  creditLimit: number | null;
  aging: AgingSummary;
  entries: CreditLedgerRow[];
  canRecordPayment: boolean;
};

const ENTRY_LABELS: Record<CreditLedgerRow["type"], string> = {
  sale_charge: "Sale on account",
  payment: "Payment received",
  adjustment: "Return credit",
};

function Figure({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div>
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={emphasis ? "mt-1 text-lg font-semibold" : "mt-1 font-medium"}>{value}</p>
    </div>
  );
}

export function CustomerCreditCard({
  customerId,
  customerName,
  balance,
  creditLimit,
  aging,
  entries,
  canRecordPayment,
}: CustomerCreditCardProps) {
  const [paymentOpen, setPaymentOpen] = useState(false);
  const available = creditLimit === null ? null : Math.max(0, creditLimit - balance);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Account balance</CardTitle>
        {canRecordPayment ? (
          <Button
            type="button"
            size="sm"
            disabled={balance <= 0}
            onClick={() => setPaymentOpen(true)}
          >
            Record payment
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <Figure label="Owes" value={formatCurrency(balance)} emphasis />
          <Figure
            label="Credit limit"
            value={creditLimit === null ? "No limit" : formatCurrency(creditLimit)}
          />
          <Figure
            label="Available"
            value={available === null ? "—" : formatCurrency(available)}
          />
        </div>

        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Aging
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Figure label="0–30 days" value={formatCurrency(aging.current)} />
            <Figure label="31–60 days" value={formatCurrency(aging.days31to60)} />
            <Figure label="61+ days" value={formatCurrency(aging.days61plus)} />
          </div>
        </div>

        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
            Recent activity
          </p>
          {entries.length === 0 ? (
            <EmptyState title="No account activity yet" />
          ) : (
            <ul className="divide-border divide-y text-sm">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-baseline justify-between gap-3 py-2">
                  <span>
                    {ENTRY_LABELS[entry.type]}
                    {entry.type === "payment" && entry.method
                      ? ` · ${paymentMethodLabel(entry.method)}`
                      : ""}
                    {entry.note ? ` · ${entry.note}` : ""}
                    <span className="text-muted-foreground block text-xs">
                      {formatDateTime(entry.occurredAt)}
                    </span>
                  </span>
                  <span
                    className={entry.amount < 0 ? "text-primary font-medium" : "font-medium"}
                  >
                    {entry.amount < 0 ? "−" : "+"}
                    {formatCurrency(Math.abs(entry.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
      {canRecordPayment ? (
        <RecordCustomerPaymentDialog
          open={paymentOpen}
          onOpenChange={setPaymentOpen}
          customerId={customerId}
          customerName={customerName}
          balance={balance}
        />
      ) : null}
    </Card>
  );
}
