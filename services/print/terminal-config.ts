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
  connectionType: "auto",
  printerHost: "192.168.1.100",
  printerPort: 9100,
  windowsPrinterName: "",
  paperWidthMm: null,
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
    return {
      ...DEFAULT_TERMINAL_PRINTER_CONFIG,
      preferNative: parsed.preferNative ?? DEFAULT_TERMINAL_PRINTER_CONFIG.preferNative,
      autoPrint: parsed.autoPrint ?? DEFAULT_TERMINAL_PRINTER_CONFIG.autoPrint,
      openCashDrawer: parsed.openCashDrawer === true,
      copies: Math.min(5, Math.max(1, Number(parsed.copies) || 1)),
      connectionType:
        parsed.connectionType === "windows" ||
        parsed.connectionType === "network" ||
        parsed.connectionType === "auto"
          ? parsed.connectionType
          : DEFAULT_TERMINAL_PRINTER_CONFIG.connectionType,
      printerHost:
        typeof parsed.printerHost === "string"
          ? parsed.printerHost
          : DEFAULT_TERMINAL_PRINTER_CONFIG.printerHost,
      printerPort: Number(parsed.printerPort) || 9100,
      windowsPrinterName:
        typeof parsed.windowsPrinterName === "string" ? parsed.windowsPrinterName : "",
      paperWidthMm:
        parsed.paperWidthMm === 58 || parsed.paperWidthMm === 80 ? parsed.paperWidthMm : null,
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
  reason: "native" | "iframe" | "iframe_failed" | "ssr" | "native_unavailable";
  copies?: number;
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
  return payload.template.paperWidthMm === 58 ? 58 : 80;
}
