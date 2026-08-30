import { isCapacitor } from "@novend/hardware";

export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

type NativeDownloads = {
  beginSave: (fileName: string, mimeType: string) => void;
  appendChunk: (base64: string) => void;
  finishSave: () => boolean;
};

function nativeDownloads(): NativeDownloads | null {
  if (typeof window === "undefined" || !isCapacitor()) return null;
  const bridge = (window as Window & { NovendNative?: NativeDownloads }).NovendNative;
  if (
    !bridge ||
    typeof bridge.beginSave !== "function" ||
    typeof bridge.appendChunk !== "function" ||
    typeof bridge.finishSave !== "function"
  ) {
    return null;
  }
  return bridge;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** ~24KB raw → ~32KB base64, well under the Android binder transaction limit. */
const NATIVE_CHUNK_BYTES = 24 * 1024;

async function saveViaNativeBridge(filename: string, blob: Blob): Promise<boolean> {
  const bridge = nativeDownloads();
  if (!bridge) return false;
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type || "application/octet-stream";
  bridge.beginSave(filename, mime);
  for (let offset = 0; offset < buffer.length; offset += NATIVE_CHUNK_BYTES) {
    bridge.appendChunk(bytesToBase64(buffer.subarray(offset, offset + NATIVE_CHUNK_BYTES)));
  }
  return bridge.finishSave();
}

function triggerAnchorDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Persist a file. On Capacitor this writes Downloads via the native
 * JavascriptInterface (not the hung Capacitor plugin bridge). Elsewhere it
 * uses a blob anchor click.
 */
export async function downloadBlob(filename: string, blob: Blob): Promise<void> {
  if (isCapacitor()) {
    if (await saveViaNativeBridge(filename, blob)) return;
    throw new Error("Could not save the file to Downloads. Update Novend POS and try again.");
  }
  triggerAnchorDownload(filename, blob);
}
