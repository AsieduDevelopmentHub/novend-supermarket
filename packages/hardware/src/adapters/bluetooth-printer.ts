import type { HardwareResult, PrintReceiptRequest } from "../types";
import type {
  BluetoothDiscoverOptions,
  BluetoothPrinterConnectionState,
  BluetoothPrinterControls,
  BluetoothPrinterStatus,
  BluetoothPrinterTransportKind,
} from "../native-types";
import {
  clearBluetoothPrinterProfile,
  readBluetoothPrinterProfile,
  writeBluetoothPrinterProfile,
} from "./bluetooth-profile";
import { base64ToBytes } from "./bluetooth-transport";
import { createBlePrinterTransport } from "./bluetooth-transport-ble";
import {
  createClassicPrinterTransport,
  isClassicBluetoothAvailable,
  openClassicBluetoothSettings,
  requestClassicBluetoothPermission,
} from "./bluetooth-transport-classic";
import type { BluetoothPrinterTransport } from "./bluetooth-transport";

let lastError: string | null = null;
let lastErrorCode: BluetoothPrinterStatus["lastErrorCode"] = null;
let connectionState: BluetoothPrinterConnectionState = "none";
let printQueue: Promise<void> = Promise.resolve();

function transportFor(kind: BluetoothPrinterTransportKind): BluetoothPrinterTransport {
  return kind === "classic" ? createClassicPrinterTransport() : createBlePrinterTransport();
}

function deriveConnectionState(args: {
  deviceId: string | null;
  connected: boolean;
  reconnecting?: boolean;
  connecting?: boolean;
}): BluetoothPrinterConnectionState {
  if (args.reconnecting) return "reconnecting";
  if (args.connecting) return "connecting";
  if (args.connected) return "connected";
  if (args.deviceId) return lastError ? "needs_attention" : "saved";
  return "none";
}

async function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const previous = printQueue;
  let release!: () => void;
  printQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous.catch(() => undefined);
  try {
    return await operation();
  } finally {
    release();
  }
}

export function createBluetoothPrinterControls(): BluetoothPrinterControls {
  return {
    async getStatus() {
      const prefs = await readBluetoothPrinterProfile();
      const transport = transportFor(prefs.transport);
      const connected = Boolean(prefs.deviceId && transport.isConnected(prefs.deviceId));
      connectionState = deriveConnectionState({
        deviceId: prefs.deviceId,
        connected,
      });
      return {
        ok: true,
        data: {
          available: true,
          connected,
          connectionState,
          deviceId: prefs.deviceId,
          deviceName: prefs.deviceName,
          paperWidthMm: prefs.paperWidthMm,
          autoReconnect: prefs.autoReconnect,
          transport: prefs.transport,
          lastError,
          lastErrorCode,
          classicAvailable: isClassicBluetoothAvailable(),
        } satisfies BluetoothPrinterStatus,
      };
    },

    async discover(options?: BluetoothDiscoverOptions) {
      const prefs = await readBluetoothPrinterProfile();
      const kind = options?.transport ?? prefs.transport;
      if (kind === "classic" && !isClassicBluetoothAvailable()) {
        return {
          ok: false,
          code: "unsupported",
          message: "Classic Bluetooth printing is available on Android tablets and phones.",
          data: { devices: [] },
        };
      }
      const transport = transportFor(kind);
      return transport.discover();
    },

    async connect(deviceId, deviceName, transportKind) {
      const prefs = await readBluetoothPrinterProfile();
      const kind = transportKind ?? prefs.transport;
      if (kind === "classic" && !isClassicBluetoothAvailable()) {
        return {
          ok: false,
          code: "unsupported",
          message: "Classic Bluetooth printing is available on Android tablets and phones.",
        };
      }
      connectionState = "connecting";
      const other = transportFor(kind === "classic" ? "ble" : "classic");
      await other.disconnect();
      const transport = transportFor(kind);
      const result = await transport.connect(deviceId, deviceName);
      if (!result.ok) {
        lastError = result.message ?? "Could not connect to the printer.";
        lastErrorCode = result.code ?? "out_of_range";
        connectionState = "needs_attention";
        return result;
      }
      await writeBluetoothPrinterProfile({
        deviceId,
        deviceName: deviceName?.trim() || "Bluetooth printer",
        transport: kind,
      });
      lastError = null;
      lastErrorCode = null;
      connectionState = "connected";
      return { ok: true, message: "Printer connected" };
    },

    async disconnect() {
      const prefs = await readBluetoothPrinterProfile();
      await transportFor(prefs.transport).disconnect();
      connectionState = prefs.deviceId ? "saved" : "none";
      return { ok: true };
    },

    async reconnect() {
      const prefs = await readBluetoothPrinterProfile();
      if (!prefs.deviceId) {
        return {
          ok: false,
          code: "not_paired",
          message: "No saved Bluetooth printer. Discover and pair one first.",
        };
      }
      connectionState = "reconnecting";
      return this.connect(prefs.deviceId, prefs.deviceName ?? undefined, prefs.transport);
    },

    async forget() {
      const prefs = await readBluetoothPrinterProfile();
      await transportFor(prefs.transport).disconnect();
      await clearBluetoothPrinterProfile();
      lastError = null;
      lastErrorCode = null;
      connectionState = "none";
      return { ok: true };
    },

    async setPaperWidth(mm) {
      await writeBluetoothPrinterProfile({ paperWidthMm: mm });
      return { ok: true };
    },

    async setAutoReconnect(enabled) {
      await writeBluetoothPrinterProfile({ autoReconnect: enabled });
      return { ok: true };
    },

    async setTransport(transport) {
      if (transport === "classic" && !isClassicBluetoothAvailable()) {
        return {
          ok: false,
          code: "unsupported",
          message: "Classic Bluetooth printing is available on Android tablets and phones.",
        };
      }
      const prefs = await readBluetoothPrinterProfile();
      if (prefs.transport !== transport) {
        await transportFor(prefs.transport).disconnect();
        await writeBluetoothPrinterProfile({
          transport,
          deviceId: null,
          deviceName: null,
        });
        lastError = null;
        lastErrorCode = null;
        connectionState = "none";
      } else {
        await writeBluetoothPrinterProfile({ transport });
      }
      return { ok: true };
    },

    async openBluetoothSettings() {
      return openClassicBluetoothSettings();
    },

    async requestBluetoothPermission() {
      return requestClassicBluetoothPermission();
    },
  };
}

