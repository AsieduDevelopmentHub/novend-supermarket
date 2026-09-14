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
  printFailedMessage,
  shareFailedMessage,
} from "../permissions";
import { NATIVE_AVAILABILITY_TIMEOUT_MS, isNativeTimeoutError, withTimeout } from "../timeout";
import { NovendCamera } from "./cap-camera";
import { NovendPrint } from "./cap-print";
import { isMediaStoreUri, toShareableFileUri } from "./cap-uri";
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
  if (source === CameraSource.Photos) return { ok: true };

  try {
    const permission = await withTimeout(Camera.checkPermissions(), NATIVE_AVAILABILITY_TIMEOUT_MS);
    if (permission.camera === "granted" || permission.camera === "limited") {
      return { ok: true };
    }
    const requested = await withTimeout(
      Camera.requestPermissions({ permissions: ["camera"] }),
      NATIVE_AVAILABILITY_TIMEOUT_MS,
    );
    if (requested.camera === "granted" || requested.camera === "limited") {
      return { ok: true };
    }
    return { ok: false, message: permissionDeniedMessage("camera") };
  } catch (error) {
    // Hosted-origin `isPluginAvailable` / unimplemented checks are unreliable.
    // Let getPhoto open the system camera, which requests permission itself.
    const raw = error instanceof Error ? error.message : String(error ?? "");
    if (
      isNativeTimeoutError(error) ||
      /not implemented|not available|unimplemented|plugin/i.test(raw)
    ) {
      return { ok: true };
    }
    return {
      ok: false,
      message: friendlyHardwareMessage(raw, cameraCaptureFailedMessage(), "camera"),
    };
  }
}

async function captureViaNovendCamera(): Promise<HardwareResult<PhotoCapture>> {
  const photo = await NovendCamera.capturePhoto();
  const encoded = photo.base64?.trim();
  if (!encoded) {
    return { ok: false, message: cameraCaptureFailedMessage() };
  }
  const mimeType = photo.mimeType || "image/jpeg";
  const bytes = base64ToBytes(encoded);
  if (bytes.byteLength === 0) {
    return { ok: false, message: cameraCaptureFailedMessage() };
  }
  const fileName = `product-${Date.now()}.jpg`;
  const file = fileFromBytes(bytes, fileName, mimeType);
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
}

async function getPhoto(source: CameraSource): Promise<HardwareResult<PhotoCapture>> {
  if (source === CameraSource.Camera) {
    try {
      return await captureViaNovendCamera();
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error ?? "");
      if (/cancel/i.test(raw)) {
        return { ok: false, message: "Cancelled" };
      }
      /* Official Camera plugin is the fallback if this APK predates NovendCamera. */
    }
  }
  try {
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
    const raw = error instanceof Error ? error.message : String(error ?? "");
    if (/cancel/i.test(raw)) {
      return { ok: false, message: "Cancelled" };
    }
    const permissionDenied =
      /user denied|permission denied|not authorized/i.test(raw) &&
      !/not implemented|not available|plugin|unimplemented/i.test(raw);
    return {
      ok: false,
      message: permissionDenied
        ? permissionDeniedMessage(source === CameraSource.Photos ? "photos" : "camera")
        : friendlyHardwareMessage(raw, cameraCaptureFailedMessage(), "camera"),
    };
  }
}

async function writeCachePdf(
  bytes: Uint8Array,
  fileName: string,
): Promise<HardwareResult<{ uri: string }>> {
  try {
    const safeName = fileName.replace(/[^\w.\-]+/g, "_");
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
    if (!uri) {
      return { ok: false, message: filesystemSaveFailedMessage() };
    }
    return { ok: true, data: { uri: toShareableFileUri(uri) } };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    return {
      ok: false,
      message: friendlyHardwareMessage(raw, filesystemSaveFailedMessage(), "storage"),
    };
  }
}

async function shareLocalFile(uri: string, title?: string): Promise<HardwareResult> {
  if (isMediaStoreUri(uri)) {
    return { ok: false, message: shareFailedMessage() };
  }
  try {
    await Share.share({
      title: title ?? "Receipt",
      files: [toShareableFileUri(uri)],
      dialogTitle: title ?? "Share receipt",
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
        return getPhoto(CameraSource.Camera);
      },
      async pickFromGallery() {
        return getPhoto(CameraSource.Photos);
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
        const status = await createBluetoothPrinterControls().getStatus();
        const width =
          config.paperWidthMm === 58 || config.paperWidthMm === 80
            ? config.paperWidthMm
            : status.data?.paperWidthMm === 58
              ? 58
              : 80;
        if (config.bluetoothDeviceId) {
          await createBluetoothPrinterControls().connect(
            config.bluetoothDeviceId,
            config.windowsPrinterName,
            status.data?.transport,
          );
        }
        return bluetoothTestPrint(width);
      },
    },
    filesystem: {
      async savePDF(bytes, fileName) {
        const encoded = bytesToBase64(bytes);
        try {
          const saved = await NovendPrint.savePdfToDownloads({
            data: encoded,
            fileName,
          });
          if (saved.uri) {
            return { ok: true, data: { pathOrName: saved.uri } };
          }
        } catch {
          /* Cache fallback below */
        }
        const cached = await writeCachePdf(bytes, fileName);
        if (!cached.ok) return { ok: false, message: cached.message };
        return { ok: true, data: { pathOrName: cached.data?.uri ?? fileName } };
      },
      async printPDF(bytes, title) {
        try {
          await NovendPrint.printPdf({ data: bytesToBase64(bytes), title });
          return { ok: true };
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error ?? "");
          if (/cancel/i.test(raw)) return { ok: false, message: "Cancelled" };
          return {
            ok: false,
            message: friendlyHardwareMessage(raw, printFailedMessage()),
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
        return shareLocalFile(uri, title);
      },
      async shareFile(uri, title) {
        return shareLocalFile(uri, title);
      },
      async sharePdf(bytes, title, fileName) {
        try {
          await NovendPrint.sharePdf({
            data: bytesToBase64(bytes),
            fileName,
            title,
          });
          return { ok: true };
        } catch (error) {
          const raw = error instanceof Error ? error.message : String(error ?? "");
          if (/cancel/i.test(raw)) return { ok: false, message: "Cancelled" };
          const cached = await writeCachePdf(bytes, fileName);
          if (cached.ok && cached.data?.uri) {
            const shared = await shareLocalFile(cached.data.uri, title);
            if (shared.ok || shared.message === "Cancelled") return shared;
          }
          return {
            ok: false,
            message: friendlyHardwareMessage(raw, shareFailedMessage()),
          };
        }
      },
    },
  };
}
