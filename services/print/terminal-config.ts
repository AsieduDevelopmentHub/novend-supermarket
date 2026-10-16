import type { ReceiptPayload } from "@/features/receipts/types";

/** Per-terminal printer settings (device-local — not synced to Convex). */
export type TerminalPrinterConfig = {
  /** Prefer native desktop ESC/POS when the Electron bridge is available. */
  preferNative: boolean;
  /** After Pay, print without opening the preview dialog. */
  autoPrint: boolean;
  /** How many copies to send to the printer. */
  copies: number;
  /** Open cash drawer after a successful print (ESC/POS pulse). */
  openCashDrawer: boolean;
  /** Connection type declared to the desktop hardware layer. */
  connectionType: "network" | "windows" | "auto";
  /** Network printer host (used when connectionType is network). */
  printerHost: string;
  /** Raw TCP port — usually 9100 for thermal printers. */
  printerPort: number;
  /** Windows printer share/name (used when connectionType is windows). */
  windowsPrinterName: string;
  /** Paper width override; null = use receipt template width. */
  paperWidthMm: 58 | 80 | null;
};

export const DEFAULT_TERMINAL_PRINTER_CONFIG: TerminalPrinterConfig = {
  preferNative: true,
  autoPrint: true,
  copies: 1,
  openCashDrawer: false,
  // Prefer Windows RAW for USB tills — "auto" used to probe a dead LAN IP first and lag.
  connectionType: "windows",
  printerHost: "",
  printerPort: 9100,
  windowsPrinterName: "",
  // Millie's shop printers are 58mm; null used to fall through to an 80mm template default.
  paperWidthMm: 58,
};

const STORAGE_KEY = "novend.terminal.printer";
/** Pre-rebrand localStorage key — read-only migration from early Novend builds. */
const LEGACY_STORAGE_KEY = "princellen.terminal.printer";

export function loadTerminalPrinterConfig(): TerminalPrinterConfig {
  if (typeof window === "undefined") return { ...DEFAULT_TERMINAL_PRINTER_CONFIG };
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TERMINAL_PRINTER_CONFIG };
    const parsed = JSON.parse(raw) as Partial<TerminalPrinterConfig> & {
      /** Legacy agent fields — ignored after Electron migration. */
      agentUrl?: string;
      agentApiKey?: string;
    };
    const host =
      typeof parsed.printerHost === "string"
        ? parsed.printerHost
        : DEFAULT_TERMINAL_PRINTER_CONFIG.printerHost;
    const windowsName =
      typeof parsed.windowsPrinterName === "string" ? parsed.windowsPrinterName : "";
    let connectionType: TerminalPrinterConfig["connectionType"] =
      parsed.connectionType === "windows" ||
      parsed.connectionType === "network" ||
      parsed.connectionType === "auto"
        ? parsed.connectionType
        : DEFAULT_TERMINAL_PRINTER_CONFIG.connectionType;
    // Migrate laggy installs: auto + placeholder LAN IP + Windows printer → use Windows RAW.
    if (
      connectionType === "auto" &&
      windowsName &&
      (!host.trim() || host.trim() === "192.168.1.100")
    ) {
      connectionType = "windows";
    }

    return {
      ...DEFAULT_TERMINAL_PRINTER_CONFIG,
      preferNative: parsed.preferNative ?? DEFAULT_TERMINAL_PRINTER_CONFIG.preferNative,
      autoPrint: parsed.autoPrint ?? DEFAULT_TERMINAL_PRINTER_CONFIG.autoPrint,
      openCashDrawer: parsed.openCashDrawer === true,
      copies: Math.min(5, Math.max(1, Number(parsed.copies) || 1)),
      connectionType,
      printerHost: host === "192.168.1.100" ? "" : host,
      printerPort: Number(parsed.printerPort) || 9100,
      windowsPrinterName: windowsName,
      paperWidthMm:
        parsed.paperWidthMm === 58 || parsed.paperWidthMm === 80
          ? parsed.paperWidthMm
          : DEFAULT_TERMINAL_PRINTER_CONFIG.paperWidthMm,
    };
  } catch {
    return { ...DEFAULT_TERMINAL_PRINTER_CONFIG };
  }
}

export function saveTerminalPrinterConfig(config: TerminalPrinterConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export type PrintResult = {
  printed: boolean;
  reason:
    "native" | "system" | "download" | "iframe" | "iframe_failed" | "ssr" | "native_unavailable";
  copies?: number;
  /** Structured Bluetooth failure code when printed is false on Cap. */
  failureCode?: string;
  failureMessage?: string;
};

export type BridgePrintRequest = {
  escposBase64: string;
  invoiceNumber: string;
  copies: number;
  connectionType: TerminalPrinterConfig["connectionType"];
  printerHost: string;
  printerPort: number;
  windowsPrinterName: string;
  paperWidthMm: 58 | 80;
  openCashDrawer?: boolean;
};

/** Resolve paper width from terminal override or receipt template. */
export function resolvePaperWidthMm(
  payload: ReceiptPayload,
  config: TerminalPrinterConfig,
): 58 | 80 {
  if (config.paperWidthMm === 58 || config.paperWidthMm === 80) return config.paperWidthMm;
  return payload.template.paperWidthMm === 80 ? 80 : 58;
}

/**
 * Mobile physical printers: Hardware paper width wins over the receipt template.
 * Saved printer width → template width → 80mm.
 */
export function resolveMobilePaperWidthMm(args: {
  savedPaperWidthMm?: 58 | 80 | null;
  templatePaperWidthMm?: 58 | 80 | null;
}): 58 | 80 {
  if (args.savedPaperWidthMm === 58 || args.savedPaperWidthMm === 80) {
    return args.savedPaperWidthMm;
  }
  if (args.templatePaperWidthMm === 58 || args.templatePaperWidthMm === 80) {
    return args.templatePaperWidthMm;
  }
  return 80;
}
