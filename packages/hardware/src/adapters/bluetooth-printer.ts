import { BleClient, numbersToDataView } from "@capacitor-community/bluetooth-le";
import { Preferences } from "@capacitor/preferences";
import type { HardwareResult, PrintReceiptRequest } from "../types";
import type {
  BluetoothPrinterControls,
  BluetoothPrinterDevice,
  BluetoothPrinterStatus,
} from "../native-types";
import { friendlyHardwareMessage } from "../permissions";

const PREF_DEVICE_ID = "novend.bt.printer.deviceId";
const PREF_DEVICE_NAME = "novend.bt.printer.deviceName";
const PREF_PAPER = "novend.bt.printer.paperWidthMm";
const PREF_AUTO = "novend.bt.printer.autoReconnect";

/** Common ESC/POS BLE service/characteristic UUIDs used by many thermal printers. */
const PRINT_SERVICE_CANDIDATES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ace3c5-ffaafa00-670e5f2b",
];

let connectedId: string | null = null;
let writeChar: { service: string; characteristic: string } | null = null;
let initialized = false;

async function ensureBle(): Promise<HardwareResult> {
  try {
    if (!initialized) {
      await BleClient.initialize({ androidNeverForLocation: true });
      initialized = true;
    }
    return { ok: true };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    return {
      ok: false,
      message: friendlyHardwareMessage(
        raw,
        "Bluetooth is unavailable. Turn on Bluetooth and try again.",
      ),
    };
  }
}

async function readPrefs(): Promise<{
  deviceId: string | null;
  deviceName: string | null;
  paperWidthMm: 58 | 80;
  autoReconnect: boolean;
}> {
  const [id, name, paper, auto] = await Promise.all([
    Preferences.get({ key: PREF_DEVICE_ID }),
    Preferences.get({ key: PREF_DEVICE_NAME }),
    Preferences.get({ key: PREF_PAPER }),
    Preferences.get({ key: PREF_AUTO }),
  ]);
  const paperWidthMm = paper.value === "58" ? 58 : 80;
  return {
    deviceId: id.value,
    deviceName: name.value,
    paperWidthMm,
    autoReconnect: auto.value !== "false",
  };
}

async function resolveWriteCharacteristic(deviceId: string) {
  const services = await BleClient.getServices(deviceId);
  for (const service of services) {
    for (const characteristic of service.characteristics) {
      const props = characteristic.properties;
      if (props.write || props.writeWithoutResponse) {
        return { service: service.uuid, characteristic: characteristic.uuid };
      }
    }
  }
  // Prefer known print services when property flags are incomplete.
  for (const uuid of PRINT_SERVICE_CANDIDATES) {
    const service = services.find((s) => s.uuid.toLowerCase() === uuid.toLowerCase());
    const characteristic = service?.characteristics.find(
      (c) => c.properties.write || c.properties.writeWithoutResponse,
    );
    if (service && characteristic) {
      return { service: service.uuid, characteristic: characteristic.uuid };
    }
  }
  return null;
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function writeEscPos(deviceId: string, bytes: Uint8Array) {
  if (!writeChar) {
    writeChar = await resolveWriteCharacteristic(deviceId);
  }
  if (!writeChar) {
    throw new Error("This printer does not expose a writable Bluetooth characteristic");
  }
  const chunkSize = 180;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const slice = bytes.subarray(offset, offset + chunkSize);
    await BleClient.write(
      deviceId,
      writeChar.service,
      writeChar.characteristic,
      numbersToDataView(Array.from(slice)),
    );
  }
}

