import { Hardware, getElectronBridge, isCapacitor, isElectron } from "@novend/hardware";
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

const HID_FALLBACK_SCANNERS: DiscoveredScanner[] = [
  {
    id: "hid-keyboard",
    label: "Keyboard HID scanner (wedge)",
    mode: "hid_keyboard",
  },
];

export function isBarcodeScanningEnabled(config = loadTerminalScannerConfig()): boolean {
  return config.enabled;
}

/** Hardware wedge/USB scanner is active — POS listens in the background (no camera button). */
export function isHardwareBarcodeScannerActive(config = loadTerminalScannerConfig()): boolean {
  return config.enabled;
}

/** Camera scan button — native on Capacitor; web/PWA when no HID scanner is configured. */
export function shouldShowCameraBarcodeButton(): boolean {
  if (isCapacitor()) return true;
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
    const AudioCtx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

type DiscoverPayload = {
  devices?: Array<{
    id: string;
    kind: string;
    label: string;
    meta?: Record<string, unknown>;
  }>;
};

/** Ask the desktop shell to list scanner adapters / devices. */
export async function discoverScanners(): Promise<ScannerDiscoveryResult> {
  if (!isElectron()) {
    return {
      ok: true,
      message: "USB HID scanners type like a keyboard. Camera scanning is also available.",
      scanners: HID_FALLBACK_SCANNERS,
      bridgeOnline: false,
    };
  }

  const result = await Hardware.barcode.discover();
  const payload = (result.data ?? {}) as DiscoverPayload;
  const scanners = (payload.devices ?? [])
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
}

export async function probeScannerBridge(): Promise<{
  ok: boolean;
  version?: string;
  platform?: string;
}> {
  const desktop = getElectronBridge<{
    getRuntime: () => Promise<{ version: string; platform: string }>;
  }>();
  if (!desktop?.getRuntime) return { ok: false };
  try {
    const runtime = await desktop.getRuntime();
    return { ok: true, version: runtime.version, platform: runtime.platform };
  } catch {
    return { ok: false };
  }
}
