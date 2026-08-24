"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  cameraErrorMessage,
  isCameraBarcodeSupported,
  listVideoInputDevices,
  playScanSuccessBeep,
  scannerInitErrorMessage,
  startCameraBarcodeScanning,
  type CameraScannerSession,
} from "@/services/hardware";
import {
  Hardware,
  isCapacitor,
  permissionNeedMessage,
} from "@novend/hardware";
import { Loader2, ScanBarcode } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetect: (code: string) => void;
};

/**
 * Camera barcode reader.
 * Capacitor: Cap camera permission → getUserMedia → bundled ZXing (no ML Kit / Google HTTPS).
 * Web / Electron: getUserMedia + BarcodeDetector / ZXing.
 * Hardware HID scanners remain separate via useBarcodeScanner.
 */
export function ScanBarcodeCameraDialog({ open, onOpenChange, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<CameraScannerSession | null>(null);
  const startGenRef = useRef(0);
  const [session, setSession] = useState(0);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [detectBox, setDetectBox] = useState<DOMRectReadOnly | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const native = isCapacitor();
  const supported = native || isCameraBarcodeSupported();

  function stopScanner() {
    try {
      scannerRef.current?.stop();
    } catch {
      /* always allow dialog to close */
    }
    scannerRef.current = null;
  }

  useEffect(() => {
    if (!open) stopScanner();
  }, [open]);

  useEffect(() => {
    return () => {
      startGenRef.current += 1;
      stopScanner();
    };
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) {
      startGenRef.current += 1;
      stopScanner();
      setReady(false);
      setStarting(false);
      setError(null);
      setDetectBox(null);
      setSuccessCode(null);
      setDevices([]);
      setSelectedDeviceId("");
    } else {
      setSession((n) => n + 1);
      setReady(false);
      setStarting(false);
      setError(null);
      setDetectBox(null);
      setSuccessCode(null);
    }
    onOpenChange(next);
  }

  const startWebScanner = useCallback(
    async (deviceId?: string) => {
      const gen = ++startGenRef.current;
      setStarting(true);
      setError(null);
      setReady(false);
      setDetectBox(null);
      setSuccessCode(null);
      stopScanner();

      if (native) {
        const permission = await Hardware.camera.ensurePermission("camera");
        if (gen !== startGenRef.current) return;
        if (!permission.ok) {
          setError(permission.message || permissionNeedMessage("camera"));
          setStarting(false);
          return;
        }
      }

      if (!isCameraBarcodeSupported()) {
        setError(permissionNeedMessage("camera"));
        setStarting(false);
        return;
      }

      // Wait for the video element after dialog mount / key remount.
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      if (gen !== startGenRef.current) return;

      const video = videoRef.current;
      if (!video) {
        setError("Unable to start the camera. Please try again.");
        setStarting(false);
        return;
      }

      try {
        const scanner = await startCameraBarcodeScanning({
          video,
          deviceId: deviceId || undefined,
          onDetect: (code, box) => {
            if (gen !== startGenRef.current) return;
            setDetectBox(box ?? null);
            setSuccessCode(code);
            playScanSuccessBeep();
            window.setTimeout(() => {
              if (gen !== startGenRef.current) return;
              onDetect(code);
              stopScanner();
              onOpenChange(false);
            }, 350);
          },
        });
        if (gen !== startGenRef.current) {
          scanner.stop();
          return;
        }
        scannerRef.current = scanner;

        const inputs = await listVideoInputDevices();
        if (gen !== startGenRef.current) return;
        setDevices(inputs);
        const activeId = scanner.deviceId || deviceId || "";
        if (activeId) setSelectedDeviceId(activeId);

        setReady(true);
      } catch (err) {
        if (gen !== startGenRef.current) return;
        stopScanner();
        const message = cameraErrorMessage(err);
        setError(message.includes("Allow camera") ? message : scannerInitErrorMessage(err));
      } finally {
        if (gen === startGenRef.current) setStarting(false);
      }
    },
    [native, onDetect, onOpenChange],
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void startWebScanner();
    }, 50);
    return () => {
      window.clearTimeout(timer);
      startGenRef.current += 1;
      stopScanner();
    };
  }, [open, session, startWebScanner]);

  async function switchCamera(nextDeviceId: string) {
    if (!nextDeviceId || nextDeviceId === selectedDeviceId) return;
    setSelectedDeviceId(nextDeviceId);
    await startWebScanner(nextDeviceId);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" key={session}>
        <DialogHeader>
          <DialogTitle>Scan barcode</DialogTitle>
        </DialogHeader>

        {devices.length > 1 && ready ? (
          <div className="space-y-2">
            <Label htmlFor="camera-select">Camera</Label>
            <Select value={selectedDeviceId} onValueChange={(value) => void switchCamera(value)}>
              <SelectTrigger id="camera-select">
                <SelectValue placeholder="Select camera" />
              </SelectTrigger>
              <SelectContent>
                {devices.map((device) => (
                  <SelectItem key={device.deviceId || device.label} value={device.deviceId}>
                    {device.label || "Camera"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {error ? (
            <div className="absolute inset-0 grid place-items-center gap-3 bg-muted p-4 text-center">
              <p className="text-muted-foreground text-sm">{error}</p>
              {supported ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void startWebScanner(selectedDeviceId || undefined)}
                  disabled={starting}
                >
                  {starting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ScanBarcode className="mr-2 h-4 w-4" />
                  )}
                  Try again
                </Button>
              ) : null}
            </div>
          ) : null}
          {starting && !ready ? (
            <div className="absolute inset-0 grid place-items-center gap-2 bg-muted/80 p-4 text-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">Starting camera scanner…</p>
            </div>
          ) : null}
          {ready ? (
            <>
              <div
                className="pointer-events-none absolute inset-8 rounded-md border-2 border-teal-400/70"
                aria-hidden
              />
              {detectBox ? (
                <div
                  className="pointer-events-none absolute rounded-sm border-2 border-emerald-400 bg-emerald-400/20 transition-opacity"
                  style={{
                    left: detectBox.x,
                    top: detectBox.y,
                    width: detectBox.width,
                    height: detectBox.height,
                  }}
                  aria-hidden
                />
              ) : null}
              {successCode ? (
                <div className="absolute inset-x-0 bottom-3 flex justify-center">
                  <span className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white">
                    {successCode}
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
        </div>

        <p className="text-muted-foreground text-center text-xs">
          Point the camera at a barcode. Scanning stops when a code is detected.
        </p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
