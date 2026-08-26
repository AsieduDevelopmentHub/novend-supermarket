import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { HardwareAdapters, HardwareResult, PhotoCapture } from "../types";
import {
  barcodeScanFailedMessage,
  cameraCaptureFailedMessage,
  filesystemSaveFailedMessage,
  friendlyHardwareMessage,
  permissionDeniedMessage,
  shareFailedMessage,
} from "../permissions";
import {
  NATIVE_AVAILABILITY_TIMEOUT_MS,
  NATIVE_CAMERA_TIMEOUT_MS,
  isNativeTimeoutError,
  withTimeout,
} from "../timeout";
import { createWebAdapters } from "./web";
import {
  bluetoothTestPrint,
  createBluetoothPrinterControls,
  printViaBluetooth,
} from "./bluetooth-printer";

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fileFromBytes(bytes: Uint8Array, fileName: string, mimeType: string): File {
  const copy = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  const blob = new Blob([copy], { type: mimeType });
  try {
    return new File([blob], fileName, { type: mimeType, lastModified: Date.now() });
  } catch {
    // Older Android WebViews lack `File`; Blob with a name is enough for uploads.
    Object.defineProperty(blob, "name", { value: fileName, configurable: true });
    Object.defineProperty(blob, "lastModified", { value: Date.now(), configurable: true });
    return blob as File;
  }
}

async function persistProductImageFromBytes(
  bytes: Uint8Array,
  mimeType: string,
): Promise<string | undefined> {
  try {
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const path = `product-images/${Date.now()}.${ext}`;
    await Filesystem.writeFile({
      path,
      data: bytesToBase64(bytes),
      directory: Directory.Data,
      recursive: true,
    });
    const { uri: durableUri } = await Filesystem.getUri({
      path,
      directory: Directory.Data,
    });
    return durableUri;
  } catch {
    return undefined;
  }
}

async function ensureCameraPermission(source: CameraSource): Promise<HardwareResult> {
  // Android's system photo picker is scoped to the selected file and does
  // not require READ_MEDIA_IMAGES. Asking for that broad permission first can
  // leave the picker blocked even after the user grants access.
  if (source === CameraSource.Photos) return { ok: true };

  try {
    const permission = await withTimeout(Camera.checkPermissions(), NATIVE_AVAILABILITY_TIMEOUT_MS);
    const needsPrompt =
      source === CameraSource.Camera
        ? permission.camera !== "granted"
        : permission.photos !== "granted" && permission.camera !== "granted";

    if (!needsPrompt) return { ok: true };

    const requested = await withTimeout(
      Camera.requestPermissions({
        permissions: source === CameraSource.Camera ? ["camera"] : ["photos"],
      }),
      NATIVE_AVAILABILITY_TIMEOUT_MS,
    );
    const granted =
      source === CameraSource.Camera
        ? requested.camera === "granted"
        : requested.photos === "granted" || requested.camera === "granted";
    if (!granted) {
      return {
        ok: false,
        message:
          source === CameraSource.Camera
            ? permissionDeniedMessage("camera")
            : permissionDeniedMessage("photos"),
      };
    }
    return { ok: true };
  } catch (error) {
    if (isNativeTimeoutError(error)) {
      return {
        ok: false,
        message: "Camera permission timed out. Try again or enable it in device settings.",
      };
    }
    const raw = error instanceof Error ? error.message : String(error ?? "");
    return {
      ok: false,
      message: friendlyHardwareMessage(raw, permissionDeniedMessage("camera")),
    };
  }
}

