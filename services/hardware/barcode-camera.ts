/**
 * Camera barcode detection for Electron, web, and PWA.
 *
 * Native `BarcodeDetector` is used when Chromium exposes it. Electron often
 * lacks that API even with a working camera — we fall back to bundled ZXing.
 */

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

export type DetectedBarcode = {
  rawValue: string;
  boundingBox?: DOMRectReadOnly;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string; boundingBox?: DOMRectReadOnly }>>;
};

type BarcodeDetectorCtor = new (options: { formats: readonly string[] }) => BarcodeDetectorLike;

type ZxingReader = {
  decodeFromVideoDevice: (
    deviceId: string | undefined,
    video: HTMLVideoElement,
    callback: (
      result: { getText: () => string; getResultPoints?: () => Array<{ getX: () => number; getY: () => number }> } | undefined,
      error?: unknown,
    ) => void,
  ) => Promise<{ stop: () => void }>;
};

export type CameraScannerSession = {
  stop: () => void;
  /** Active device id once the stream is running (may be empty until labels unlock). */
  deviceId?: string;
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function isDesktopShell(): boolean {
  if (!isBrowser()) return false;
  return Boolean((window as Window & { novendDesktop?: unknown }).novendDesktop);
}

function hasGetUserMedia(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

/** Camera APIs are available in this runtime (independent of BarcodeDetector). */
export function isCameraBarcodeSupported(): boolean {
  if (!isBrowser() || !hasGetUserMedia()) return false;
  if (window.isSecureContext) return true;
  // Packaged Electron and localhost dev still expose media devices.
  if (isDesktopShell()) return true;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

function nativeDetectorCtor(): BarcodeDetectorCtor | undefined {
  if (!isBrowser()) return undefined;
  return (window as Window & { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
}

/** @deprecated Prefer `startCameraBarcodeScanning` — kept for provider listing. */
export function createBarcodeDetector(): BarcodeDetectorLike | null {
  const Ctor = nativeDetectorCtor();
  if (!Ctor) return null;
  try {
    return new Ctor({ formats: CAMERA_BARCODE_FORMATS });
  } catch {
    return null;
  }
}

let zxingReaderPromise: Promise<ZxingReader> | null = null;

async function loadZxingReader(): Promise<ZxingReader> {
  if (!zxingReaderPromise) {
    zxingReaderPromise = import("@zxing/browser").then(({ BrowserMultiFormatReader }) => {
      return new BrowserMultiFormatReader() as unknown as ZxingReader;
    });
  }
  return zxingReaderPromise;
}

function stopVideoStream(video: HTMLVideoElement) {
  const stream = video.srcObject;
  if (stream instanceof MediaStream) {
    for (const track of stream.getTracks()) track.stop();
  }
  video.srcObject = null;
}

function activeDeviceId(video: HTMLVideoElement): string | undefined {
  const stream = video.srcObject;
  if (!(stream instanceof MediaStream)) return undefined;
  return stream.getVideoTracks()[0]?.getSettings().deviceId;
}

function pointsToBoundingBox(
  points: Array<{ getX: () => number; getY: () => number }> | undefined,
  video: HTMLVideoElement,
): DOMRectReadOnly | undefined {
  if (!points?.length) return undefined;
  const xs = points.map((p) => p.getX());
  const ys = points.map((p) => p.getY());
  const videoWidth = video.videoWidth || video.clientWidth;
  const videoHeight = video.videoHeight || video.clientHeight;
  if (!videoWidth || !videoHeight) return undefined;

  const scaleX = video.clientWidth / videoWidth;
  const scaleY = video.clientHeight / videoHeight;
  const minX = Math.min(...xs) * scaleX;
  const minY = Math.min(...ys) * scaleY;
  const maxX = Math.max(...xs) * scaleX;
  const maxY = Math.max(...ys) * scaleY;

  return new DOMRectReadOnly(minX, minY, maxX - minX, maxY - minY);
}

export async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((device) => device.kind === "videoinput");
}

export async function openBarcodeCameraStream(deviceId?: string): Promise<MediaStream> {
  if (!hasGetUserMedia()) {
    throw new Error("Camera is not available in this browser");
  }

  const buildConstraints = (withDevice: boolean): MediaStreamConstraints => ({
    audio: false,
    video: withDevice && deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
  });

  try {
    return await navigator.mediaDevices.getUserMedia(buildConstraints(Boolean(deviceId)));
  } catch (firstError) {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: deviceId ? { deviceId: { exact: deviceId } } : true,
        audio: false,
      });
    } catch {
      throw firstError;
    }
  }
}

export function cameraErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  const message = err instanceof Error ? err.message : "";

  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Allow camera access to continue.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "Another application is using your camera.";
  }
  if (name === "SecurityError") {
    return "Camera is blocked by browser security policy for this page.";
  }
  if (/Permission denied|NotAllowedError/i.test(message)) {
    return "Allow camera access to continue.";
  }
  if (/not supported|not available/i.test(message)) {
    return "Camera barcode scanning is not supported on this device.";
  }
  return message || "Unable to start the camera. Please try again.";
}

