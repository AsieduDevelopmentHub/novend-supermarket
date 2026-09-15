import { Capacitor } from "@capacitor/core";
import { isAndroid } from "../platform";
import type { HardwareResult } from "../types";
import type { BluetoothPrinterDevice } from "../native-types";
import { NATIVE_SPP_TIMEOUT_MS, isNativeTimeoutError, withTimeout } from "../timeout";
import { NovendBluetoothClassic } from "./cap-bluetooth-classic";
import {
  hasNovendNativeClassicBluetooth,
  nativeClassicConnect,
  nativeClassicDisconnect,
  nativeClassicIsConnected,
  nativeClassicListBonded,
  nativeClassicOpenBluetoothSettings,
  nativeClassicWriteEscPos,
  openNativeAppDetailsSettings,
} from "./novend-native-app";
import {
  type BluetoothPrinterTransport,
  bytesToBase64,
  mapBluetoothFailure,
} from "./bluetooth-transport";

let connectedId: string | null = null;

function pluginError(error: unknown, fallback: string, code: "write_failed" = "write_failed") {
  if (isNativeTimeoutError(error)) {
    return {
      ok: false as const,
      code: "out_of_range" as const,
      message: "Connecting to the printer timed out. Keep it nearby and try again.",
    };
  }
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : error instanceof Error
        ? error.message
        : String(error ?? "");
  const codeFromPlugin =
    error && typeof error === "object" && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  if (
    codeFromPlugin === "permission" ||
    codeFromPlugin === "bluetooth_off" ||
    codeFromPlugin === "not_paired" ||
    codeFromPlugin === "out_of_range" ||
    codeFromPlugin === "unsupported" ||
    codeFromPlugin === "write_failed" ||
    codeFromPlugin === "cancelled"
  ) {
    return mapBluetoothFailure(raw || fallback, fallback, codeFromPlugin);
  }
  return mapBluetoothFailure(raw, fallback, code);
}

/** Prefer UA / NovendCapacitor detection — Capacitor.getPlatform can lie after remote load. */
export function isClassicBluetoothAvailable(): boolean {
  if (isAndroid()) return true;
  try {
    return Capacitor.getPlatform() === "android";
  } catch {
    return false;
  }
}

function preferNativeClassicBridge(): boolean {
  return hasNovendNativeClassicBluetooth();
}

export function createClassicPrinterTransport(): BluetoothPrinterTransport {
  return {
    kind: "classic",

    isConnected(deviceId) {
      if (preferNativeClassicBridge()) return nativeClassicIsConnected(deviceId);
      return Boolean(connectedId && connectedId === deviceId);
    },

    async discover() {
      if (!isClassicBluetoothAvailable()) {
        return {
          ok: false,
          code: "unsupported",
          message: "Classic Bluetooth printing is available on Android tablets and phones.",
          data: { devices: [] },
        };
      }
      if (preferNativeClassicBridge()) {
        const listed = nativeClassicListBonded();
        if (!listed.ok && listed.code === "permission") {
          openNativeAppDetailsSettings();
        }
        return listed;
      }
      try {
        const permission = await withTimeout(
          NovendBluetoothClassic.requestPermissions(),
          NATIVE_SPP_TIMEOUT_MS,
        );
        if (!permission.granted) {
          return {
            ok: false,
            code: "permission",
            message: "Allow Nearby devices / Bluetooth access for Novend, then try again.",
            data: { devices: [] },
          };
        }
        const listed = await withTimeout(
          NovendBluetoothClassic.listBondedDevices(),
          NATIVE_SPP_TIMEOUT_MS,
        );
        const devices: BluetoothPrinterDevice[] = (listed.devices ?? []).map((device) => ({
          id: device.id,
          name: device.name?.trim() || device.id,
          bonded: true,
          transport: "classic" as const,
        }));
        return { ok: true, data: { devices } };
      } catch (error) {
        return {
          ...pluginError(error, "Could not list paired Bluetooth printers."),
          data: { devices: [] },
        };
      }
    },

    async connect(deviceId) {
      if (!isClassicBluetoothAvailable()) {
        return {
          ok: false,
          code: "unsupported",
          message: "Classic Bluetooth printing is available on Android tablets and phones.",
        };
      }
      if (preferNativeClassicBridge()) {
        if (connectedId && connectedId !== deviceId) {
          nativeClassicDisconnect();
          connectedId = null;
        }
        const result = nativeClassicConnect(deviceId);
        if (!result.ok) {
          if (result.code === "permission") openNativeAppDetailsSettings();
          connectedId = null;
          return result;
        }
        connectedId = deviceId;
        return result;
      }
      try {
        const permission = await withTimeout(
          NovendBluetoothClassic.requestPermissions(),
          NATIVE_SPP_TIMEOUT_MS,
        );
        if (!permission.granted) {
          return {
            ok: false,
            code: "permission",
            message: "Allow Nearby devices / Bluetooth access for Novend, then try again.",
          };
        }
        if (connectedId && connectedId !== deviceId) {
          try {
            await NovendBluetoothClassic.disconnect();
          } catch {
            /* ignore */
          }
          connectedId = null;
        }
        await withTimeout(
          NovendBluetoothClassic.connect({ address: deviceId }),
          NATIVE_SPP_TIMEOUT_MS,
        );
        connectedId = deviceId;
        return { ok: true, message: "Printer connected" };
      } catch (error) {
        connectedId = null;
        return pluginError(error, "Could not connect to the printer.", "write_failed");
      }
    },

    async disconnect() {
      if (preferNativeClassicBridge()) {
        nativeClassicDisconnect();
        connectedId = null;
        return { ok: true };
      }
      try {
        await NovendBluetoothClassic.disconnect();
      } catch {
        /* ignore */
      }
      connectedId = null;
      return { ok: true };
    },

    async writeEscPos(deviceId, bytes) {
      if (!this.isConnected(deviceId)) {
        const connected = await this.connect(deviceId);
        if (!connected.ok) return connected;
      }
      if (preferNativeClassicBridge()) {
        const result = nativeClassicWriteEscPos(bytesToBase64(bytes));
        if (!result.ok) connectedId = null;
        return result;
      }
      try {
        await withTimeout(
          NovendBluetoothClassic.writeEscPos({ data: bytesToBase64(bytes) }),
          NATIVE_SPP_TIMEOUT_MS,
        );
        return { ok: true, message: "Receipt sent to Bluetooth printer" };
      } catch (error) {
        connectedId = null;
        return pluginError(error, "Could not print to the Bluetooth printer.");
      }
    },
  };
}

export async function openClassicBluetoothSettings(): Promise<HardwareResult> {
  if (!isClassicBluetoothAvailable()) {
    return {
      ok: false,
      code: "unsupported",
      message: "Open Bluetooth settings on this device to pair a printer.",
    };
  }
  if (preferNativeClassicBridge()) {
    return nativeClassicOpenBluetoothSettings();
  }
  try {
    await NovendBluetoothClassic.openBluetoothSettings();
    return { ok: true };
  } catch (error) {
    return pluginError(error, "Could not open Bluetooth settings.");
  }
}
