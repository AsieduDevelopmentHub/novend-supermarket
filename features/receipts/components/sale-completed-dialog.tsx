"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ReceiptPayload } from "@/features/receipts/types";
import { ReceiptDocument } from "@/features/receipts/components/receipt-document";
import { normalizeReceiptPayload } from "@/services/printing";
import { saveReceiptPdfOnDevice, shareReceiptOnDevice } from "@/services/receipts/share";
import { filesystemSaveFailedMessage, shareFailedMessage } from "@novend/hardware";
import { toast } from "sonner";
import { Check, FileDown, Share2 } from "lucide-react";
import type { ReceiptPrintMode } from "@/lib/receipt-print-mode";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ReceiptPayload | null;
  /** Kept for caller compatibility. Print is not offered on Capacitor. */
  printMode?: ReceiptPrintMode;
};

/**
 * Post-sale sheet for Capacitor. Print is omitted — Share and Save PDF write
 * to Downloads via the native JavascriptInterface.
 */
export function SaleCompletedDialog({ open, onOpenChange, payload }: Props) {
  const normalized = payload ? normalizeReceiptPayload(payload) : null;
  const [busy, setBusy] = useState<"share" | "pdf" | null>(null);

  async function onShare() {
    if (!normalized) return;
    setBusy("share");
    try {
      const result = await shareReceiptOnDevice(normalized);
      if (result.ok) {
        toast.success(result.via === "download" ? "Receipt PDF saved to Downloads" : "Receipt shared");
      } else if (result.message !== "Cancelled") {
        toast.error(result.message || shareFailedMessage());
      }
    } finally {
      setBusy(null);
    }
  }

  async function onSavePdf() {
    if (!normalized) return;
    setBusy("pdf");
    try {
      const result = await saveReceiptPdfOnDevice(normalized);
      if (!result.ok) {
        toast.error(result.message || filesystemSaveFailedMessage());
        return;
      }
      toast.success("Receipt PDF saved to Downloads");
    } catch {
      toast.error(filesystemSaveFailedMessage());
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sale completed</DialogTitle>
        </DialogHeader>
        {normalized ? (
          <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
              Invoice {normalized.invoiceNumber} · {normalized.itemCount} item
              {normalized.itemCount === 1 ? "" : "s"}
            </p>
            <p className="text-muted-foreground text-sm">
              This sale is complete. Share or save a PDF if the customer needs a copy.
            </p>
            <div className="bg-muted/40 flex justify-center rounded-xl p-4">
              <ReceiptDocument preview payload={normalized} />
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No receipt available.</p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="secondary"
            disabled={!normalized || busy !== null}
            onClick={() => void onShare()}
          >
            <Share2 className="h-4 w-4" />
            {busy === "share" ? "Sharing…" : "Share receipt"}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!normalized || busy !== null}
            onClick={() => void onSavePdf()}
          >
            <FileDown className="h-4 w-4" />
            {busy === "pdf" ? "Saving…" : "Save PDF"}
          </Button>
          <Button type="button" variant="default" disabled={busy !== null} onClick={() => onOpenChange(false)}>
            <Check className="h-4 w-4" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
