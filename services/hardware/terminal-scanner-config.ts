/** Per-terminal barcode scanner settings (device-local — not synced to Convex). */

export type TerminalScannerConfig = {
  /** When false, POS ignores keyboard-wedge and native scan events. */
  enabled: boolean;
  /** Preferred discovered device id (`scanner:hid_keyboard:hid-keyboard`, …). */
  deviceId: string;
  /** Human-readable label for the selected device. */
  deviceLabel: string;
  lastDetectedCode?: string;
  lastDetectedAt?: number;
};

export const DEFAULT_TERMINAL_SCANNER_CONFIG: TerminalScannerConfig = {
  enabled: true,
  deviceId: "scanner:hid_keyboard:hid-keyboard",
  deviceLabel: "Keyboard HID scanner (wedge)",
};

const STORAGE_KEY = "novend.terminal.scanner";

export function loadTerminalScannerConfig(): TerminalScannerConfig {
  if (typeof window === "undefined") return { ...DEFAULT_TERMINAL_SCANNER_CONFIG };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_TERMINAL_SCANNER_CONFIG };
    const parsed = JSON.parse(raw) as Partial<TerminalScannerConfig>;
    return {
      enabled: parsed.enabled !== false,
      deviceId:
        typeof parsed.deviceId === "string" && parsed.deviceId.trim()
          ? parsed.deviceId
          : DEFAULT_TERMINAL_SCANNER_CONFIG.deviceId,
      deviceLabel:
        typeof parsed.deviceLabel === "string" && parsed.deviceLabel.trim()
          ? parsed.deviceLabel
          : DEFAULT_TERMINAL_SCANNER_CONFIG.deviceLabel,
      lastDetectedCode:
        typeof parsed.lastDetectedCode === "string" ? parsed.lastDetectedCode : undefined,
      lastDetectedAt:
        typeof parsed.lastDetectedAt === "number" ? parsed.lastDetectedAt : undefined,
    };
  } catch {
    return { ...DEFAULT_TERMINAL_SCANNER_CONFIG };
  }
}

export function saveTerminalScannerConfig(config: TerminalScannerConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
