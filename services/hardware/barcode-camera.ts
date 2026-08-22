/** Camera barcode detection via the Barcode Detection API (Chromium / Electron / PWA). */

export const CAMERA_BARCODE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "codabar",
  "itf",
  "qr_code",
] as const;

type DetectedBarcode = { rawValue: string };

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<DetectedBarcode[]>;
};

type BarcodeDetectorCtor = new (options: { formats: readonly string[] }) => BarcodeDetectorLike;

function detectorCtor(): BarcodeDetectorCtor | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

export function isCameraBarcodeSupported(): boolean {
  return Boolean(detectorCtor());
}

export function createBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = detectorCtor();
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: CAMERA_BARCODE_FORMATS });
  } catch {
    return null;
  }
}

export async function openBarcodeCameraStream(): Promise<MediaStream> {
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
    try {
      return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch {
      throw firstError;
    }
  }
}

export function cameraErrorMessage(err: unknown): string {
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
