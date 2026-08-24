import type { HardwareAdapters } from "../types";
import { unsupported } from "./types";

/** Browser / PWA adapter — graceful fallbacks; no native plugins. */
export function createWebAdapters(): HardwareAdapters {
  return {
    camera: {
      async ensurePermission() {
        return { ok: true };
      },
      async capturePhoto() {
        return unsupported("Camera capture");
      },
      async pickFromGallery() {
        return unsupported("Gallery picker");
      },
    },
    barcode: {
      async scan() {
        return unsupported("Native barcode scan");
      },
      async startListening() {
        return unsupported("Hardware barcode listener");
      },
      async stopListening() {
        return { ok: true };
      },
      async discover() {
        return {
          ok: false,
          message: "Hardware scanner discovery requires the desktop app or a native build",
        };
      },
    },
    printer: {
      async printReceipt() {
        return unsupported("Native receipt printing");
      },
      async discoverPrinters() {
        return {
          ok: false,
          message: "Open Settings in the Novend POS desktop app to discover printers",
          data: { printers: [], suggested: null },
        };
      },
      async getDefaultPrinter() {
        return { ok: true, data: null };
      },
      async testPrint() {
        return unsupported("Desktop test print");
      },
    },
    filesystem: {
      async savePDF() {
        return unsupported("Native PDF save");
      },
      async saveImage() {
        return unsupported("Native image save");
      },
      async readFile() {
        return unsupported("Native file read");
      },
    },
    share: {
      async shareReceipt(text, title) {
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
          try {
            await navigator.share({ text, title: title ?? "Receipt" });
            return { ok: true };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Share cancelled",
            };
          }
        }
        return unsupported("Share");
      },
      async shareImage(uri, title) {
        if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
          try {
            await navigator.share({ url: uri, title: title ?? "Image" });
            return { ok: true };
          } catch (error) {
            return {
              ok: false,
              message: error instanceof Error ? error.message : "Share cancelled",
            };
          }
        }
        return unsupported("Share");
      },
    },
  };
}
