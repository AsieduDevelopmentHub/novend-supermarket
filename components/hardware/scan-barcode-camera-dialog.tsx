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
  canUseLiveCamera,
  decodeBarcodeFromImage,
  isCameraBarcodeSupported,
  listVideoInputDevices,
  playScanSuccessBeep,
  scannerInitErrorMessage,
  startCameraBarcodeScanning,
  type CameraScannerSession,
} from "@/services/hardware";
import { Hardware, isCapacitor, permissionNeedMessage } from "@novend/hardware";
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
  const scanAbortRef = useRef<AbortController | null>(null);
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
    scanAbortRef.current?.abort();
    scanAbortRef.current = null;
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

  const captureNativeBarcode = useCallback(
    async (gen: number) => {
      try {
        const photo = await Hardware.camera.capturePhoto();
        if (gen !== startGenRef.current) return;
        if (!photo.ok || !photo.data?.file) {
          if (photo.ok === false && /cancel/i.test(photo.message ?? "")) {
            onOpenChange(false);
            return;
          }
          setError(photo.message ?? "Could not open camera");
          return;
        }
        const code = await decodeBarcodeFromImage(photo.data.file);
        if (gen !== startGenRef.current) return;
        if (!code) {
          setError("No barcode found in that photo. Try again closer and in better light.");
          return;
        }
        setSuccessCode(code);
        playScanSuccessBeep();
        onDetect(code);
        onOpenChange(false);
      } catch (err) {
        if (gen !== startGenRef.current) return;
        const message = err instanceof Error ? err.message : "";
        if (/cancel/i.test(message)) {
          onOpenChange(false);
          return;
        }
        setError(cameraErrorMessage(err));
      } finally {
        if (gen === startGenRef.current) setStarting(false);
      }
    },
    [onDetect, onOpenChange],
  );

  const startWebScanner = useCallback(
    async (deviceId?: string) => {
      const gen = ++startGenRef.current;
      setStarting(true);
      setError(null);
      setReady(false);
      setDetectBox(null);
      setSuccessCode(null);
      stopScanner();
      const abortController = new AbortController();
      scanAbortRef.current = abortController;

      if (!canUseLiveCamera()) {
        setError(
          isCapacitor()
            ? "Live scan needs a secure connection. Photograph the barcode, or open Novend over HTTPS."
            : permissionNeedMessage("camera"),
        );
        setStarting(false);
        return;
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
        // getUserMedia owns the WebView permission prompt. A separate native
        // check/request can return a stale denial after Android resumes.
        const scanner = await startCameraBarcodeScanning({
          video,
          deviceId: deviceId || undefined,
          signal: abortController.signal,
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
            }, native ? 80 : 200);
          },
        });
        if (gen !== startGenRef.current) {
          scanner.stop();
          return;
        }
        scanAbortRef.current = null;
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

  const startWebScannerRef = useRef(startWebScanner);
  startWebScannerRef.current = startWebScanner;

  useEffect(() => {
    if (!open) return;
    if (!canUseLiveCamera()) return;
    const timer = window.setTimeout(() => {
      void startWebScannerRef.current();
    }, 50);
    return () => {
      window.clearTimeout(timer);
      startGenRef.current += 1;
      stopScanner();
    };
  }, [open, session]);

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
          {error || !canUseLiveCamera() ? (
            <div className="bg-muted absolute inset-0 grid place-items-center gap-3 p-4 text-center">
              <p className="text-muted-foreground text-sm">
                {error ??
                  "Live scan needs a secure connection. Photograph the barcode, or open Novend over HTTPS."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {supported && canUseLiveCamera() ? (
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
                {native && !canUseLiveCamera() ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const gen = ++startGenRef.current;
                      setStarting(true);
                      setError(null);
                      void captureNativeBarcode(gen);
                    }}
                    disabled={starting}
                  >
                    {starting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ScanBarcode className="mr-2 h-4 w-4" />
                    )}
                    Photograph barcode
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {starting && !ready ? (
            <div className="bg-muted/80 absolute inset-0 grid place-items-center gap-2 p-4 text-center">
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
          {canUseLiveCamera()
            ? "Point the camera at a barcode. Scanning stops when a code is detected."
            : "This connection cannot preview the camera. Photograph the barcode instead."}
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
