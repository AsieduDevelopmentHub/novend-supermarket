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
import { canvasToProductImageFile } from "@/lib/uploads/image";
import { showError } from "@/lib/errors";
import { Camera, Loader2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
};

/** Webcam capture for product images (Electron + PWA when camera permission is granted). */
export function TakeProductPhotoDialog({ open, onOpenChange, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setReady(false);
    setError(null);

    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera is not available in this browser");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not open camera");
        }
      }
    })();

    return () => {
      cancelled = true;
      const stream = streamRef.current;
      streamRef.current = null;
      if (stream) {
        for (const track of stream.getTracks()) track.stop();
      }
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [open]);

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
      onOpenChange(false);
    } catch (err) {
      showError(err, "Could not capture photo");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Take photo</DialogTitle>
        </DialogHeader>
        <div className="bg-muted relative aspect-video overflow-hidden rounded-lg">
          {error ? (
            <p className="text-muted-foreground absolute inset-0 grid place-items-center p-4 text-center text-sm">
              {error}
            </p>
          ) : (
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          )}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void onSnap()} disabled={!ready || pending || !!error}>
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
