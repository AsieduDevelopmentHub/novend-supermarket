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
import { canvasToProductImageFile } from "@/lib/uploads/image";
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
  if (!navigator.mediaDevices?.getUserMedia) {
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
    // Desktop webcams often reject facingMode=environment — fall back to any camera.
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
 * Webcam capture for product images (Electron + PWA).
 * Opens after an explicit tap on Take photo; camera starts automatically.
 */
export function TakeProductPhotoDialog({ open, onOpenChange, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [session, setSession] = useState(0);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      stopStream();
      setReady(false);
      setStarting(false);
      setError(null);
      setPending(false);
    } else {
      setSession((n) => n + 1);
      setReady(false);
      setStarting(false);
      setError(null);
      setPending(false);
    }
    onOpenChange(next);
  }

  const startCamera = useCallback(async () => {
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

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void startCamera();
    }, 50);
    return () => window.clearTimeout(timer);
  }, [open, session, startCamera]);

  async function onSnap() {
    const video = videoRef.current;
    if (!video || !ready) return;
    setPending(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not capture frame");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const file = await canvasToProductImageFile(canvas);
      onCapture(file);
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
        <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
          <video
            ref={videoRef}
            className={ready ? "h-full w-full object-cover" : "hidden"}
            playsInline
            muted
          />
          {error ? (
            <div className="absolute inset-0 grid place-items-center gap-3 bg-muted p-4 text-center">
              <p className="text-muted-foreground text-sm">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void startCamera()}
                disabled={starting}
              >
                {starting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="mr-2 h-4 w-4" />
                )}
                Try again
              </Button>
              <p className="text-muted-foreground text-xs">
                If the prompt never appears, open site settings and set Camera to Allow, then retry.
              </p>
            </div>
          ) : null}
          {starting && !ready ? (
            <div className="absolute inset-0 grid place-items-center bg-muted/80">
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
