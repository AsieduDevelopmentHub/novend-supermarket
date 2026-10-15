import { APP_BRAND } from "@/constants/app";
import { Hardware, getElectronBridge, isElectron } from "@novend/hardware";
import type { BridgePrintRequest, TerminalPrinterConfig } from "./terminal-config";

// Re-export for callers that imported isDesktopRuntime from the print bridge.
export { isElectron as isDesktopRuntime } from "@novend/hardware";

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

/** Probe native desktop hardware bridge. Browser always returns offline. */
export async function probePrintBridge(): Promise<BridgeStatus> {
  const desktop = getElectronBridge<{
    getRuntime: () => Promise<{ version: string; platform: string }>;
  }>();
  if (!desktop || !isElectron()) {
    return {
      ok: false,
      runtime: "browser",
      message: `Native printing requires the ${APP_BRAND} desktop app`,
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
  const result = await Hardware.printer.discoverPrinters();
  if (!result.ok || !result.data) {
    return {
      ok: false,
      message:
        result.message || `Open Settings in the ${APP_BRAND} desktop app to discover printers`,
      windowsPrinters: [],
      suggested: null,
    };
  }

  const windowsPrinters: DiscoveredWindowsPrinter[] = result.data.printers.map((p) => ({
    name: p.name,
    driverName: p.driverName ?? "",
    portName: p.portName ?? "",
    isDefault: Boolean(p.isDefault),
    networkHost: p.networkHost ?? null,
    networkPort: p.networkPort ?? null,
  }));

  const suggested = result.data.suggested
    ? {
        connectionType:
          result.data.suggested.connectionType === "bluetooth"
            ? ("auto" as const)
            : result.data.suggested.connectionType,
        windowsPrinterName: result.data.suggested.windowsPrinterName,
        printerHost: result.data.suggested.printerHost,
        printerPort: result.data.suggested.printerPort,
      }
    : null;

  return {
    ok: true,
    version: result.data.version,
    platform: result.data.platform,
    message: result.message,
    windowsPrinters,
    suggested,
  };
}

/** Send raw ESC/POS to the desktop main process for silent printing. */
export async function sendToPrintBridge(
  request: BridgePrintRequest,
): Promise<{ ok: boolean; message?: string }> {
  return Hardware.printer.printReceipt({
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
}

/** Run a test print through the desktop shell. */
export async function testDesktopPrint(
  config: TerminalPrinterConfig,
): Promise<{ ok: boolean; message?: string }> {
  return Hardware.printer.testPrint({
    connectionType: config.connectionType,
    printerHost: config.printerHost,
    printerPort: config.printerPort,
    windowsPrinterName: config.windowsPrinterName,
    paperWidthMm:
      config.paperWidthMm === 58 || config.paperWidthMm === 80 ? config.paperWidthMm : 58,
  });
}
