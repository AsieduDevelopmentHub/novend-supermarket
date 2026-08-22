"use client";

import { ScanBarcode } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanBarcodeCameraDialog } from "@/components/hardware/scan-barcode-camera-dialog";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import {
  isHardwareBarcodeScannerActive,
  shouldShowCameraBarcodeButton,
} from "@/services/hardware";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** Called when a scan completes (HID or camera), after `onChange`. */
  onScan?: (code: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** When false, HID listening is off (e.g. a product dialog is capturing). */
  listenHid?: boolean;
};

/**
 * Search field that accepts HID scans in the background and optional camera capture.
 */
export function BarcodeSearchField({
  value,
  onChange,
  onScan,
  placeholder = "Search or scan barcode…",
  className,
  id,
  listenHid = true,
}: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const showCamera = shouldShowCameraBarcodeButton();
  const hidActive = isHardwareBarcodeScannerActive();

  function applyScan(code: string) {
    onChange(code);
    onScan?.(code);
  }

  useBarcodeScanner(
    (code) => {
      applyScan(code);
    },
    {
      enabled: listenHid && hidActive,
      allowInInputs: true,
    },
  );

  return (
    <div className={className ?? "flex max-w-md gap-2"}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onScan && value.trim()) {
            e.preventDefault();
            onScan(value);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={showCamera ? undefined : "flex-1"}
      />
      {showCamera ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Scan barcode"
          onClick={() => setCameraOpen(true)}
        >
          <ScanBarcode className="h-4 w-4" />
        </Button>
      ) : null}
      <ScanBarcodeCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetect={(code) => applyScan(code)}
      />
    </div>
  );
}
