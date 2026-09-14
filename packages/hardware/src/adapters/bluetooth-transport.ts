import type { BluetoothPrintErrorCode, HardwareResult } from "../types";
import type {
  BluetoothPrinterDevice,
  BluetoothPrinterTransportKind,
} from "../native-types";

export type BluetoothPrinterTransport = {
  kind: BluetoothPrinterTransportKind;
  discover: () => Promise<HardwareResult<{ devices: BluetoothPrinterDevice[] }>>;
  connect: (deviceId: string, deviceName?: string) => Promise<HardwareResult>;
  disconnect: () => Promise<HardwareResult>;
  writeEscPos: (deviceId: string, bytes: Uint8Array) => Promise<HardwareResult>;
  isConnected: (deviceId: string) => boolean;
};

export function mapBluetoothFailure(
  raw: string | undefined,
  fallback: string,
  code: BluetoothPrintErrorCode = "write_failed",
): HardwareResult {
  const lower = (raw ?? "").toLowerCase();
  if (/cancel/i.test(lower)) {
    return { ok: false, code: "cancelled", message: "Cancelled" };
  }
  if (/permission|denied|not authorized|nearby devices/i.test(lower)) {
    return {
      ok: false,
      code: "permission",
      message: "Allow Nearby devices / Bluetooth access for Novend, then try again.",
    };
  }
  if (/bluetooth.*(off|disabled|not enabled)|adapter.*null/i.test(lower)) {
    return {
      ok: false,
      code: "bluetooth_off",
      message: "Turn on Bluetooth and try again.",
    };
  }
  if (/not bonded|not paired|bond/i.test(lower)) {
    return {
      ok: false,
      code: "not_paired",
      message: "Pair the printer in Android Bluetooth settings, then choose it here.",
    };
  }
  if (/timeout|out of range|unreachable|connection.*fail|socket/i.test(lower)) {
    return {
      ok: false,
      code: "out_of_range",
      message: "Could not reach the printer. Keep it nearby and powered on.",
    };
  }
  if (/unsupported|characteristic|spp|rfcomm|not available on ios/i.test(lower)) {
    return {
      ok: false,
      code: "unsupported",
      message: raw && !/exception|nullpointer|ecode/i.test(raw) ? raw : fallback,
    };
  }
  return {
    ok: false,
    code,
    message:
      raw && !/capacitor|plugin|exception|nullpointer|ecode/i.test(raw) ? raw : fallback,
  };
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
