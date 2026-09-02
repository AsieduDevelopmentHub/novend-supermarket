"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { ReceiptDocument } from "@/features/receipts/components/receipt-document";
import type { ReceiptPayload } from "@/features/receipts/types";
import { printReceipt, normalizeReceiptPayload } from "@/services/printing";
import { saveReceiptPdfOnDevice, shareReceiptOnDevice } from "@/services/receipts/share";
import { filesystemSaveFailedMessage, isCapacitor, shareFailedMessage } from "@novend/hardware";
import { useNativeShell } from "@/hooks/use-native-shell";
import { toast } from "sonner";
import { FileDown, Printer, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ReceiptPayload | null;
};

function ReceiptPreviewBody({
  normalized,
}: {
  normalized: ReturnType<typeof normalizeReceiptPayload> | null;
}) {
  if (!normalized) {
    return <p className="text-muted-foreground text-sm">No receipt to preview.</p>;
  }
  return (
    <div className="bg-muted/40 flex min-w-0 justify-center overflow-x-hidden rounded-xl p-3 sm:p-4">
      <ReceiptDocument preview payload={normalized} className="max-w-full shrink" />
    </div>
  );
}

function ReceiptActions({
  mobile,
  normalized,
  busy,
  stacked,
  onClose,
  onShare,
  onSavePdf,
  onPrint,
}: {
  mobile: boolean;
  normalized: ReturnType<typeof normalizeReceiptPayload> | null;
  busy: "print" | "share" | "pdf" | null;
  stacked: boolean;
  onClose: () => void;
  onShare: () => void;
  onSavePdf: () => void;
  onPrint: () => void;
}) {
  return (
    <div className={cn("flex gap-2", stacked ? "w-full flex-col" : "flex-wrap justify-end")}>
      {mobile ? (
        <>
          <Button
            type="button"
            variant="outline"
            className={stacked ? "w-full" : undefined}
            disabled={!normalized || busy !== null}
            onClick={onShare}
          >
            <Share2 className="h-4 w-4" />
            {busy === "share" ? "Sharing…" : "Share"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className={stacked ? "w-full" : undefined}
            disabled={!normalized || busy !== null}
            onClick={onSavePdf}
          >
            <FileDown className="h-4 w-4" />
            {busy === "pdf" ? "Saving…" : "Save PDF"}
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="default"
          disabled={!normalized || busy !== null}
          onClick={onPrint}
        >
          <Printer className="h-4 w-4" />
          {busy === "print" ? "Printing…" : "Print receipt"}
        </Button>
      )}
      <Button
        type="button"
        variant={stacked ? "default" : "outline"}
        className={stacked ? "w-full" : undefined}
        onClick={onClose}
      >
        Close
      </Button>
    </div>
  );
}

export function ReceiptPreviewDialog({ open, onOpenChange, payload }: Props) {
  const normalized = payload ? normalizeReceiptPayload(payload) : null;
  const mobile = isCapacitor();
  const native = useNativeShell();
  const [busy, setBusy] = useState<"print" | "share" | "pdf" | null>(null);
  const title = `Receipt${normalized ? ` · ${normalized.invoiceNumber}` : ""}`;

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
        toast.success(
          result.via === "download" ? "Receipt PDF saved to Downloads" : "Receipt shared",
        );
      } else if (result.message !== "Cancelled")
        toast.error(result.message || shareFailedMessage());
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
      toast.success(mobile ? "Receipt PDF saved to Downloads" : "Receipt PDF saved");
    } catch {
      toast.error(filesystemSaveFailedMessage());
    } finally {
      setBusy(null);
    }
  }

  const actions = (
    <ReceiptActions
      mobile={mobile}
      normalized={normalized}
      busy={busy}
      stacked={native}
      onClose={() => onOpenChange(false)}
      onShare={() => void onShare()}
      onSavePdf={() => void onSavePdf()}
      onPrint={() => void onPrint()}
    />
  );

  if (native) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[92dvh] rounded-t-[22px] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <DrawerHeader className="border-border shrink-0 border-b px-4 text-left">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
            <ReceiptPreviewBody normalized={normalized} />
          </div>
          <div className="border-border shrink-0 space-y-2 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
            {actions}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90dvh,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-md min-w-0 overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <ReceiptPreviewBody normalized={normalized} />
        <DialogFooter className="gap-2 sm:justify-end">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