async function getPhoto(source: CameraSource): Promise<HardwareResult<PhotoCapture>> {
  const permission = await ensureCameraPermission(source);
  if (!permission.ok) return permission;

  try {
    // Hosted WebView (Vercel) cannot fetch Cap file:// / content:// URIs via
    // convertFileSrc — Upload Image works because <input type=file> gives a
    // real File. Camera must return Base64 through the bridge.
    const photo = await Camera.getPhoto({
      quality: 55,
      allowEditing: false,
      resultType: CameraResultType.Base64,
      source,
      correctOrientation: true,
      saveToGallery: false,
    });

    const format = photo.format || "jpeg";
    const mimeType = format === "png" ? "image/png" : "image/jpeg";
    const encoded = photo.base64String?.trim();
    if (!encoded) {
      return { ok: false, message: cameraCaptureFailedMessage() };
    }

    const bytes = base64ToBytes(encoded);
    if (bytes.byteLength === 0) {
      return { ok: false, message: cameraCaptureFailedMessage() };
    }

    const fileName = `product-${Date.now()}.${format === "png" ? "png" : "jpg"}`;
    const file = fileFromBytes(bytes, fileName, mimeType);
    // Persist is best-effort; capture success must not depend on Filesystem.
    const localPath = await persistProductImageFromBytes(bytes, mimeType);

    return {
      ok: true,
      data: {
        uri: localPath || `data:${mimeType};base64,${encoded}`,
        mimeType,
        file,
        localPath,
      },
    };
  } catch (error) {
    if (isNativeTimeoutError(error)) {
      return {
        ok: false,
        message:
          source === CameraSource.Camera
            ? "Camera took too long to respond. Try again."
            : "Photo picker took too long to respond. Try again.",
      };
    }
    const raw = error instanceof Error ? error.message : String(error ?? "");
    if (/cancel/i.test(raw)) {
      return { ok: false, message: "Cancelled" };
    }
    return {
      ok: false,
      message: /permission|denied|not authorized|access/i.test(raw)
        ? permissionDeniedMessage(source === CameraSource.Photos ? "photos" : "camera")
        : friendlyHardwareMessage(raw, cameraCaptureFailedMessage()),
    };
  }
}

/**
 * Capacitor (Android / iOS) adapter — native camera, filesystem, share.
 * Camera barcode scanning uses in-app ZXing (see ScanBarcodeCameraDialog),
 * not Google ML Kit — ML Kit requires HTTPS module downloads and fails offline.
 * Printer remains Bluetooth (Phase 3).
 */
