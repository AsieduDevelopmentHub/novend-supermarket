import { getDesktopBridge, isDesktopRuntime } from "@/lib/desktop";
import type { BridgePrintRequest, TerminalPrinterConfig } from "./terminal-config";

export type BridgeStatus = {
  ok: boolean;
  /** Desktop app version — sourced from the packaged app manifest. */
  version?: string;
  platform?: string;
  printerReachable?: boolean;
  message?: string;
  runtime?: "electron" | "browser";
};

export type DiscoveredWindowsPrinter = {
  name: string;
  driverName: string;
  portName: string;
  isDefault: boolean;
  /** Inferred from PortName when it embeds an IP (e.g. IP_192.168.1.50). */
  networkHost: string | null;
  networkPort: number | null;
};

export type PrinterDiscoveryResult = {
  ok: boolean;
  version?: string;
  platform?: string;
  message?: string;
  windowsPrinters: DiscoveredWindowsPrinter[];
  /** Best-guess defaults the UI can apply with one click. */
  suggested: {
    connectionType: TerminalPrinterConfig["connectionType"];
    windowsPrinterName: string;
    printerHost: string;
    printerPort: number;
  } | null;
};

export { isDesktopRuntime };

/** Probe native desktop hardware bridge. Browser always returns offline. */
export async function probePrintBridge(): Promise<BridgeStatus> {
  const desktop = getDesktopBridge();
  if (!desktop) {
    return {
      ok: false,
      runtime: "browser",
      message: "Native printing requires the Princellen POS desktop app",
    };
  }
  try {
    const runtime = await desktop.getRuntime();
    return {
      ok: true,
      runtime: "electron",
      version: runtime.version,
      platform: runtime.platform,
      printerReachable: true,
    };
  } catch {
    return {
      ok: false,
      runtime: "electron",
      message: "Desktop bridge unavailable",
    };
  }
}

/** Ask the desktop shell to enumerate printers on this machine. */
export async function discoverPrinters(): Promise<PrinterDiscoveryResult> {
  const desktop = getDesktopBridge();
  if (!desktop) {
    return {
      ok: false,
      message: "Open Settings in the Princellen POS desktop app to discover printers",
      windowsPrinters: [],
      suggested: null,
    };
  }
  try {
    const result = await desktop.discoverDevices();
    if (!result.ok) {
      return {
        ok: false,
        message: result.message || "Discover failed",
        windowsPrinters: [],
        suggested: null,
      };
    }
    return {
      ok: true,
      version: result.version,
      platform: result.platform,
      message: result.message,
      windowsPrinters: Array.isArray(result.windowsPrinters) ? result.windowsPrinters : [],
      suggested: result.suggested ?? null,
    };
  } catch {
    return {
      ok: false,
      message: "Desktop hardware bridge failed during discovery",
      windowsPrinters: [],
      suggested: null,
    };
  }
}

/** Send raw ESC/POS to the desktop main process for silent printing. */
export async function sendToPrintBridge(
  request: BridgePrintRequest,
): Promise<{ ok: boolean; message?: string }> {
  const desktop = getDesktopBridge();
  if (!desktop) {
    return { ok: false, message: "Desktop bridge not available" };
  }
  try {
    const result = await desktop.print({
      escposBase64: request.escposBase64,
      invoiceNumber: request.invoiceNumber,
      copies: request.copies,
      connectionType: request.connectionType,
      printerHost: request.printerHost,
      printerPort: request.printerPort,
      windowsPrinterName: request.windowsPrinterName,
      paperWidthMm: request.paperWidthMm,
      openCashDrawer: request.openCashDrawer,
    });
    return { ok: result.ok, message: result.message };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Print failed",
    };
  }
}

/** Run a test print through the desktop shell. */
export async function testDesktopPrint(
  config: TerminalPrinterConfig,
): Promise<{ ok: boolean; message?: string }> {
  const desktop = getDesktopBridge();
  if (!desktop) {
    return { ok: false, message: "Desktop bridge not available" };
  }
  try {
    const result = await desktop.testPrint({
      connectionType: config.connectionType,
      printerHost: config.printerHost,
      printerPort: config.printerPort,
      windowsPrinterName: config.windowsPrinterName,
      paperWidthMm:
        config.paperWidthMm === 58 || config.paperWidthMm === 80 ? config.paperWidthMm : 80,
      copies: 1,
    });
    return { ok: result.ok, message: result.message };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Test print failed",
    };
  }
}
