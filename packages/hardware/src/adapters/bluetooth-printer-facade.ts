import { isCapacitor } from "../platform";
import type { HardwareResult, PrintReceiptRequest } from "../types";
import type {
  BluetoothPrinterControls,
  BluetoothPrinterDevice,
  BluetoothPrinterStatus,
  BluetoothPrinterTransportKind,
} from "../native-types";

function unsupportedBluetooth(): BluetoothPrinterControls {
  const unavailable = <T>(data?: T): HardwareResult<T> => ({
    ok: false,
    code: "unsupported",
    message: "Bluetooth printing is only available in the Novend mobile app",
    data,
  });
  return {
    async getStatus() {
      return {
        ok: true,
        data: {
          available: false,
          connected: false,
          connectionState: "none",
          deviceId: null,
          deviceName: null,
          paperWidthMm: 80,
          autoReconnect: true,
          transport: "ble",
          lastError: null,
          lastErrorCode: null,
          classicAvailable: false,
        } satisfies BluetoothPrinterStatus,
      };
    },
    async discover() {
      return unavailable<{ devices: BluetoothPrinterDevice[] }>({ devices: [] });
    },
    async connect() {
      return unavailable();
    },
    async disconnect() {
      return { ok: true };
    },
    async reconnect() {
      return unavailable();
    },
    async forget() {
      return unavailable();
    },
    async setPaperWidth() {
      return unavailable();
    },
    async setAutoReconnect() {
      return unavailable();
    },
    async setTransport(_transport: BluetoothPrinterTransportKind) {
      return unavailable();
    },
    async requestBluetoothPermission() {
      return unavailable();
    },
    async openBluetoothSettings() {
      return unavailable();
    },
  };
}

let cachedControls: BluetoothPrinterControls | null = null;

export async function getBluetoothPrinterControls(): Promise<BluetoothPrinterControls> {
  if (!isCapacitor()) return unsupportedBluetooth();
  if (!cachedControls) {
    const mod = await import("./bluetooth-printer");
    cachedControls = mod.createBluetoothPrinterControls();
  }
  return cachedControls;
}

export async function printViaBluetoothSafe(request: PrintReceiptRequest): Promise<HardwareResult> {
  if (!isCapacitor()) {
    return {
      ok: false,
      code: "unsupported",
      message: "Bluetooth printing is only available in the Novend mobile app",
    };
  }
  const mod = await import("./bluetooth-printer");
  return mod.printViaBluetooth(request);
}

export async function bluetoothTestPrintSafe(paperWidthMm: 58 | 80): Promise<HardwareResult> {
  if (!isCapacitor()) {
    return {
      ok: false,
      code: "unsupported",
      message: "Bluetooth printing is only available in the Novend mobile app",
    };
  }
  const mod = await import("./bluetooth-printer");
  return mod.bluetoothTestPrint(paperWidthMm);
}
