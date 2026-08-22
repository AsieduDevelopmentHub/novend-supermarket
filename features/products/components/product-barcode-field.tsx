"use client";

import { useState } from "react";
import { ScanBarcode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScanBarcodeCameraDialog } from "@/components/hardware/scan-barcode-camera-dialog";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import {
  BARCODE_HID_CAPTURE_MS,
  isHardwareBarcodeScannerActive,
  shouldShowCameraBarcodeButton,
} from "@/services/hardware";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Optional barcode assignment. HID listens in the background when configured;
 * otherwise opens the camera scanner via the barcode icon.
 */
export function ProductBarcodeField({ value, onChange }: Props) {
  const [listening, setListening] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const hidActive = isHardwareBarcodeScannerActive();
  const showCamera = shouldShowCameraBarcodeButton();

  useBarcodeScanner(
    (code) => {
      onChange(code);
      setListening(false);
      toast.success("Barcode captured");
    },
    {
      enabled: listening && hidActive,
      allowInInputs: true,
      timeoutMs: BARCODE_HID_CAPTURE_MS,
      onTimeout: () => {
        setListening(false);
        toast.message("Scanner listening timed out");
      },
    },
  );

  function onCameraDetect(code: string) {
    onChange(code);
    toast.success("Barcode captured");
  }

  return (
    <div className="border-border space-y-3 rounded-lg border p-3">
      <div className="space-y-2">
        <Label htmlFor="barcode">Barcode (optional)</Label>
        <Input
          id="barcode"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="8901234567890"
          autoComplete="off"
        />
        <p className="text-muted-foreground text-xs">
          Unique per organization. Leave blank if this product has no barcode.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {hidActive ? (
          <Button
            type="button"
            variant={listening ? "default" : "outline"}
            size="sm"
            onClick={() => setListening((v) => !v)}
          >
            <ScanBarcode className="mr-2 h-4 w-4" />
            {listening ? "Listening…" : "Scan barcode"}
          </Button>
        ) : null}
        {showCamera ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setCameraOpen(true)}>
            <ScanBarcode className="mr-2 h-4 w-4" />
            Scan barcode
          </Button>
        ) : null}
      </div>
      {listening && hidActive ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          Point the USB scanner at a barcode. Listening stops after the first scan or 18 seconds.
        </p>
      ) : null}
      <ScanBarcodeCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetect={onCameraDetect}
      />
    </div>
  );
}
