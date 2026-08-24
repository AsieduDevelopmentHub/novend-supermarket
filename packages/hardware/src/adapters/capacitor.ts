import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import {
  BarcodeFormat,
  BarcodeScanner,
  GoogleBarcodeScannerModuleInstallState,
} from "@capacitor-mlkit/barcode-scanning";
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
  NATIVE_CAMERA_TIMEOUT_MS,
  NATIVE_CALL_TIMEOUT_MS,
  NATIVE_SCAN_TIMEOUT_MS,
  isNativeTimeoutError,
  withTimeout,
} from "../timeout";
import { createWebAdapters } from "./web";
import {
  bluetoothTestPrint,
  createBluetoothPrinterControls,
  printViaBluetooth,
} from "./bluetooth-printer";

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function uriToFile(uri: string, mimeType: string, fileName: string): Promise<File | undefined> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    const type = blob.type || mimeType;
    return new File([blob], fileName, { type });
  } catch {
    return undefined;
  }
}

async function persistProductImage(uri: string, mimeType: string): Promise<string | undefined> {
  try {
    const file = await uriToFile(uri, mimeType, "capture.jpg");
    if (!file) return undefined;
    const buffer = new Uint8Array(await file.arrayBuffer());
    const ext = mimeType.includes("png") ? "png" : "jpg";
    const path = `product-images/${Date.now()}.${ext}`;
    await Filesystem.writeFile({
      path,
      data: bytesToBase64(buffer),
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

async function getPhoto(source: CameraSource): Promise<HardwareResult<PhotoCapture>> {
  try {
    const permission = await withTimeout(Camera.checkPermissions(), NATIVE_CALL_TIMEOUT_MS);
    const needsPrompt =
      source === CameraSource.Camera
        ? permission.camera !== "granted"
        : permission.photos !== "granted" && permission.camera !== "granted";

    if (needsPrompt) {
      const requested = await withTimeout(
        Camera.requestPermissions({
          permissions: source === CameraSource.Camera ? ["camera"] : ["photos"],
        }),
        NATIVE_CALL_TIMEOUT_MS,
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
    }

    const photo = await withTimeout(
      Camera.getPhoto({
        quality: 92,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source,
        correctOrientation: true,
        saveToGallery: false,
      }),
      NATIVE_CAMERA_TIMEOUT_MS,
    );

    const uri = photo.webPath || photo.path;
    if (!uri) {
      return { ok: false, message: cameraCaptureFailedMessage() };
    }

    const mimeType = photo.format === "png" ? "image/png" : "image/jpeg";
    const fileName = `product-${Date.now()}.${photo.format === "png" ? "png" : "jpg"}`;
    const file = await uriToFile(uri, mimeType, fileName);
    const localPath = await persistProductImage(uri, mimeType);

    return {
      ok: true,
      data: {
        uri: localPath || uri,
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
      message: friendlyHardwareMessage(raw, cameraCaptureFailedMessage()),
    };
  }
}

async function ensureGoogleBarcodeModule(): Promise<void> {
  try {
    const { available } = await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();
    if (available) return;
    await new Promise<void>((resolve) => {
      void BarcodeScanner.addListener("googleBarcodeScannerModuleInstallProgress", (event) => {
        if (
          event.state === GoogleBarcodeScannerModuleInstallState.COMPLETED ||
          event.state === GoogleBarcodeScannerModuleInstallState.CANCELED ||
          event.state === GoogleBarcodeScannerModuleInstallState.FAILED
        ) {
          resolve();
        }
      }).then(() => {
        void BarcodeScanner.installGoogleBarcodeScannerModule();
      });
      window.setTimeout(() => resolve(), 15_000);
    });
  } catch {
    /* iOS or unsupported — scan() still attempted */
  }
}

/**
 * Capacitor (Android / iOS) adapter — native camera, barcode, filesystem, share.
 * Printer remains stubbed until Bluetooth printing (Phase 3).
 */
export function createCapacitorAdapters(): HardwareAdapters {
  const web = createWebAdapters();

  return {
    ...web,
    camera: {
      async capturePhoto() {
        return getPhoto(CameraSource.Camera);
      },
      async pickFromGallery() {
        return getPhoto(CameraSource.Photos);
      },
    },
    barcode: {
      async scan() {
        try {
          await ensureGoogleBarcodeModule();
          try {
            const permission = await withTimeout(
              BarcodeScanner.checkPermissions(),
              NATIVE_CALL_TIMEOUT_MS,
            );
            if (permission.camera !== "granted") {
              const requested = await withTimeout(
                BarcodeScanner.requestPermissions(),
                NATIVE_CALL_TIMEOUT_MS,
              );
              if (requested.camera !== "granted") {
                return { ok: false, message: permissionDeniedMessage("camera") };
              }
            }
          } catch (error) {
            if (isNativeTimeoutError(error)) {
              return {
                ok: false,
                message: "Camera permission timed out. Try again or enable it in device settings.",
              };
            }
            /* Some platforms fold permission into scan() — continue. */
          }
          const { barcodes } = await withTimeout(
            BarcodeScanner.scan({
              formats: [
                BarcodeFormat.Ean13,
                BarcodeFormat.Ean8,
                BarcodeFormat.UpcA,
                BarcodeFormat.UpcE,
                BarcodeFormat.Code128,
                BarcodeFormat.Code39,
                BarcodeFormat.QrCode,
                BarcodeFormat.Codabar,
                BarcodeFormat.Itf,
              ],
            }),
            NATIVE_SCAN_TIMEOUT_MS,
          );
          const first = barcodes[0];
          const value = first?.rawValue?.trim();
          if (!value) {
            return { ok: false, message: barcodeScanFailedMessage() };
          }
          return {
            ok: true,
            data: {
              value,
              format: first.format,
            },
          };
        } catch (error) {
          if (isNativeTimeoutError(error)) {
            return { ok: false, message: "Barcode scanner timed out. Try again." };
          }
          const raw = error instanceof Error ? error.message : String(error ?? "");
          if (/cancel/i.test(raw)) {
            return { ok: false, message: "Cancelled" };
          }
          return {
            ok: false,
            message: friendlyHardwareMessage(raw, barcodeScanFailedMessage()),
          };
        }
      },
      async startListening() {
        return {
          ok: true,
          message: "Use Scan barcode for the native camera scanner",
        };
      },
      async stopListening() {
        return { ok: true };
      },
      async discover() {
        return {
          ok: true,
          message: "Native camera barcode scanning is available on this device",
          data: {
            devices: [
              {
                id: "capacitor:camera",
                kind: "scanner",
                label: "Camera barcode scanner",
                meta: { mode: "camera_native" },
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
          const path = `documents/${safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`}`;
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
          // Fall back to Web Share when the native sheet is unavailable.
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
