"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import type { ReceiptPayload } from "@/features/receipts/types";
import { ReceiptDocument } from "@/features/receipts/components/receipt-document";
import { normalizeReceiptPayload, printReceipt } from "@/services/printing";
import { saveReceiptPdfOnDevice, shareReceiptOnDevice } from "@/services/receipts/share";
import {
  filesystemSaveFailedMessage,
  bluetoothPrintFailedMessage,
  printFailedMessage,
  shareFailedMessage,
} from "@novend/hardware";
import { useNativeShell } from "@/hooks/use-native-shell";
import { toast } from "sonner";
import { Check, FileDown, Printer, Settings2, Share2 } from "lucide-react";
import type { ReceiptPrintMode } from "@/lib/receipt-print-mode";
import { useRouter } from "next/navigation";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: ReceiptPayload | null;
  printMode?: ReceiptPrintMode;
  /** Optional message when automatic print already failed before opening the sheet. */
  printFailureMessage?: string | null;
};

function modeCopy(mode: ReceiptPrintMode, failure?: string | null): string {
  if (failure) return failure;
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
export function SaleCompletedDialog({
  open,
  onOpenChange,
  payload,
  printMode = "manual",
  printFailureMessage = null,
}: Props) {
  const normalized = payload ? normalizeReceiptPayload(payload) : null;
  const native = useNativeShell();
  const router = useRouter();
  const [busy, setBusy] = useState<"share" | "pdf" | "print" | null>(null);
  const autoPrintedInvoice = useRef<string | null>(null);
  const showPrint = printMode !== "never";

  async function onPrint() {
    if (!normalized) return;
    setBusy("print");
    try {
      const result = await printReceipt(normalized);
      if (!result.printed) {
        toast.error(
          result.failureMessage ||
            bluetoothPrintFailedMessage(result.failureCode, printFailedMessage()),
        );
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
    if (printFailureMessage) return;
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

  const body = normalized ? (
    <div className="space-y-3">
      <p className="text-muted-foreground text-sm">
        Invoice {normalized.invoiceNumber} · {normalized.itemCount} item
        {normalized.itemCount === 1 ? "" : "s"}
      </p>
      <p className="text-muted-foreground text-sm">{modeCopy(printMode, printFailureMessage)}</p>
      <div className="bg-muted/40 flex min-w-0 justify-center overflow-x-hidden rounded-xl p-3 sm:p-4">
        <ReceiptDocument preview payload={normalized} className="max-w-full shrink" />
      </div>
    </div>
  ) : (
    <p className="text-muted-foreground text-sm">No receipt available.</p>
  );

  const actions = (
    <div className="flex w-full flex-col gap-2">
      {showPrint ? (
        <Button
          type="button"
          className="w-full"
          variant={printMode === "automatic" ? "default" : "outline"}
          disabled={!normalized || busy !== null}
          onClick={() => void onPrint()}
        >
          <Printer className="h-4 w-4" />
          {busy === "print" ? "Printing…" : "Print receipt"}
        </Button>
      ) : null}
      {printFailureMessage || printMode === "automatic" ? (
        <Button
          type="button"
          className="w-full"
          variant="outline"
          disabled={busy !== null}
          onClick={() => {
            onOpenChange(false);
            router.push("/settings?section=mobileHardware");
          }}
        >
          <Settings2 className="h-4 w-4" />
          Open Hardware settings
        </Button>
      ) : null}
      <Button
        type="button"
        className="w-full"
        variant="secondary"
        disabled={!normalized || busy !== null}
        onClick={() => void onShare()}
      >
        <Share2 className="h-4 w-4" />
        {busy === "share" ? "Sharing…" : "Share receipt"}
      </Button>
      <Button
        type="button"
        className="w-full"
        variant="outline"
        disabled={!normalized || busy !== null}
        onClick={() => void onSavePdf()}
      >
        <FileDown className="h-4 w-4" />
        {busy === "pdf" ? "Saving…" : "Save PDF"}
      </Button>
      <Button
        type="button"
        className="w-full"
        variant="default"
        disabled={busy !== null}
        onClick={() => onOpenChange(false)}
      >
        <Check className="h-4 w-4" />
        Done
      </Button>
    </div>
  );

  if (native) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[92dvh] rounded-t-[22px] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
          <DrawerHeader className="border-border shrink-0 border-b px-4 text-left">
            <DrawerTitle>Sale completed</DrawerTitle>
          </DrawerHeader>
          <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4">
            {body}
          </div>
          <div className="border-border shrink-0 border-t px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
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
          <DialogTitle>Sale completed</DialogTitle>
        </DialogHeader>
        {body}
        <DialogFooter className="flex-col gap-2 sm:flex-col">{actions}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
