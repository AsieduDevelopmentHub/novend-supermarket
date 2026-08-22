import { getDesktopBridge, isDesktopRuntime } from "@/lib/desktop";
import { isCameraBarcodeSupported } from "./barcode-camera";
import {
  loadTerminalScannerConfig,
  saveTerminalScannerConfig,
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

export type ScannerConnectionState = "connected" | "not_connected" | "disabled" | "listening";

/** Shared barcode providers — HID wedge + camera (desktop, web, PWA). */
export type BarcodeProviderKind = "hid" | "camera";

/** Timed HID capture on product create / settings test. */
export const BARCODE_HID_CAPTURE_MS = 18_000;

export function listAvailableBarcodeProviders(): BarcodeProviderKind[] {
  const providers: BarcodeProviderKind[] = ["hid"];
  // Camera uses getUserMedia + native or ZXing — not gated on BarcodeDetector alone.
  if (isCameraBarcodeSupported()) providers.push("camera");
  return providers;
}

export function getActiveBarcodeProviderKind(): BarcodeProviderKind {
  return isDesktopRuntime() ? "hid" : "hid";
}

export function isBarcodeScanningEnabled(config = loadTerminalScannerConfig()): boolean {
  return config.enabled;
}

/** Hardware wedge/USB scanner is active — POS listens in the background (no camera button). */
export function isHardwareBarcodeScannerActive(config = loadTerminalScannerConfig()): boolean {
  return config.enabled;
}

/** Camera scan button for web/PWA when no hardware scanner is configured. */
export function shouldShowCameraBarcodeButton(): boolean {
  if (!isCameraBarcodeSupported()) return false;
  return !isHardwareBarcodeScannerActive();
}

export function getScannerConnectionState(
  config: TerminalScannerConfig = loadTerminalScannerConfig(),
  _bridgeOnline: boolean,
  listening = false,
): ScannerConnectionState {
  if (!config.enabled) return "disabled";
  if (listening) return "listening";
  // Keyboard-wedge HID works in the renderer and in the browser — no native bridge required.
  return "connected";
}

export function rememberLastScan(code: string, config = loadTerminalScannerConfig()) {
  saveTerminalScannerConfig({
    ...config,
    lastDetectedCode: code,
    lastDetectedAt: Date.now(),
  });
}

/** Short POS confirmation beep after a successful scan. */
export function playScanSuccessBeep() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
    window.setTimeout(() => void ctx.close(), 200);
  } catch {
    /* ignore autoplay / missing audio */
  }
}

/** Ask the desktop shell to list scanner adapters / devices. */
export async function discoverScanners(): Promise<ScannerDiscoveryResult> {
  const desktop = getDesktopBridge();
  if (!desktop?.discoverDevices) {
    return {
      ok: true,
      message: "USB HID scanners type like a keyboard. Camera scanning is also available.",
      scanners: [
        {
          id: "hid-keyboard",
          label: "Keyboard HID scanner (wedge)",
          mode: "hid_keyboard",
        },
      ],
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
