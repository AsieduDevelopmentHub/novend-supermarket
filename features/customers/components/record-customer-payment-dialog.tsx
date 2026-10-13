"use client";

import { FormEvent, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useConnectivity } from "@/hooks/use-connectivity";
import { showError } from "@/lib/errors";
import { formatCurrency } from "@/lib/currency";
import { SETTLEMENT_METHOD_OPTIONS, type SettlementMethod } from "@/lib/payments";
import {
  persistBusinessWrite,
  queuedSaveMessage,
  queueRecordCustomerPayment,
} from "@/lib/offline/replica-writes";

type RecordCustomerPaymentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  /** Amount the customer currently owes; a payment cannot exceed it. */
  balance: number;
};

export function RecordCustomerPaymentDialog({
  open,
  onOpenChange,
  customerId,
  customerName,
  balance,
}: RecordCustomerPaymentDialogProps) {
  const online = useConnectivity();
  const recordPayment = useMutation(api.customerLedger.recordPayment);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<SettlementMethod>("cash");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    try {
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error("Enter an amount greater than zero");
      }
      if (value - balance > 0.001) {
        throw new Error("That payment is more than this customer owes");
      }
      const paidAt = Date.now();
      const trimmedNote = note.trim() || undefined;
      const kind = await persistBusinessWrite({
        online,
        remote: () =>
          recordPayment({
            customerId: customerId as Id<"customers">,
            amount: value,
            method,
            note: trimmedNote,
            paidAt,
          }),
        local: () =>
          queueRecordCustomerPayment({
            customerId,
            amount: value,
            method,
            note: trimmedNote,
            paidAt,
          }),
      });
      toast.success(queuedSaveMessage(kind, "Payment recorded"));
      onOpenChange(false);
      setAmount("");
      setNote("");
    } catch (error) {
      showError(error, "Could not record payment");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={(event) => void onSubmit(event)}>
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>
              {customerName} owes {formatCurrency(balance)}. Payments settle the oldest charges
              first.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="space-y-2">
              <Label htmlFor="customer-payment-amount">Amount</Label>
              <div className="flex gap-2">
                <Input
                  id="customer-payment-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={balance}
                  step="0.01"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAmount(balance.toFixed(2))}
                  disabled={balance <= 0}
                >
                  Full balance
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-payment-method">Paid with</Label>
              <select
                id="customer-payment-method"
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
              <Label htmlFor="customer-payment-note">Note</Label>
              <Textarea
                id="customer-payment-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending || balance <= 0}>
              Save payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
