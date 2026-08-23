"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScanBarcodeCameraDialog } from "@/components/hardware/scan-barcode-camera-dialog";
import { BluetoothPrinterCard } from "@/features/settings/components/bluetooth-printer-card";
import { permissionNeedMessage } from "@novend/hardware";
import { Camera, Info, ScanBarcode, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

/**
 * Mobile hardware settings — camera barcode, photo capture, BT print, receipt sharing.
 */
export function MobileHardwarePanel() {
  const [scanOpen, setScanOpen] = useState(false);

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Mobile hardware</AlertTitle>
        <AlertDescription>
          Novend uses this device’s camera for barcodes and product photos, Bluetooth for thermal
          receipts, and the system share sheet after a sale.
        </AlertDescription>
      </Alert>

      <BluetoothPrinterCard />

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
            Take a photo or choose from the gallery when adding product images. Photos are stored
            on this device and sync when you are online.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Use Take Photo or Choose Gallery on the product form. Camera and photo access are
            requested only when you tap those actions.
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
            After checkout, share the receipt via WhatsApp, email, Messages, or Nearby Share, or
            save a PDF in your Documents folder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Complete a sale to open Share receipt, Save PDF, and Done.
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
