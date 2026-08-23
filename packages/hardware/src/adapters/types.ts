import type { HardwareAdapters, HardwareResult } from "../types";

export function unsupported<T = void>(feature: string): HardwareResult<T> {
  return { ok: false, message: `${feature} is not supported on this platform` };
}

export function notImplemented<T = void>(feature: string): HardwareResult<T> {
  return { ok: false, message: `${feature} is not implemented yet` };
}

/** Minimal Electron preload surface used by the hardware adapters. */
export type ElectronHardwareBridge = {
  getRuntime: () => Promise<{ version: string; platform: string }>;
  discoverDevices: () => Promise<{
    ok: boolean;
    message?: string;
    version?: string;
    platform?: string;
    windowsPrinters?: Array<{
      name: string;
      driverName: string;
      portName: string;
      isDefault: boolean;
      networkHost: string | null;
      networkPort: number | null;
    }>;
    devices?: Array<{
      id: string;
      kind: string;
      label: string;
      meta: Record<string, unknown>;
    }>;
    suggested?: {
      connectionType: "windows" | "network" | "auto";
      windowsPrinterName: string;
      printerHost: string;
      printerPort: number;
    } | null;
  }>;
  print: (request: {
    escposBase64: string;
    invoiceNumber?: string;
    copies?: number;
    connectionType: "windows" | "network" | "auto";
    printerHost?: string;
    printerPort?: number;
    windowsPrinterName?: string;
    paperWidthMm?: 58 | 80;
    openCashDrawer?: boolean;
  }) => Promise<{ ok: boolean; message?: string }>;
  testPrint: (partial?: {
    connectionType?: "windows" | "network" | "auto";
    printerHost?: string;
    printerPort?: number;
    windowsPrinterName?: string;
    paperWidthMm?: 58 | 80;
    copies?: number;
  }) => Promise<{ ok: boolean; message?: string }>;
};

export type AdapterFactory = () => HardwareAdapters;