export async function printViaBluetooth(request: PrintReceiptRequest): Promise<HardwareResult> {
  return runSerialized(async () => {
    const controls = createBluetoothPrinterControls();
    const prefs = await readBluetoothPrinterProfile();
    const deviceId = request.bluetoothDeviceId || prefs.deviceId;
    if (!deviceId) {
      return {
        ok: false,
        code: "not_paired",
        message: "No Bluetooth printer selected. Open Settings → Hardware to pair one.",
      };
    }
    const transport = transportFor(prefs.transport);
    const ensureConnected = async (reconnecting: boolean) => {
      if (transport.isConnected(deviceId)) return { ok: true as const };
      connectionState = reconnecting ? "reconnecting" : "connecting";
      return controls.connect(deviceId, prefs.deviceName ?? undefined, prefs.transport);
    };

    let connected = await ensureConnected(false);
    if (!connected.ok && prefs.autoReconnect) {
      connected = await ensureConnected(true);
    }
    if (!connected.ok) {
      lastError = connected.message ?? "Could not connect to the printer.";
      lastErrorCode = connected.code ?? "out_of_range";
      connectionState = "needs_attention";
      return connected;
    }

    const bytes = base64ToBytes(request.escposBase64);
    let written = await transport.writeEscPos(deviceId, bytes);
    if (!written.ok && prefs.autoReconnect) {
      connectionState = "reconnecting";
      const again = await controls.reconnect();
      if (again.ok) {
        written = await transport.writeEscPos(deviceId, bytes);
      }
    }
    if (!written.ok) {
      lastError = written.message ?? "Could not print to the Bluetooth printer.";
      lastErrorCode = written.code ?? "write_failed";
      connectionState = "needs_attention";
      return written;
    }
    lastError = null;
    lastErrorCode = null;
    connectionState = "connected";
    return { ok: true, message: "Receipt sent to Bluetooth printer" };
  });
}

export async function bluetoothTestPrint(paperWidthMm: 58 | 80): Promise<HardwareResult> {
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
