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
 * Camera barcode reader. On Capacitor, opens the native full-screen scanner.
 * On web / Electron, uses getUserMedia + BarcodeDetector / ZXing.
 */
export function ScanBarcodeCameraDialog({ open, onOpenChange, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<CameraScannerSession | null>(null);
  const [session, setSession] = useState(0);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [detectBox, setDetectBox] = useState<DOMRectReadOnly | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [useWebFallback, setUseWebFallback] = useState(false);
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
      stopScanner();
    };
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) {
      stopScanner();
      setReady(false);
      setStarting(false);
      setError(null);
      setDetectBox(null);
      setSuccessCode(null);
      setDevices([]);
      setSelectedDeviceId("");
      setUseWebFallback(false);
    } else {
      setSession((n) => n + 1);
      setReady(false);
      setStarting(false);
      setError(null);
      setDetectBox(null);
      setSuccessCode(null);
      setUseWebFallback(false);
    }
    onOpenChange(next);
  }

  const runNativeScan = useCallback(async () => {
    setStarting(true);
    setError(null);
    setSuccessCode(null);
    try {
      const result = await Hardware.barcode.scan();
      if (!result.ok) {
        if (result.message === "Cancelled") {
          onOpenChange(false);
          return "done" as const;
        }
        return "fallback" as const;
      }
      const code = result.data?.value?.trim();
      if (!code) return "fallback" as const;
      setSuccessCode(code);
      playScanSuccessBeep();
      onDetect(code);
      onOpenChange(false);
      return "done" as const;
    } catch {
      return "fallback" as const;
    } finally {
      setStarting(false);
    }
  }, [onDetect, onOpenChange]);

  const startWebScanner = useCallback(
    async (deviceId?: string) => {
      setUseWebFallback(true);
      setStarting(true);
      setError(null);
      setReady(false);
      setDetectBox(null);
      setSuccessCode(null);
      stopScanner();

      if (!isCameraBarcodeSupported()) {
        setError(permissionNeedMessage("camera"));
        setStarting(false);
        return;
      }

      // Wait one frame so the video element exists after switching from native UI.
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

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
            setDetectBox(box ?? null);
            setSuccessCode(code);
            playScanSuccessBeep();
            window.setTimeout(() => {
              onDetect(code);
              stopScanner();
              onOpenChange(false);
            }, 350);
          },
        });
        scannerRef.current = scanner;

        const inputs = await listVideoInputDevices();
        setDevices(inputs);
        const activeId = scanner.deviceId || deviceId || "";
        if (activeId) setSelectedDeviceId(activeId);

        setReady(true);
      } catch (err) {
        stopScanner();
        const message = cameraErrorMessage(err);
        setError(message.includes("Allow camera") ? message : scannerInitErrorMessage(err));
      } finally {
        setStarting(false);
      }
    },
    [onDetect, onOpenChange],
  );

  const startScanner = useCallback(
    async (deviceId?: string) => {
      if (native && !useWebFallback && !deviceId) {
        const outcome = await runNativeScan();
        if (outcome === "fallback") {
          await startWebScanner(deviceId);
        }
        return;
      }
      await startWebScanner(deviceId);
    },
    [native, runNativeScan, startWebScanner, useWebFallback],
  );

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void startScanner();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open, session, startScanner]);

  async function switchCamera(nextDeviceId: string) {
    if (!nextDeviceId || nextDeviceId === selectedDeviceId) return;
    setSelectedDeviceId(nextDeviceId);
    await startWebScanner(nextDeviceId);
  }

  const showNativeWaiting = native && !useWebFallback && starting && !error;

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
                  onClick={() => void startScanner(selectedDeviceId || undefined)}
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
          {showNativeWaiting || (starting && !ready) ? (
            <div className="absolute inset-0 grid place-items-center gap-2 bg-muted/80 p-4 text-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
              {showNativeWaiting ? (
                <p className="text-muted-foreground text-sm">Opening the camera scanner…</p>
              ) : null}
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
