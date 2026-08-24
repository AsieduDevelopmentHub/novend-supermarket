import { getElectronBridge } from "../platform";
import type { HardwareAdapters } from "../types";
import { createWebAdapters } from "./web";
import { notImplemented, unsupported, type ElectronHardwareBridge } from "./types";

/** Electron adapter — routes printer / discovery through `window.novendDesktop`. */
export function createElectronAdapters(): HardwareAdapters {
  const web = createWebAdapters();
  const bridge = () => getElectronBridge<ElectronHardwareBridge>();

  return {
    ...web,
    camera: {
      async ensurePermission() {
        return { ok: true };
      },
      async capturePhoto() {
        // Renderer still uses getUserMedia via product dialogs in Phase 1.
        return unsupported("Use the in-app camera dialog on desktop");
      },
      async pickFromGallery() {
        return unsupported("Use the file picker on desktop");
      },
    },
    barcode: {
      async scan() {
        return notImplemented("Native barcode scan");
      },
      async startListening() {
        // HID keyboard-wedge scanners are handled in the renderer hook today.
        return {
          ok: true,
          message: "Use the on-screen HID capture / keyboard wedge scanner",
        };
      },
      async stopListening() {
        return { ok: true };
      },
      async discover() {
        const desktop = bridge();
        if (!desktop) {
          return { ok: false, message: "Desktop bridge not available" };
        }
        try {
          const result = await desktop.discoverDevices();
          return {
            ok: result.ok,
            message: result.message,
            data: result,
          };
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : "Discover failed",
          };
        }
      },
    },
    printer: {
      async printReceipt(request) {
        const desktop = bridge();
        if (!desktop) {
          return { ok: false, message: "Desktop bridge not available" };
        }
        if (request.connectionType === "bluetooth") {
          return {
            ok: false,
            message: "Bluetooth printing is available in the Novend mobile app",
          };
        }
        try {
          const result = await desktop.print({
            ...request,
            connectionType: request.connectionType,
          });
          return { ok: result.ok, message: result.message };
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : "Print failed",
          };
        }
      },
      async discoverPrinters() {
        const desktop = bridge();
        if (!desktop) {
          return {
            ok: false,
            message: "Open Settings in the Novend POS desktop app to discover printers",
            data: { printers: [], suggested: null },
          };
        }
        try {
          const result = await desktop.discoverDevices();
          if (!result.ok) {
            return {
              ok: false,
              message: result.message || "Discover failed",
              data: { printers: [], suggested: null },
            };
          }
          const printers = (result.windowsPrinters ?? []).map((p) => ({
            name: p.name,
            driverName: p.driverName,
            portName: p.portName,
            isDefault: p.isDefault,
            networkHost: p.networkHost,
            networkPort: p.networkPort,
          }));
          const suggested = result.suggested ?? null;
          return {
            ok: true,
            message: result.message,
            data: {
              printers,
              suggested,
              version: result.version,
              platform: result.platform,
            },
          };
        } catch {
          return {
            ok: false,
            message: "Desktop hardware bridge failed during discovery",
            data: { printers: [], suggested: null },
          };
        }
      },
      async getDefaultPrinter() {
        const discovered = await this.discoverPrinters();
        if (!discovered.ok || !discovered.data) return { ok: true, data: null };
        const suggested = discovered.data.suggested;
        if (!suggested) return { ok: true, data: null };
        return {
          ok: true,
          data: {
            connectionType: suggested.connectionType,
            windowsPrinterName: suggested.windowsPrinterName,
            printerHost: suggested.printerHost,
            printerPort: suggested.printerPort,
            paperWidthMm: 80,
          },
        };
      },
      async testPrint(config) {
        const desktop = bridge();
        if (!desktop) {
          return { ok: false, message: "Desktop bridge not available" };
        }
        if (config.connectionType === "bluetooth") {
          return {
            ok: false,
            message: "Bluetooth printing is available in the Novend mobile app",
          };
        }
        try {
          const result = await desktop.testPrint({
            connectionType: config.connectionType ?? "auto",
            printerHost: config.printerHost,
            printerPort: config.printerPort,
            windowsPrinterName: config.windowsPrinterName,
            paperWidthMm: config.paperWidthMm === 58 || config.paperWidthMm === 80 ? config.paperWidthMm : 80,
            copies: 1,
          });
          return { ok: result.ok, message: result.message };
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : "Test print failed",
          };
        }
      },
    },
  };
}
