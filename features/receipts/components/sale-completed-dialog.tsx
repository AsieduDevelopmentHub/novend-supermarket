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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ReceiptPayload | null;
};

/**
 * Post-sale sheet for Capacitor: share receipt, save PDF, or dismiss.
 */
export function SaleCompletedDialog({ open, onOpenChange, payload }: Props) {
  const normalized = payload ? normalizeReceiptPayload(payload) : null;
  const [busy, setBusy] = useState<"share" | "pdf" | "print" | null>(null);

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
            onClick={() => void onPrint()}
          >
            <Printer className="h-4 w-4" />
            {busy === "print" ? "Printing…" : "Print receipt"}
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
            variant="secondary"
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
