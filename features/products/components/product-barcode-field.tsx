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
  /** Defaults to “Barcode”. Pass empty string to hide the label. */
  label?: string;
  id?: string;
  /** Tighter label + spacing for nested editors (e.g. sell units). */
  dense?: boolean;
};

/**
 * Optional barcode assignment. HID listens when configured;
 * otherwise opens the camera scanner.
 */
export function ProductBarcodeField({
  value,
  onChange,
  label = "Barcode",
  id = "barcode",
  dense = false,
}: Props) {
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
    <div className={dense ? "min-w-0 space-y-1.5" : "min-w-0 space-y-2"}>
      {label ? (
        <Label htmlFor={id} className={dense ? "text-xs" : undefined}>
          {label}
        </Label>
      ) : null}
      <div className="flex min-w-0 gap-2">
        <Input
          id={id}
          className="min-h-11 min-w-0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Optional"
          autoComplete="off"
        />
        {hidActive ? (
          <Button
            type="button"
            variant={listening ? "default" : "outline"}
            className="min-h-11 shrink-0"
            onClick={() => setListening((v) => !v)}
            aria-label={listening ? "Stop listening" : "Scan barcode"}
          >
            <ScanBarcode className="h-4 w-4" />
          </Button>
        ) : null}
        {showCamera ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11 shrink-0"
            onClick={() => setCameraOpen(true)}
            aria-label="Scan barcode with camera"
          >
            <ScanBarcode className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {listening && hidActive ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          Listening for USB scanner…
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
