import { isCapacitor } from "@novend/hardware";

export function bytesToBlob(bytes: Uint8Array, type: string): Blob {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type });
}

type NativeDownloads = {
  beginSave: (fileName: string, mimeType: string) => void;
  appendChunk: (base64: string) => boolean | void;
  maxSaveBytes?: () => number;
  cancelSave?: () => void;
  finishSave: () => boolean;
  finishShare?: () => boolean;
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

async function pushViaNativeBridge(
  filename: string,
  blob: Blob,
  finish: (bridge: NativeDownloads) => boolean,
): Promise<boolean> {
  const bridge = nativeDownloads();
  if (!bridge) return false;
  const reportedLimit = bridge.maxSaveBytes?.();
  const limit =
    reportedLimit && Number.isFinite(reportedLimit) && reportedLimit > 0
      ? reportedLimit
      : 32 * 1024 * 1024;
  if (blob.size > limit) {
    throw new Error(
      "This file is too large to export safely on this phone. Export a smaller date range or use the desktop app.",
    );
  }
  const buffer = new Uint8Array(await blob.arrayBuffer());
  const mime = blob.type || "application/octet-stream";
  bridge.beginSave(filename, mime);
  try {
    for (let offset = 0; offset < buffer.length; offset += NATIVE_CHUNK_BYTES) {
      const encoded = bytesToBase64(buffer.subarray(offset, offset + NATIVE_CHUNK_BYTES));
      if (bridge.appendChunk(encoded) === false) {
        throw new Error(
          "The phone could not buffer this export safely. Export a smaller date range or use the desktop app.",
        );
      }
    }
    return finish(bridge);
  } finally {
    bridge.cancelSave?.();
  }
}

async function saveViaNativeBridge(filename: string, blob: Blob): Promise<boolean> {
  return pushViaNativeBridge(filename, blob, (bridge) => bridge.finishSave());
}

/** Open the Android share sheet with this file. Returns false when the bridge is missing. */
export async function shareBlob(filename: string, blob: Blob): Promise<boolean> {
  return pushViaNativeBridge(filename, blob, (bridge) => {
    if (typeof bridge.finishShare !== "function") return false;
    return bridge.finishShare();
  });
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
