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
import { ReceiptDocument } from "@/features/receipts/components/receipt-document";
import type { ReceiptPayload } from "@/features/receipts/types";
import { printReceipt, normalizeReceiptPayload } from "@/services/printing";
import { saveReceiptPdfOnDevice, shareReceiptOnDevice } from "@/services/receipts/share";
import {
  filesystemSaveFailedMessage,
  isCapacitor,
  shareFailedMessage,
} from "@novend/hardware";
import { toast } from "sonner";
import { FileDown, Printer, Share2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ReceiptPayload | null;
};

export function ReceiptPreviewDialog({ open, onOpenChange, payload }: Props) {
  const normalized = payload ? normalizeReceiptPayload(payload) : null;
  const mobile = isCapacitor();
  const [busy, setBusy] = useState<"print" | "share" | "pdf" | null>(null);

  async function onPrint() {
    if (!normalized) return;
    setBusy("print");
    try {
      const result = await printReceipt(normalized);
      if (!result.printed) {
        toast.error(
          mobile
            ? "Could not save the receipt PDF. Try Share or Save PDF."
            : "Could not print the receipt. Check printer settings or try again.",
        );
        return;
      }
      if (result.reason === "download") {
        toast.success("Receipt PDF saved. Open it to print.");
      } else if (result.reason === "native" || result.reason === "system") {
        toast.success(
          result.copies && result.copies > 1
            ? `Receipt sent to printer (${result.copies} copies)`
            : result.reason === "system"
              ? "Print dialog opened"
              : "Receipt sent to printer",
        );
      }
    } finally {
      setBusy(null);
    }
  }

  async function onShare() {
    if (!normalized) return;
    setBusy("share");
    try {
      const result = await shareReceiptOnDevice(normalized);
      if (result.ok) {
        toast.success(result.via === "download" ? "Receipt PDF saved" : "Receipt shared");
      }
      else if (result.message !== "Cancelled") toast.error(result.message || shareFailedMessage());
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
      toast.success("Receipt PDF saved");
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
          <div className="flex flex-wrap justify-end gap-2">
            {mobile ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!normalized || busy !== null}
                  onClick={() => void onShare()}
                >
                  <Share2 className="h-4 w-4" />
                  {busy === "share" ? "Sharing…" : "Share"}
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
              </>
            ) : null}
            <Button
              type="button"
              variant={mobile ? "outline" : "default"}
              disabled={!normalized || busy !== null}
              onClick={() => void onPrint()}
            >
              <Printer className="h-4 w-4" />
              {busy === "print" ? "Printing…" : "Print receipt"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