export function scannerInitErrorMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (message) return `Unable to start the scanner. ${message}`;
  return "Unable to start the scanner. Please try again.";
}

/**
 * Continuous barcode scan loop — native API when present, otherwise ZXing.
 * Works offline once the app bundle is loaded (ZXing is bundled, not CDN).
 */
export async function startCameraBarcodeScanning(options: {
  video: HTMLVideoElement;
  deviceId?: string;
  onDetect: (code: string, box?: DOMRectReadOnly) => void;
}): Promise<CameraScannerSession> {
  const native = createBarcodeDetector();

  if (native) {
    const stream = await openBarcodeCameraStream(options.deviceId);
    options.video.srcObject = stream;
    await options.video.play();
    const deviceId = activeDeviceId(options.video);

    let cancelled = false;
    let raf = 0;
    let lastScan = 0;
    const intervalMs = 120;

    const tick = async () => {
      if (cancelled) return;
      const now = Date.now();
      if (now - lastScan >= intervalMs && options.video.readyState >= 2) {
        lastScan = now;
        try {
          const codes = await native.detect(options.video);
          const hit = codes.find((code) => code.rawValue?.trim());
          if (hit?.rawValue?.trim()) {
            cancelled = true;
            options.onDetect(hit.rawValue.trim(), hit.boundingBox);
            return;
          }
        } catch {
          /* keep scanning */
        }
      }
      raf = requestAnimationFrame(() => {
        void tick();
      });
    };

    void tick();
    return {
      deviceId,
      stop: () => {
        cancelled = true;
        if (raf) cancelAnimationFrame(raf);
        stopVideoStream(options.video);
      },
    };
  }

  const reader = await loadZxingReader();
  let active = true;
  let controls: { stop: () => void } | null = null;

  try {
    controls = await reader.decodeFromVideoDevice(options.deviceId, options.video, (result, error) => {
      if (!active) return;
      if (result) {
        const value = result.getText()?.trim();
        if (value) {
          active = false;
          controls?.stop();
          options.onDetect(value, pointsToBoundingBox(result.getResultPoints?.(), options.video));
        }
        return;
      }
      if (error && typeof error === "object" && "name" in error && error.name === "NotFoundException") {
        return;
      }
    });

    await options.video.play();

    return {
      deviceId: activeDeviceId(options.video),
      stop: () => {
        active = false;
        try {
          controls?.stop();
        } catch {
          /* ignore */
        }
        stopVideoStream(options.video);
      },
    };
  } catch (err) {
    active = false;
    try {
      controls?.stop();
    } catch {
      /* ignore */
    }
    stopVideoStream(options.video);
    throw err;
  }
}
