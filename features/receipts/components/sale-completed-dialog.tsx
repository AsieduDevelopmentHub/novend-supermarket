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
import { buildReceiptPdfBytes, buildReceiptShareText } from "@/services/receipts/share";
import {
  Hardware,
  filesystemSaveFailedMessage,
  isCapacitor,
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

/**
 * Post-sale sheet for Capacitor. Print (one copy) is the primary action unless
 * the business is set to "Do not print". Share and PDF are optional.
 */
export function SaleCompletedDialog({
  open,
  onOpenChange,
  payload,
  printMode = "manual",
}: Props) {
  const normalized = payload ? normalizeReceiptPayload(payload) : null;
  const [busy, setBusy] = useState<"share" | "pdf" | "print" | null>(null);
  const autoPrintedInvoice = useRef<string | null>(null);
  const prioritizePrint = printMode !== "never";

  async function onPrint() {
    if (!normalized) return;
    setBusy("print");
    try {
      const result = await printReceipt(normalized);
      if (!result.printed) {
        toast.error(
          isCapacitor()
            ? "Could not print. Pair a Bluetooth printer in Settings, or use Share / Save PDF."
            : "Could not print the receipt. Check printer settings or try again.",
        );
      } else
        toast.success(
          result.reason === "native" ? "Receipt sent to printer" : "Print dialog opened",
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
      const text = buildReceiptShareText(normalized);
      const result = await Hardware.share.shareReceipt(text, `Receipt ${normalized.invoiceNumber}`);
      if (result.ok) toast.success("Receipt shared");
      if (result.ok || result.message === "Cancelled") return;
      if (isCapacitor()) {
        try {
          const bytes = await buildReceiptPdfBytes(normalized);
          const saved = await Hardware.filesystem.savePDF(
            bytes,
            `receipt-${normalized.invoiceNumber}.pdf`,
          );
          const uri = saved.data?.pathOrName;
          if (saved.ok && uri) {
            const fileShare = await Hardware.share.shareImage(
              uri,
              `Receipt ${normalized.invoiceNumber}`,
            );
            if (fileShare.ok) {
              toast.success("Receipt shared");
              return;
            }
          }
        } catch {
          /* Fall through to the actionable error below. */
        }
      }
      toast.error(result.message || shareFailedMessage());
    } finally {
      setBusy(null);
    }
  }

  async function onSavePdf() {
    if (!normalized) return;
    setBusy("pdf");
    try {
      const bytes = await buildReceiptPdfBytes(normalized);
      const fileName = `receipt-${normalized.invoiceNumber}.pdf`;
      const result = await Hardware.filesystem.savePDF(bytes, fileName);
      if (!result.ok) {
        toast.error(result.message || filesystemSaveFailedMessage());
        return;
      }
      toast.success("Receipt PDF saved on this device");
    } catch {
      toast.error(filesystemSaveFailedMessage());
    } finally {
      setBusy(null);
    }
  }

  const printButton = (
    <Button
      type="button"
      variant={prioritizePrint ? "default" : "outline"}
      disabled={!normalized || busy !== null}
      onClick={() => void onPrint()}
    >
      <Printer className="h-4 w-4" />
      {busy === "print" ? "Printing…" : "Print receipt"}
    </Button>
  );

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
              {printMode === "automatic"
                ? "Printing one copy to the paired printer."
                : printMode === "never"
                  ? "This sale is complete. Print and share stay available if you need them."
                  : "Print one copy, or share if the customer needs a digital receipt."}
            </p>
            <div className="bg-muted/40 flex justify-center rounded-xl p-4">
              <ReceiptDocument preview payload={normalized} />
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No receipt available.</p>
        )}
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {prioritizePrint ? printButton : null}
          <Button
            type="button"
            variant={prioritizePrint ? "outline" : "secondary"}
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
          {!prioritizePrint ? printButton : null}
          <Button
            type="button"
            variant={prioritizePrint ? "secondary" : "default"}
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
