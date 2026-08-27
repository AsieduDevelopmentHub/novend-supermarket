"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScanBarcodeCameraDialog } from "@/components/hardware/scan-barcode-camera-dialog";
import { BluetoothPrinterCard } from "@/features/settings/components/bluetooth-printer-card";
import { ReceiptPrintModePicker } from "@/features/settings/components/receipt-print-mode-picker";
import { permissionNeedMessage } from "@novend/hardware";
import { Camera, Info, Printer, ScanBarcode, Share2 } from "lucide-react";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import { showError } from "@/lib/errors";
import { usePermissions } from "@/hooks/use-permissions";
import { usePosPreferences } from "@/hooks/use-pos-preferences";
import { savePosPreferences } from "@/lib/offline/pos-preferences";
import { resolveReceiptPrintMode } from "@/lib/receipt-print-mode";

const PRINT_MODE_LABEL = {
  automatic: "Automatic print",
  manual: "Manual print",
  never: "Do not print",
} as const;

/**
 * Mobile hardware settings — camera barcode, photo capture, BT print, receipt sharing.
 */
export function MobileHardwarePanel() {
  const [scanOpen, setScanOpen] = useState(false);
  const { isAdmin, isManager } = usePermissions();
  const posPrefs = usePosPreferences();
  const printMode = resolveReceiptPrintMode(posPrefs);
  const updatePos = useMutation(api.settings.updatePosPreferences);
  const canEditPrintMode = isAdmin || isManager;

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Mobile hardware</AlertTitle>
        <AlertDescription>
          Pair a Bluetooth printer for receipts. After a sale, Print (one copy) is the main action.
          Sharing and PDF are optional.
        </AlertDescription>
      </Alert>

      <BluetoothPrinterCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Printer className="h-4 w-4" />
            Receipt printing
          </CardTitle>
          <CardDescription>
            Uses the same Automatic / Manual / Do not print setting as the rest of the business.
            Phones print one copy — they do not add extra copies.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {canEditPrintMode ? (
            <ReceiptPrintModePicker
              value={printMode}
              showIntro={false}
              onChange={(mode) => {
                void updatePos({ receiptPrintMode: mode })
                  .then(() =>
                    savePosPreferences({
                      autoPrintReceipt: mode === "automatic",
                      receiptPrintMode: mode,
                    }),
                  )
                  .catch((error) => showError(error, "Could not save print setting"));
              }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              This business is set to {PRINT_MODE_LABEL[printMode]}. Ask a manager to change it
              under Settings → Receipt.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ScanBarcode className="h-4 w-4" />
            Camera barcode scanner
          </CardTitle>
          <CardDescription>
            Open a full-screen scanner from Products or Sales. Codes fill fields or add cart lines
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-muted-foreground text-sm">{permissionNeedMessage("camera")}</p>
          <Button type="button" variant="outline" onClick={() => setScanOpen(true)}>
            <ScanBarcode className="mr-2 h-4 w-4" />
            Test scanner
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Photo capture
          </CardTitle>
          <CardDescription>
            Take a photo or upload an image when adding products. Photos are stored on this device
            and sync when you are online.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Use Take Photo or Upload Image on the product form. Camera access is requested only when
            you take a photo.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Share2 className="h-4 w-4" />
            Receipt sharing
          </CardTitle>
          <CardDescription>
            Optional. After checkout you can still share via WhatsApp, email, or Messages, or save a
            PDF — Print remains the default action.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Complete a sale to print one copy. Share and Save PDF stay on the confirmation sheet.
          </p>
        </CardContent>
      </Card>

      <ScanBarcodeCameraDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetect={(code) => {
          toast.success(`Scanned ${code}`);
        }}
      />
    </div>
  );
}
