import { getDesktopBridge, isDesktopRuntime } from "@/lib/desktop";
import {
  loadTerminalScannerConfig,
  type TerminalScannerConfig,
} from "./terminal-scanner-config";

export type DiscoveredScanner = {
  id: string;
  label: string;
  mode: string;
};

export type ScannerDiscoveryResult = {
  ok: boolean;
  message?: string;
  scanners: DiscoveredScanner[];
  bridgeOnline: boolean;
};

export type ScannerConnectionState = "connected" | "not_connected" | "disabled";

/** Shared barcode provider contract — Electron HID now; mobile camera later. */
export type BarcodeProviderKind = "electron_hid" | "mobile_camera";

export function getActiveBarcodeProviderKind(): BarcodeProviderKind {
  return isDesktopRuntime() ? "electron_hid" : "electron_hid";
}

export function isBarcodeScanningEnabled(config = loadTerminalScannerConfig()): boolean {
  return config.enabled;
}

export function getScannerConnectionState(
  config: TerminalScannerConfig = loadTerminalScannerConfig(),
  bridgeOnline: boolean,
): ScannerConnectionState {
  if (!config.enabled) return "disabled";
  if (!bridgeOnline && isDesktopRuntime()) return "not_connected";
  if (!config.deviceId.trim()) return "not_connected";
  return "connected";
}

/** Ask the desktop shell to list scanner adapters / devices. */
export async function discoverScanners(): Promise<ScannerDiscoveryResult> {
  const desktop = getDesktopBridge();
  if (!desktop?.discoverDevices) {
    return {
      ok: false,
      message: "Open Settings in the Novend POS desktop app to discover scanners",
      scanners: [],
      bridgeOnline: false,
    };
  }

  try {
    const result = await desktop.discoverDevices();
    const scanners = (result.devices ?? [])
      .filter((device) => device.kind === "scanner")
      .map((device) => ({
        id: device.id,
        label: device.label,
        mode: typeof device.meta?.mode === "string" ? device.meta.mode : "unknown",
      }));

    if (!result.ok) {
      return {
        ok: false,
        message: result.message || "Discover failed",
        scanners,
        bridgeOnline: true,
      };
    }

    return {
      ok: true,
      message:
        scanners.length > 0
          ? `Found ${scanners.length} scanner(s)`
          : "No scanners found — HID keyboard wedge is still available in POS",
      scanners,
      bridgeOnline: true,
    };
  } catch {
    return {
      ok: false,
      message: "Desktop hardware bridge failed during scanner discovery",
      scanners: [],
      bridgeOnline: false,
    };
  }
}

export async function probeScannerBridge(): Promise<{ ok: boolean; version?: string; platform?: string }> {
  const desktop = getDesktopBridge();
  if (!desktop?.getRuntime) return { ok: false };
  try {
    const runtime = await desktop.getRuntime();
    return { ok: true, version: runtime.version, platform: runtime.platform };
  } catch {
    return { ok: false };
  }
}
