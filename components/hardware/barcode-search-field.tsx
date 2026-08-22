"use client";

import { Camera } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanBarcodeCameraDialog } from "@/components/hardware/scan-barcode-camera-dialog";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { isBarcodeScanningEnabled } from "@/services/hardware";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  /** When false, HID listening is off (e.g. a product dialog is capturing). */
  listenHid?: boolean;
};

/**
 * Search field that also accepts HID scans and optional camera capture.
 * Parents decide what to do with the value (filter lists from Dexie).
 */
export function BarcodeSearchField({
  value,
  onChange,
  placeholder = "Search or scan barcode…",
  className,
  id,
  listenHid = true,
}: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);

  useBarcodeScanner(
    (code) => {
      onChange(code);
    },
    {
      enabled: listenHid && isBarcodeScanningEnabled(),
      allowInInputs: true,
    },
  );

  return (
    <div className={className ?? "flex max-w-md gap-2"}>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label="Scan barcode with camera"
        onClick={() => setCameraOpen(true)}
      >
        <Camera className="h-4 w-4" />
      </Button>
      <ScanBarcodeCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetect={(code) => onChange(code)}
      />
    </div>
  );
}
