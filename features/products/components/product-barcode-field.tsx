"use client";

import { useState } from "react";
import { Camera, ScanBarcode } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ScanBarcodeCameraDialog } from "@/components/hardware/scan-barcode-camera-dialog";
import { useBarcodeScanner } from "@/hooks/use-barcode-scanner";
import { BARCODE_HID_CAPTURE_MS } from "@/services/hardware";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Optional barcode assignment. HID listening is one-shot after "Scan barcode".
 */
export function ProductBarcodeField({ value, onChange }: Props) {
  const [listening, setListening] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useBarcodeScanner(
    (code) => {
      onChange(code);
      setListening(false);
      toast.success("Barcode captured");
    },
    {
      enabled: listening,
      allowInInputs: true,
      timeoutMs: BARCODE_HID_CAPTURE_MS,
      onTimeout: () => {
        setListening(false);
        toast.message("Scanner listening timed out");
      },
    },
  );

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
        <Button
          type="button"
          variant={listening ? "default" : "outline"}
          size="sm"
          onClick={() => setListening((v) => !v)}
        >
          <ScanBarcode className="mr-2 h-4 w-4" />
          {listening ? "Listening…" : "Scan barcode"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setCameraOpen(true)}>
          <Camera className="mr-2 h-4 w-4" />
          Use camera
        </Button>
      </div>
      {listening ? (
        <p className="text-muted-foreground text-xs" aria-live="polite">
          Point the USB scanner at a barcode. Listening stops after the first scan or 18 seconds.
        </p>
      ) : null}
      <ScanBarcodeCameraDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetect={(code) => {
          onChange(code);
          toast.success("Barcode captured");
        }}
      />
    </div>
  );
}
