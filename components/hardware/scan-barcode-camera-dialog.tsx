"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  cameraErrorMessage,
  createBarcodeDetector,
  isCameraBarcodeSupported,
  openBarcodeCameraStream,
} from "@/services/hardware";
import { Camera, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetect: (code: string) => void;
};

/**
 * Camera barcode reader. Opens only after an explicit click.
 * Uses the Barcode Detection API (Chromium, Electron, Android Chrome, Safari 17+).
 */
export function ScanBarcodeCameraDialog({ open, onOpenChange, onDetect }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [session, setSession] = useState(0);
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supported = isCameraBarcodeSupported();

  function stopStream() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
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
    } else {
      setSession((n) => n + 1);
      setReady(false);
      setStarting(false);
      setError(null);
    }
    onOpenChange(next);
  }

  async function startCamera() {
    setStarting(true);
    setError(null);
    setReady(false);
    stopStream();

    if (!supported) {
      setError(
        "Camera barcode scanning is not supported in this browser. Use a USB scanner or type the barcode.",
      );
      setStarting(false);
      return;
    }

    try {
      const stream = await openBarcodeCameraStream();
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      setReady(true);
    } catch (err) {
      setError(cameraErrorMessage(err));
    } finally {
      setStarting(false);
    }
  }

  useEffect(() => {
    if (!open || !ready) return;
    const detector = createBarcodeDetector();
    if (!detector) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          const value = codes[0]?.rawValue?.trim();
          if (value) {
            cancelled = true;
            onDetect(value);
            handleOpenChange(false);
            return;
          }
        } catch {
          /* keep scanning */
        }
      }
      rafRef.current = requestAnimationFrame(() => {
        void tick();
      });
    };
    void tick();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // handleOpenChange is stable enough for this dialog session
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ready, onDetect, session]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg" key={session}>
        <DialogHeader>
          <DialogTitle>Scan with camera</DialogTitle>
        </DialogHeader>
        <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
          <video
            ref={videoRef}
            className={ready ? "h-full w-full object-cover" : "hidden"}
            playsInline
            muted
          />
          {ready ? (
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-0.5 -translate-y-1/2 bg-teal-400/80" />
          ) : (
            <div className="absolute inset-0 grid place-items-center gap-3 p-4 text-center">
              {error ? (
                <>
                  <p className="text-muted-foreground text-sm">{error}</p>
                  {supported ? (
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
                  ) : null}
                </>
              ) : (
                <>
                  <p className="text-muted-foreground text-sm">
                    Point the camera at a barcode. Detection stops automatically.
                  </p>
                  <Button type="button" onClick={() => void startCamera()} disabled={starting}>
                    {starting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="mr-2 h-4 w-4" />
                    )}
                    {starting ? "Opening camera…" : "Allow camera & start"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
