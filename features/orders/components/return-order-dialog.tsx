"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/currency";
import { estimateReturnRefund } from "@/lib/sales/returns";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { RETURN_REASON_OPTIONS } from "../constants";
import { Minus, Plus } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReceiptPayload } from "@/features/receipts/types";
import { processReturnLocally } from "@/lib/offline/returns-repository";
import { useConnectivity } from "@/hooks/use-connectivity";

export type ReturnableOrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
  remainingQuantity: number;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saleId: string;
  invoiceNumber: string;
  saleTotal: number;
  saleSubtotal: number;
  saleDiscount: number;
  alreadyRefunded: number;
  items: ReturnableOrderItem[];
  onCompleted: (result: { returnNumber: string; receiptPayload: ReceiptPayload | null }) => void;
};

export function ReturnOrderDialog({
  open,
  onOpenChange,
  saleId,
  invoiceNumber,
  saleTotal,
  saleSubtotal,
  saleDiscount,
  alreadyRefunded,
  items,
  onCompleted,
}: Props) {
  const online = useConnectivity();
  const [qtyByItem, setQtyByItem] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<"full" | "partial">("partial");

  const returnable = items.filter((item) => item.remainingQuantity > 0);
  const remainingQty = returnable.reduce((sum, item) => sum + item.remainingQuantity, 0);
  const selected = returnable
    .map((item) => ({
      item,
      quantity: Math.min(qtyByItem[item.id] ?? 0, item.remainingQuantity),
    }))
    .filter((row) => row.quantity > 0);

  const refundEstimate = estimateReturnRefund({
    saleTotal,
    saleSubtotal,
    saleCartDiscount: saleDiscount,
    alreadyRefunded,
    remainingQty,
    lines: selected.map((row) => ({
      returningQty: row.quantity,
      soldQty: row.item.quantity,
      lineTotal: row.item.lineTotal,
      remainingQty: row.item.remainingQuantity,
    })),
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setQtyByItem({});
      setReason("");
      setNotes("");
      setMode("partial");
    }
    onOpenChange(next);
  }

  function applyMode(next: "full" | "partial") {
    setMode(next);
    if (next === "full") {
      selectAll();
    }
  }

  function setQty(id: string, next: number, max: number) {
    setQtyByItem((prev) => ({
      ...prev,
      [id]: Math.max(0, Math.min(max, next)),
    }));
  }

  function selectAll() {
    const next: Record<string, number> = {};
    for (const item of returnable) next[item.id] = item.remainingQuantity;
    setQtyByItem(next);
  }

  async function onConfirm() {
    if (selected.length === 0) {
      toast.error("Select at least one item to return.");
      return;
    }
    if (!reason) {
      toast.error("Choose a return reason.");
      return;
    }
    setPending(true);
    try {
      const result = await processReturnLocally({
        saleId,
        invoiceNumber,
        saleTotal,
        saleSubtotal,
        saleDiscount,
        alreadyRefunded,
        remainingQty,
        reason,
        notes: notes.trim() || undefined,
        items: selected.map((row) => ({
          saleItemId: row.item.id,
          productId: row.item.productId,
          productName: row.item.productName,
          soldQty: row.item.quantity,
          remainingQty: row.item.remainingQuantity,
          lineTotal: row.item.lineTotal,
          unitPrice: row.item.unitPrice,
          quantity: row.quantity,
        })),
      });
      toast.success(
        online
          ? `Return ${result.returnNumber} processed`
          : `Return ${result.returnNumber} saved on this device`,
      );
      onCompleted({
        returnNumber: result.returnNumber,
        receiptPayload: result.receiptPayload,
      });
      setQtyByItem({});
      setReason("");
      setNotes("");
      onOpenChange(false);
    } catch (error) {
      showError(error, "Could not process return");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return items</DialogTitle>
          <DialogDescription>
            {invoiceNumber}. Original sale stays on file. Stock and refunds reverse automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={mode} onValueChange={(value) => applyMode(value as "full" | "partial")}>
            <TabsList className="w-full">
              <TabsTrigger value="full" className="flex-1">
                Full return
              </TabsTrigger>
              <TabsTrigger value="partial" className="flex-1">
                Partial return
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === "full" ? (
            <p className="text-muted-foreground text-sm">
              Every remaining item on this order will be restocked and refunded.
            </p>
          ) : null}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Items</p>
            {mode === "partial" ? (
              <Button type="button" variant="ghost" size="sm" onClick={selectAll}>
                Return all
              </Button>
            ) : null}
          </div>
          <div className="space-y-2">
            {returnable.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing left to return on this order.</p>
            ) : (
              returnable.map((item) => {
                const qty = qtyByItem[item.id] ?? 0;
                return (
                  <div
                    key={item.id}
                    className="border-border flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{item.productName}</p>
                      <p className="text-muted-foreground text-xs">
                        {item.remainingQuantity} of {item.quantity} remaining ·{" "}
                        {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Decrease ${item.productName}`}
                        disabled={mode === "full" || qty <= 0}
                        onClick={() => setQty(item.id, qty - 1, item.remainingQuantity)}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="w-8 text-center text-sm font-semibold">{qty}</span>
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        aria-label={`Increase ${item.productName}`}
                        disabled={mode === "full" || qty >= item.remainingQuantity}
                        onClick={() => setQty(item.id, qty + 1, item.remainingQuantity)}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="return-reason">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="return-reason">
                <SelectValue placeholder="Select a reason" />
              </SelectTrigger>
              <SelectContent>
                {RETURN_REASON_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="return-notes">Notes (optional)</Label>
            <Textarea
              id="return-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="bg-muted/40 space-y-1 rounded-lg px-3 py-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Items</span>
              <span>{selected.reduce((sum, row) => sum + row.quantity, 0)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Refund</span>
              <span className="text-primary">{formatCurrency(refundEstimate)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => handleOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={pending || selected.length === 0}
            onClick={() => void onConfirm()}
          >
            {pending ? "Processing…" : "Confirm return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
