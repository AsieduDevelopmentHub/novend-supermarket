import { app } from "electron";
import { discoverScanners } from "./scanners";
import { buildSuggested, listWindowsPrinters } from "./printers/discover";
import type {
  DiscoverResult,
  DiscoveredDevice,
  HardwareCapability,
  PrintJobRequest,
  PrintJobResult,
} from "./types";
import { buildTestEscPosBase64, executePrintJob } from "./printers/execute";

/** Single source of truth: the packaged app manifest version (synced from the repo root). */
function desktopVersion(): string {
  return app.getVersion();
}

/** Modular device discovery â€” printers first; scanners / drawers extend here. */
export async function discoverDevices(): Promise<DiscoverResult> {
  try {
    const windowsPrinters = await listWindowsPrinters();
    const scanners = await discoverScanners();

    const devices: DiscoveredDevice[] = [
      ...windowsPrinters.map((p) => ({
        id: `printer:windows:${p.name}`,
        kind: "printer" as const,
        label: p.name,
        meta: {
          driverName: p.driverName,
          portName: p.portName,
          isDefault: p.isDefault,
          networkHost: p.networkHost,
          networkPort: p.networkPort,
        },
      })),
      ...scanners.map((s) => ({
        id: `scanner:${s.mode}:${s.id}`,
        kind: "scanner" as const,
        label: s.label,
        meta: { mode: s.mode },
      })),
    ];

    return {
      ok: true,
      version: desktopVersion(),
      platform: process.platform,
      windowsPrinters,
      devices,
      suggested: buildSuggested(windowsPrinters),
      message:
        windowsPrinters.length > 0
          ? `Found ${windowsPrinters.length} printer(s)`
          : "No Windows printers found",
    };
  } catch (error) {
    return {
      ok: false,
      version: desktopVersion(),
      platform: process.platform,
      windowsPrinters: [],
      devices: [],
      suggested: null,
      message: error instanceof Error ? error.message : "Device discovery failed",
    };
  }
}

export async function printReceiptJob(job: PrintJobRequest): Promise<PrintJobResult> {
  return executePrintJob(job);
}

export async function runTestPrint(partial?: Partial<PrintJobRequest>): Promise<PrintJobResult> {
  const discovery = await discoverDevices();
  const suggested = discovery.suggested;
  const firstWin = discovery.windowsPrinters[0]?.name;

  return executePrintJob({
    escposBase64: buildTestEscPosBase64(),
    invoiceNumber: `TEST-${Date.now()}`,
    copies: 1,
    connectionType:
      partial?.connectionType || suggested?.connectionType || (firstWin ? "windows" : "auto"),
    windowsPrinterName:
      partial?.windowsPrinterName || suggested?.windowsPrinterName || firstWin || "",
    printerHost: partial?.printerHost || suggested?.printerHost || "",
    printerPort: partial?.printerPort || suggested?.printerPort || 9100,
    paperWidthMm: partial?.paperWidthMm || 58,
    openCashDrawer: partial?.openCashDrawer,
  });
}

export function listCapabilities(): HardwareCapability[] {
  return [
    {
      kind: "printer",
      available: true,
    },
    {
      kind: "scanner",
      available: true,
      reason: "HID keyboard wedge supported in UI; USB/serial adapters forthcoming",
    },
    {
      kind: "cash_drawer",
      available: true,
      reason: "Triggered via ESC/POS pulse with receipt print",
    },
    {
      kind: "customer_display",
      available: true,
    },
    {
      kind: "scale",
      available: false,
      reason: "Not implemented yet",
    },
  ];
}

export function getRuntimeInfo() {
  return {
    ok: true as const,
    runtime: "electron" as const,
    version: desktopVersion(),
    platform: process.platform,
    arch: process.arch,
    packaged: app.isPackaged,
  };
}
