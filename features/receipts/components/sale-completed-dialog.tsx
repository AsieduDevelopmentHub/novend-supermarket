"use client";

import { useEffect, useRef, useState } from "react";
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
import { normalizeReceiptPayload, printReceipt } from "@/services/printing";
import { saveReceiptPdfOnDevice, shareReceiptOnDevice } from "@/services/receipts/share";
import {
  filesystemSaveFailedMessage,
  printFailedMessage,
  shareFailedMessage,
} from "@novend/hardware";
import { toast } from "sonner";
import { Check, FileDown, Printer, Share2 } from "lucide-react";
import type { ReceiptPrintMode } from "@/lib/receipt-print-mode";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ReceiptPayload | null;
  printMode?: ReceiptPrintMode;
};

function modeCopy(mode: ReceiptPrintMode): string {
  if (mode === "automatic") {
    return "Printing one copy where a printer is available. You can still share or save a PDF.";
  }
  if (mode === "never") {
    return "This sale is complete. Share or save a PDF if the customer needs a copy.";
  }
  return "Print if you need a copy, or share / save a PDF.";
}

/**
 * Post-sale sheet for Capacitor. Print follows Settings → Receipt template
 * (`resolveReceiptPrintMode`): auto / manual / do not print.
 */
export function SaleCompletedDialog({ open, onOpenChange, payload, printMode = "manual" }: Props) {
  const normalized = payload ? normalizeReceiptPayload(payload) : null;
  const [busy, setBusy] = useState<"share" | "pdf" | "print" | null>(null);
  const autoPrintedInvoice = useRef<string | null>(null);
  const showPrint = printMode !== "never";

  async function onPrint() {
    if (!normalized) return;
    setBusy("print");
    try {
      const result = await printReceipt(normalized);
      if (!result.printed) {
        toast.error(printFailedMessage());
        return;
      }
      toast.success(
        result.reason === "native"
          ? "Receipt sent to printer"
          : result.reason === "download"
            ? "Receipt PDF saved to Downloads"
            : "Print dialog opened",
      );
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!open) {
      autoPrintedInvoice.current = null;
      return;
    }
    if (printMode !== "automatic" || !normalized) return;
    if (autoPrintedInvoice.current === normalized.invoiceNumber) return;
    autoPrintedInvoice.current = normalized.invoiceNumber;
    void onPrint();
    // Print once per opened invoice; onPrint reads the current normalized receipt.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- invoice identity, not callback identity
  }, [open, printMode, normalized?.invoiceNumber]);

  async function onShare() {
    if (!normalized) return;
    setBusy("share");
    try {
      const result = await shareReceiptOnDevice(normalized);
      if (result.ok) {
        toast.success(
          result.via === "download" ? "Receipt PDF saved to Downloads" : "Receipt shared",
        );
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
            <p className="text-muted-foreground text-sm">{modeCopy(printMode)}</p>
            <div className="bg-muted/40 flex justify-center rounded-xl p-4">
              <ReceiptDocument preview payload={normalized} />
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No receipt available.</p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {showPrint ? (
            <Button
              type="button"
              variant={printMode === "automatic" ? "default" : "outline"}
              disabled={!normalized || busy !== null}
              onClick={() => void onPrint()}
            >
              <Printer className="h-4 w-4" />
              {busy === "print" ? "Printing…" : "Print receipt"}
            </Button>
          ) : null}
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
          <Button
            type="button"
            variant="default"
            disabled={busy !== null}
            onClick={() => onOpenChange(false)}
          >
            <Check className="h-4 w-4" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
