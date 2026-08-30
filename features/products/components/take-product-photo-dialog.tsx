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
import {
  canvasToProductImageFile,
  cropCanvasToSquare,
  cropFileToSquare,
} from "@/lib/uploads/image";
import { canUseLiveCamera } from "@/services/hardware";
import { Hardware, isCapacitor } from "@novend/hardware";
import { showError } from "@/lib/errors";
import { Camera, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
};

function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  const message = err instanceof Error ? err.message : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera permission was denied. Allow camera access for this site, then try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Camera is in use by another app. Close it and try again.";
  }
  if (name === "SecurityError") {
    return "Camera is blocked by browser security policy for this page.";
  }
  if (/Permission denied|NotAllowedError/i.test(message)) {
    return "Camera permission was denied. Allow camera access for this site, then try again.";
  }
  return message || "Could not open camera";
}

async function openCameraStream(): Promise<MediaStream> {
  if (!canUseLiveCamera()) {
    throw new Error("Camera is not available in this browser");
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });
  } catch (firstError) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });
    } catch {
      throw firstError;
    }
  }
}

/**
 * In-app getUserMedia capture for product images (Capacitor, Electron, PWA).
 * Native still capture is a manual fallback only — never auto-launched on
 * open, or a finished shot retriggers the system camera.
 */
export function TakeProductPhotoDialog({ open, onOpenChange, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const onCaptureRef = useRef(onCapture);
  const closingRef = useRef(false);
  const [session, setSession] = useState(0);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const live = canUseLiveCamera();
  const nativeFallback = isCapacitor() && !live;

  onCaptureRef.current = onCapture;

  function stopStream() {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, []);

  function handleOpenChange(next: boolean) {
    if (!next) {
      closingRef.current = true;
      stopStream();
      setReady(false);
      setStarting(false);
      setError(null);
      setPending(false);
    } else {
      closingRef.current = false;
      setSession((n) => n + 1);
      setReady(false);
      setStarting(false);
      setError(null);
      setPending(false);
    }
    onOpenChange(next);
  }

  const startLiveCamera = useCallback(async () => {
    if (closingRef.current) return;
    setStarting(true);
    setError(null);
    setReady(false);
    stopStream();

    const video = videoRef.current;
    if (!video) {
      setError("Unable to start the camera. Please try again.");
      setStarting(false);
      return;
    }

    try {
      const stream = await openCameraStream();
      if (closingRef.current) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setReady(true);
    } catch (err) {
      stopStream();
      setError(cameraErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }, []);

  const captureNativeStill = useCallback(async () => {
    if (closingRef.current) return;
    setStarting(true);
    setError(null);
    try {
      const result = await Hardware.camera.capturePhoto();
      if (closingRef.current) return;
      if (!result.ok || !result.data?.file) {
        if (result.ok === false && /cancel/i.test(result.message ?? "")) return;
        setError(result.ok === false ? result.message : "Could not open camera");
        return;
      }
      const file = await cropFileToSquare(result.data.file);
      if (closingRef.current) return;
      onCaptureRef.current(file);
      handleOpenChange(false);
    } catch (err) {
      if (closingRef.current) return;
      const message = err instanceof Error ? err.message : "";
      if (/cancel/i.test(message)) return;
      setError(cameraErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      closingRef.current = false;
      return;
    }
    if (!live) return;
    const timer = window.setTimeout(() => {
      void startLiveCamera();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open, session, live, startLiveCamera]);

  async function onSnap() {
    const video = videoRef.current;
    if (!video || !ready || closingRef.current) return;
    setPending(true);
    try {
      const file = await canvasToProductImageFile(cropCanvasToSquare(video));
      onCaptureRef.current(file);
      handleOpenChange(false);
    } catch (err) {
      showError(err, "Could not capture photo");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" key={session}>
        <DialogHeader>
          <DialogTitle>Take photo</DialogTitle>
        </DialogHeader>
        <div className="bg-muted relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-lg">
          <video
            ref={videoRef}
            className={ready ? "h-full w-full object-cover" : "hidden"}
            playsInline
            muted
          />
          {error || nativeFallback ? (
            <div className="bg-muted absolute inset-0 grid place-items-center gap-3 p-4 text-center">
              <p className="text-muted-foreground text-sm">
                {error ??
                  "Live camera preview needs a secure connection. Use the device camera, or open Novend over HTTPS."}
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {live ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void startLiveCamera()}
                    disabled={starting}
                  >
                    {starting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-4 w-4" />
                    )}
                    Try again
                  </Button>
                ) : null}
                {nativeFallback ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void captureNativeStill()}
                    disabled={starting}
                  >
                    {starting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-4 w-4" />
                    )}
                    Device camera
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          {starting && !ready && live ? (
            <div className="bg-muted/80 absolute inset-0 grid place-items-center">
              <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onSnap()}
            disabled={!ready || pending || !!error}
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Camera className="mr-2 h-4 w-4" />
            )}
            Capture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
