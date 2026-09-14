import { BleClient, numbersToDataView } from "@capacitor-community/bluetooth-le";
import type { HardwareResult } from "../types";
import type { BluetoothPrinterDevice } from "../native-types";
import { friendlyHardwareMessage } from "../permissions";
import { NATIVE_BLE_TIMEOUT_MS, isNativeTimeoutError, withTimeout } from "../timeout";
import {
  type BluetoothPrinterTransport,
  mapBluetoothFailure,
} from "./bluetooth-transport";

/** Common ESC/POS BLE service/characteristic UUIDs used by many thermal printers. */
const PRINT_SERVICE_CANDIDATES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ace3c5-ffaafa00-670e5f2b",
];

type WriteTarget = {
  service: string;
  characteristic: string;
  writeWithoutResponse: boolean;
};

let connectedId: string | null = null;
let writeTarget: WriteTarget | null = null;
let initialized = false;

async function ensureBle(): Promise<HardwareResult> {
  try {
    if (!initialized) {
      await withTimeout(
        BleClient.initialize({ androidNeverForLocation: true }),
        NATIVE_BLE_TIMEOUT_MS,
      );
      initialized = true;
    }
    return { ok: true };
  } catch (error) {
    if (isNativeTimeoutError(error)) {
      return {
        ok: false,
        code: "bluetooth_off",
        message: "Bluetooth took too long to start. Turn it on and try again.",
      };
    }
    const raw = error instanceof Error ? error.message : String(error ?? "");
    return mapBluetoothFailure(
      raw,
      "Bluetooth is unavailable. Turn on Bluetooth and try again.",
      "bluetooth_off",
    );
  }
}

async function resolveWriteCharacteristic(deviceId: string): Promise<WriteTarget | null> {
  const services = await BleClient.getServices(deviceId);
  for (const service of services) {
    for (const characteristic of service.characteristics) {
      const props = characteristic.properties;
      if (props.write || props.writeWithoutResponse) {
        return {
          service: service.uuid,
          characteristic: characteristic.uuid,
          writeWithoutResponse: Boolean(props.writeWithoutResponse && !props.write),
        };
      }
    }
  }
  for (const uuid of PRINT_SERVICE_CANDIDATES) {
    const service = services.find((s) => s.uuid.toLowerCase() === uuid.toLowerCase());
    const characteristic = service?.characteristics.find(
      (c) => c.properties.write || c.properties.writeWithoutResponse,
    );
    if (service && characteristic) {
      const props = characteristic.properties;
      return {
        service: service.uuid,
        characteristic: characteristic.uuid,
        writeWithoutResponse: Boolean(props.writeWithoutResponse && !props.write),
      };
    }
  }
  return null;
}

export function createBlePrinterTransport(): BluetoothPrinterTransport {
  return {
    kind: "ble",

    isConnected(deviceId) {
      return Boolean(connectedId && connectedId === deviceId);
    },

    async discover() {
      const ready = await ensureBle();
      if (!ready.ok) return ready as HardwareResult<{ devices: BluetoothPrinterDevice[] }>;

      try {
        const picker = BleClient as typeof BleClient & {
          requestDevice?: (options?: {
            optionalServices?: string[];
          }) => Promise<{ deviceId: string; name?: string }>;
        };
        if (typeof picker.requestDevice === "function") {
          const device = await picker.requestDevice({
            optionalServices: PRINT_SERVICE_CANDIDATES,
          });
          if (device?.deviceId) {
            return {
              ok: true,
              data: {
                devices: [
                  {
                    id: device.deviceId,
                    name: device.name?.trim() || "Bluetooth printer",
                    transport: "ble",
                  },
                ],
              },
            };
          }
        }
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        if (/cancel/i.test(raw)) {
          return { ok: false, code: "cancelled", message: "Cancelled", data: { devices: [] } };
        }
      }

      const devices: BluetoothPrinterDevice[] = [];
      const seen = new Set<string>();
      try {
        await BleClient.requestLEScan({ allowDuplicates: false }, (result) => {
          const id = result.device.deviceId;
          const name = result.device.name || result.localName || "Bluetooth printer";
          if (!id || seen.has(id)) return;
          seen.add(id);
          devices.push({ id, name, transport: "ble" });
        });
        await new Promise((r) => setTimeout(r, 4500));
        await BleClient.stopLEScan();
        return { ok: true, data: { devices } };
      } catch (error) {
        try {
          await BleClient.stopLEScan();
        } catch {
          /* ignore */
        }
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ...mapBluetoothFailure(raw, "Could not discover Bluetooth printers."),
          data: { devices: [] },
        };
      }
    },

    async connect(deviceId, deviceName) {
      void deviceName;
      const ready = await ensureBle();
      if (!ready.ok) return ready;
      try {
        if (connectedId && connectedId !== deviceId) {
          try {
            await BleClient.disconnect(connectedId);
          } catch {
            /* ignore */
          }
        }
        await withTimeout(
          BleClient.connect(deviceId, () => {
            connectedId = null;
            writeTarget = null;
          }),
          NATIVE_BLE_TIMEOUT_MS,
        );
        writeTarget = await resolveWriteCharacteristic(deviceId);
        if (!writeTarget) {
          try {
            await BleClient.disconnect(deviceId);
          } catch {
            /* ignore */
          }
          connectedId = null;
          return {
            ok: false,
            code: "unsupported",
            message: "This printer does not expose a writable Bluetooth characteristic.",
          };
        }
        connectedId = deviceId;
        return { ok: true, message: "Printer connected" };
      } catch (error) {
        if (isNativeTimeoutError(error)) {
          return {
            ok: false,
            code: "out_of_range",
            message: "Connecting to the printer timed out. Keep it nearby and try again.",
          };
        }
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return mapBluetoothFailure(raw, "Could not connect to the printer.", "out_of_range");
      }
    },

    async disconnect() {
      try {
        if (connectedId) await BleClient.disconnect(connectedId);
      } catch {
        /* ignore */
      }
      connectedId = null;
      writeTarget = null;
      return { ok: true };
    },

    async writeEscPos(deviceId, bytes) {
      if (!writeTarget || connectedId !== deviceId) {
        const connected = await this.connect(deviceId);
        if (!connected.ok) return connected;
      }
      if (!writeTarget) {
        return {
          ok: false,
          code: "unsupported",
          message: "This printer does not expose a writable Bluetooth characteristic.",
        };
      }
      try {
        const chunkSize = 180;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          const slice = bytes.subarray(offset, offset + chunkSize);
          const view = numbersToDataView(Array.from(slice));
          if (writeTarget.writeWithoutResponse) {
            await BleClient.writeWithoutResponse(
              deviceId,
              writeTarget.service,
              writeTarget.characteristic,
              view,
            );
          } else {
            await BleClient.write(
              deviceId,
              writeTarget.service,
              writeTarget.characteristic,
              view,
            );
          }
        }
        return { ok: true, message: "Receipt sent to Bluetooth printer" };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        writeTarget = null;
        return mapBluetoothFailure(
          friendlyHardwareMessage(raw, "Could not print to the Bluetooth printer."),
          "Could not print to the Bluetooth printer.",
          "write_failed",
        );
      }
    },
  };
}