export function createCapacitorAdapters(): HardwareAdapters {
  const web = createWebAdapters();

  return {
    ...web,
    camera: {
      async ensurePermission(kind = "camera") {
        return ensureCameraPermission(
          kind === "photos" ? CameraSource.Photos : CameraSource.Camera,
        );
      },
      async capturePhoto() {
        return withTimeout(getPhoto(CameraSource.Camera), NATIVE_CAMERA_TIMEOUT_MS);
      },
      async pickFromGallery() {
        return withTimeout(getPhoto(CameraSource.Photos), NATIVE_CAMERA_TIMEOUT_MS);
      },
    },
    barcode: {
      /**
       * Capacitor camera scanning is owned by the in-app ZXing dialog.
       * Do not start Google ML Kit here — it races the WebView camera and
       * requires Google Play module downloads that fail offline.
       */
      async scan() {
        return {
          ok: false,
          message: barcodeScanFailedMessage(),
        };
      },
      async startListening() {
        return {
          ok: true,
          message: "Use Scan barcode for the in-app camera scanner",
        };
      },
      async stopListening() {
        return { ok: true };
      },
      async discover() {
        return {
          ok: true,
          message: "In-app camera barcode scanning (ZXing) is available on this device",
          data: {
            devices: [
              {
                id: "capacitor:camera-zxing",
                kind: "scanner",
                label: "Camera barcode scanner",
                meta: { mode: "camera_zxing" },
              },
            ],
          },
        };
      },
    },
    printer: {
      async printReceipt(request) {
        return printViaBluetooth({
          ...request,
          connectionType: "bluetooth",
        });
      },
      async discoverPrinters() {
        const controls = createBluetoothPrinterControls();
        const result = await controls.discover();
        if (!result.ok || !result.data) {
          return {
            ok: false,
            message: result.message || "Could not discover Bluetooth printers",
            data: { printers: [], suggested: null },
          };
        }
        return {
          ok: true,
          message: result.message,
          data: {
            printers: result.data.devices.map((d) => ({
              name: d.name,
              bluetoothDeviceId: d.id,
              isDefault: false,
            })),
            suggested: null,
          },
        };
      },
      async getDefaultPrinter() {
        const status = await createBluetoothPrinterControls().getStatus();
        if (!status.ok || !status.data?.deviceId) return { ok: true, data: null };
        return {
          ok: true,
          data: {
            connectionType: "bluetooth",
            bluetoothDeviceId: status.data.deviceId,
            paperWidthMm: status.data.paperWidthMm,
          },
        };
      },
      async testPrint(config) {
        const width = config.paperWidthMm === 58 ? 58 : 80;
        if (config.bluetoothDeviceId) {
          await createBluetoothPrinterControls().connect(
            config.bluetoothDeviceId,
            config.windowsPrinterName,
          );
        }
        return bluetoothTestPrint(width);
      },
    },
    filesystem: {
      async savePDF(bytes, fileName) {
        try {
          const safeName = fileName.replace(/[^\w.\-]+/g, "_");
          // Cache is covered by FileProvider paths and is shareable on Android.
          const path = `receipts/${safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`}`;
          await Filesystem.writeFile({
            path,
            data: bytesToBase64(bytes),
            directory: Directory.Cache,
            recursive: true,
          });
          const { uri } = await Filesystem.getUri({
            path,
            directory: Directory.Cache,
          });
          return { ok: true, data: { pathOrName: uri || path } };
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error ?? "");
          return {
            ok: false,
            message: friendlyHardwareMessage(raw, filesystemSaveFailedMessage()),
          };
        }
      },
      async saveImage(bytes, fileName) {
        try {
          const safeName = fileName.replace(/[^\w.\-]+/g, "_");
          const path = `documents/${safeName}`;
          await Filesystem.writeFile({
            path,
            data: bytesToBase64(bytes),
            directory: Directory.Documents,
            recursive: true,
          });
          const { uri } = await Filesystem.getUri({
            path,
            directory: Directory.Documents,
          });
          return { ok: true, data: { pathOrName: uri || path } };
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error ?? "");
          return {
            ok: false,
            message: friendlyHardwareMessage(raw, filesystemSaveFailedMessage()),
          };
        }
      },
      async readFile(path) {
        try {
          const result = await Filesystem.readFile({ path });
          const data = result.data;
          if (typeof data === "string") {
            const binary = atob(data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            return { ok: true, data: bytes };
          }
          if (data instanceof Blob) {
            return { ok: true, data: new Uint8Array(await data.arrayBuffer()) };
          }
          return { ok: false, message: filesystemSaveFailedMessage() };
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error ?? "");
          return {
            ok: false,
            message: friendlyHardwareMessage(raw, "Unable to read the saved file."),
          };
        }
      },
    },
    share: {
      async shareReceipt(text, title) {
        try {
          // Do not wrap Share in withTimeout — the OS sheet stays open longer than
          // any budget and a race reject leaves share/print feeling broken.
          await Share.share({
            title: title ?? "Receipt",
            text,
            dialogTitle: title ?? "Share receipt",
          });
          return { ok: true };
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error ?? "");
          if (/cancel/i.test(raw)) return { ok: false, message: "Cancelled" };
          const webResult = await web.share.shareReceipt(text, title);
          if (webResult.ok) return webResult;
          return {
            ok: false,
            message: friendlyHardwareMessage(raw, shareFailedMessage()),
          };
        }
      },
      async shareImage(uri, title) {
        try {
          await Share.share({
            title: title ?? "Image",
            url: uri,
            dialogTitle: title ?? "Share image",
          });
          return { ok: true };
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error ?? "");
          if (/cancel/i.test(raw)) return { ok: false, message: "Cancelled" };
          return {
            ok: false,
            message: friendlyHardwareMessage(raw, shareFailedMessage()),
          };
        }
      },
    },
  };
}
