import { isCapacitor } from "../platform";
import type { BluetoothPrintErrorCode, HardwareResult } from "../types";
import type { AppInfo, BluetoothPrinterDevice } from "../native-types";
import { mapBluetoothFailure } from "./bluetooth-transport";

function asBtCode(code: string | undefined): BluetoothPrintErrorCode | undefined {
  if (
    code === "permission" ||
    code === "bluetooth_off" ||
    code === "not_paired" ||
    code === "out_of_range" ||
    code === "unsupported" ||
    code === "write_failed" ||
    code === "cancelled"
  ) {
    return code;
  }
  return undefined;
}

type NovendNativeAppBridge = {
  appInfo?: () => string;
  openAppDetailsSettings?: () => boolean;
  classicRequestBluetoothPermission?: () => string;
  classicListBondedPrinters?: () => string;
  classicConnect?: (address: string) => string;
  classicDisconnect?: () => void;
  classicWriteEscPos?: (base64: string) => string;
  classicOpenBluetoothSettings?: () => boolean;
  classicIsConnected?: (address: string) => boolean;
};

function nativeBridge(): NovendNativeAppBridge | null {
  if (typeof window === "undefined" || !isCapacitor()) return null;
  const bridge = (window as Window & { NovendNative?: NovendNativeAppBridge }).NovendNative;
  return bridge ?? null;
}

export function hasNovendNativeAppInfo(): boolean {
  const bridge = nativeBridge();
  return Boolean(bridge && typeof bridge.appInfo === "function");
}

export function hasNovendNativeClassicBluetooth(): boolean {
  const bridge = nativeBridge();
  return Boolean(bridge && typeof bridge.classicListBondedPrinters === "function");
}

export function readNativeAppInfo(): AppInfo | null {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.appInfo !== "function") return null;
  try {
    const parsed = JSON.parse(bridge.appInfo()) as {
      name?: string;
      id?: string;
      version?: string;
      build?: string;
    };
    if (!parsed.version) return null;
    return {
      name: parsed.name?.trim() || "Millie's Supermarket",
      id: parsed.id?.trim() || "com.novend.millies",
      version: parsed.version.trim(),
      build: parsed.build?.trim() || "0",
    };
  } catch {
    return null;
  }
}

export function openNativeAppDetailsSettings(): boolean {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.openAppDetailsSettings !== "function") return false;
  try {
    return bridge.openAppDetailsSettings() === true;
  } catch {
    return false;
  }
}

/**
 * System Nearby devices / Bluetooth dialog via MainActivity.
 * Never opens App Info. Returns granted when CONNECT is available.
 */
export function nativeClassicRequestBluetoothPermission(): HardwareResult {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.classicRequestBluetoothPermission !== "function") {
    return {
      ok: false,
      code: "unsupported",
      message: "Bluetooth permissions require the latest Novend Android app.",
    };
  }
  try {
    const outcome = bridge.classicRequestBluetoothPermission();
    if (outcome === "granted") {
      return { ok: true, message: "Bluetooth access allowed" };
    }
    return {
      ok: false,
      code: "permission",
      message: "Enable Bluetooth / Nearby devices for Novend, then try again.",
    };
  } catch {
    return {
      ok: false,
      code: "permission",
      message: "Enable Bluetooth / Nearby devices for Novend, then try again.",
    };
  }
}

export function nativeClassicListBonded(): HardwareResult<{ devices: BluetoothPrinterDevice[] }> {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.classicListBondedPrinters !== "function") {
    return {
      ok: false,
      code: "unsupported",
      message: "Classic Bluetooth requires the latest Novend Android app.",
      data: { devices: [] },
    };
  }
  try {
    const parsed = JSON.parse(bridge.classicListBondedPrinters()) as {
      ok?: boolean;
      code?: string;
      message?: string;
      devices?: Array<{ id?: string; name?: string }>;
    };
    const devices: BluetoothPrinterDevice[] = (parsed.devices ?? [])
      .filter((row) => Boolean(row.id))
      .map((row) => ({
        id: String(row.id),
        name: row.name?.trim() || String(row.id),
        bonded: true,
        transport: "classic" as const,
      }));
    if (parsed.ok) return { ok: true, data: { devices } };
    return {
      ...mapBluetoothFailure(
        parsed.message || "Could not list paired Bluetooth printers.",
        parsed.message || "Could not list paired Bluetooth printers.",
        asBtCode(parsed.code),
      ),
      data: { devices },
    };
  } catch {
    return {
      ok: false,
      code: "write_failed",
      message: "Could not list paired Bluetooth printers.",
      data: { devices: [] },
    };
  }
}

export function nativeClassicConnect(address: string): HardwareResult {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.classicConnect !== "function") {
    return {
      ok: false,
      code: "unsupported",
      message: "Classic Bluetooth requires the latest Novend Android app.",
    };
  }
  try {
    const outcome = bridge.classicConnect(address);
    if (outcome === "ok") return { ok: true, message: "Printer connected" };
    return mapBluetoothFailure(
      outcome,
      "Could not connect to the printer.",
      asBtCode(outcome) ?? "out_of_range",
    );
  } catch {
    return {
      ok: false,
      code: "out_of_range",
      message: "Could not connect to the printer.",
    };
  }
}

export function nativeClassicDisconnect(): void {
  const bridge = nativeBridge();
  try {
    bridge?.classicDisconnect?.();
  } catch {
    /* ignore */
  }
}

export function nativeClassicWriteEscPos(base64: string): HardwareResult {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.classicWriteEscPos !== "function") {
    return {
      ok: false,
      code: "unsupported",
      message: "Classic Bluetooth requires the latest Novend Android app.",
    };
  }
  try {
    const outcome = bridge.classicWriteEscPos(base64);
    if (outcome === "ok") return { ok: true, message: "Receipt sent to Bluetooth printer" };
    return mapBluetoothFailure(
      outcome,
      "Could not print to the Bluetooth printer.",
      asBtCode(outcome) ?? "write_failed",
    );
  } catch {
    return {
      ok: false,
      code: "write_failed",
      message: "Could not print to the Bluetooth printer.",
    };
  }
}

export function nativeClassicOpenBluetoothSettings(): HardwareResult {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.classicOpenBluetoothSettings !== "function") {
    return {
      ok: false,
      code: "unsupported",
      message: "Open Bluetooth settings on this device to pair a printer.",
    };
  }
  try {
    return bridge.classicOpenBluetoothSettings()
      ? { ok: true }
      : { ok: false, message: "Could not open Bluetooth settings." };
  } catch {
    return { ok: false, message: "Could not open Bluetooth settings." };
  }
}

export function nativeClassicIsConnected(address: string): boolean {
  const bridge = nativeBridge();
  if (!bridge || typeof bridge.classicIsConnected !== "function") return false;
  try {
    return bridge.classicIsConnected(address) === true;
  } catch {
    return false;
  }
}