export function createBluetoothPrinterControls(): BluetoothPrinterControls {
  return {
    async getStatus() {
      const prefs = await readPrefs();
      return {
        ok: true,
        data: {
          available: true,
          connected: Boolean(connectedId && connectedId === prefs.deviceId),
          deviceId: prefs.deviceId,
          deviceName: prefs.deviceName,
          paperWidthMm: prefs.paperWidthMm,
          autoReconnect: prefs.autoReconnect,
        } satisfies BluetoothPrinterStatus,
      };
    },

    async discover() {
      const ready = await ensureBle();
      if (!ready.ok) return ready as HardwareResult<{ devices: BluetoothPrinterDevice[] }>;

      const devices: BluetoothPrinterDevice[] = [];
      const seen = new Set<string>();
      try {
        await BleClient.requestLEScan({ allowDuplicates: false }, (result) => {
          const id = result.device.deviceId;
          const name = result.device.name || result.localName || "Bluetooth printer";
          if (!id || seen.has(id)) return;
          // Prefer devices that look like printers; still keep unnamed for manual pick.
          seen.add(id);
          devices.push({ id, name });
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
          ok: false,
          message: friendlyHardwareMessage(raw, "Could not discover Bluetooth printers."),
          data: { devices: [] },
        };
      }
    },

    async connect(deviceId, deviceName) {
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
        await BleClient.connect(deviceId, () => {
          connectedId = null;
          writeChar = null;
        });
        writeChar = await resolveWriteCharacteristic(deviceId);
        connectedId = deviceId;
        await Preferences.set({ key: PREF_DEVICE_ID, value: deviceId });
        await Preferences.set({
          key: PREF_DEVICE_NAME,
          value: deviceName?.trim() || "Bluetooth printer",
        });
        return { ok: true, message: "Printer connected" };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error ?? "");
        return {
          ok: false,
          message: friendlyHardwareMessage(raw, "Could not connect to the printer."),
        };
      }
    },

    async disconnect() {
      try {
        if (connectedId) await BleClient.disconnect(connectedId);
      } catch {
        /* ignore */
      }
      connectedId = null;
      writeChar = null;
      return { ok: true };
    },

    async reconnect() {
      const prefs = await readPrefs();
      if (!prefs.deviceId) {
        return { ok: false, message: "No saved Bluetooth printer. Discover and pair one first." };
      }
      return this.connect(prefs.deviceId, prefs.deviceName ?? undefined);
    },

    async setPaperWidth(mm) {
      await Preferences.set({ key: PREF_PAPER, value: String(mm) });
      return { ok: true };
    },

    async setAutoReconnect(enabled) {
      await Preferences.set({ key: PREF_AUTO, value: enabled ? "true" : "false" });
      return { ok: true };
    },
  };
}

export async function printViaBluetooth(
  request: PrintReceiptRequest,
): Promise<HardwareResult> {
  const controls = createBluetoothPrinterControls();
  const prefs = await readPrefs();
  const deviceId = request.bluetoothDeviceId || prefs.deviceId || connectedId;
  if (!deviceId) {
    return {
      ok: false,
      message: "No Bluetooth printer selected. Open Settings → Hardware to pair one.",
    };
  }
  if (connectedId !== deviceId) {
    const connected = await controls.connect(deviceId, prefs.deviceName ?? undefined);
    if (!connected.ok) return connected;
  }
  try {
    const bytes = base64ToBytes(request.escposBase64);
    await writeEscPos(deviceId, bytes);
    return { ok: true, message: "Receipt sent to Bluetooth printer" };
  } catch (error) {
    if (prefs.autoReconnect) {
      const again = await controls.reconnect();
      if (again.ok) {
        try {
          const bytes = base64ToBytes(request.escposBase64);
          await writeEscPos(deviceId, bytes);
          return { ok: true, message: "Receipt sent to Bluetooth printer" };
        } catch {
          /* fall through */
        }
      }
    }
    const raw = error instanceof Error ? error.message : String(error ?? "");
    return {
      ok: false,
      message: friendlyHardwareMessage(raw, "Could not print to the Bluetooth printer."),
    };
  }
}

export async function bluetoothTestPrint(paperWidthMm: 58 | 80): Promise<HardwareResult> {
  // Minimal ESC/POS: init + centered title + feed + cut
  const lines = [
    "\x1b\x40",
    "\x1b\x61\x01",
    "Novend POS\n",
    "Bluetooth test print\n",
    `${paperWidthMm}mm paper\n`,
    new Date().toLocaleString(),
    "\n\n\n",
    "\x1d\x56\x00",
  ];
  const text = lines.join("");
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i += 1) bytes[i] = text.charCodeAt(i) & 0xff;
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return printViaBluetooth({
    escposBase64: btoa(binary),
    connectionType: "bluetooth",
    paperWidthMm,
    copies: 1,
    invoiceNumber: "TEST",
  });
}
