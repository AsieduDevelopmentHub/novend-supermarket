"use client";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ReceiptDocument } from "@/features/receipts/components/receipt-document";
import type { ReceiptPayload } from "@/features/receipts/types";
import { printReceipt, normalizeReceiptPayload } from "@/services/printing";
import { toast } from "sonner";
import { Printer } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ReceiptPayload | null;
};

export function ReceiptPreviewDialog({ open, onOpenChange, payload }: Props) {
  const normalized = payload ? normalizeReceiptPayload(payload) : null;

  async function onPrint() {
    if (!normalized) return;
    const result = await printReceipt(normalized);
    if (!result.printed) {
      toast.error("Could not print the receipt. Check the print agent or browser permissions.");
      return;
    }
    if (result.reason === "native") {
      toast.success(
        result.copies && result.copies > 1
          ? `Receipt sent to printer (${result.copies} copies)`
          : "Receipt sent to printer",
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Receipt{normalized ? ` · ${normalized.invoiceNumber}` : ""}</DialogTitle>
        </DialogHeader>
        {normalized ? (
          <div className="bg-muted/40 flex justify-center rounded-xl p-4">
            <ReceiptDocument preview payload={normalized} />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No receipt to preview.</p>
        )}
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button type="button" disabled={!normalized} onClick={() => void onPrint()}>
            <Printer className="h-4 w-4" />
            Print receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
