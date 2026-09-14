import { Preferences } from "@capacitor/preferences";
import type { BluetoothPrinterTransportKind } from "../native-types";

export const PREF_DEVICE_ID = "novend.bt.printer.deviceId";
export const PREF_DEVICE_NAME = "novend.bt.printer.deviceName";
export const PREF_PAPER = "novend.bt.printer.paperWidthMm";
export const PREF_AUTO = "novend.bt.printer.autoReconnect";
export const PREF_TRANSPORT = "novend.bt.printer.transport";

export type SavedBluetoothPrinterProfile = {
  deviceId: string | null;
  deviceName: string | null;
  paperWidthMm: 58 | 80;
  autoReconnect: boolean;
  /** Default ble for legacy profiles that predate Classic SPP. */
  transport: BluetoothPrinterTransportKind;
};

function parseTransport(raw: string | null): BluetoothPrinterTransportKind {
  if (raw === "classic") return "classic";
  return "ble";
}

export async function readBluetoothPrinterProfile(): Promise<SavedBluetoothPrinterProfile> {
  const [id, name, paper, auto, transport] = await Promise.all([
    Preferences.get({ key: PREF_DEVICE_ID }),
    Preferences.get({ key: PREF_DEVICE_NAME }),
    Preferences.get({ key: PREF_PAPER }),
    Preferences.get({ key: PREF_AUTO }),
    Preferences.get({ key: PREF_TRANSPORT }),
  ]);
  return {
    deviceId: id.value,
    deviceName: name.value,
    paperWidthMm: paper.value === "58" ? 58 : 80,
    autoReconnect: auto.value !== "false",
    transport: parseTransport(transport.value),
  };
}

export async function writeBluetoothPrinterProfile(
  patch: Partial<SavedBluetoothPrinterProfile>,
): Promise<void> {
  const tasks: Promise<unknown>[] = [];
  if (patch.deviceId !== undefined) {
    if (patch.deviceId) {
      tasks.push(Preferences.set({ key: PREF_DEVICE_ID, value: patch.deviceId }));
    } else {
      tasks.push(Preferences.remove({ key: PREF_DEVICE_ID }));
    }
  }
  if (patch.deviceName !== undefined) {
    if (patch.deviceName) {
      tasks.push(Preferences.set({ key: PREF_DEVICE_NAME, value: patch.deviceName }));
    } else {
      tasks.push(Preferences.remove({ key: PREF_DEVICE_NAME }));
    }
  }
  if (patch.paperWidthMm !== undefined) {
    tasks.push(Preferences.set({ key: PREF_PAPER, value: String(patch.paperWidthMm) }));
  }
  if (patch.autoReconnect !== undefined) {
    tasks.push(
      Preferences.set({ key: PREF_AUTO, value: patch.autoReconnect ? "true" : "false" }),
    );
  }
  if (patch.transport !== undefined) {
    tasks.push(Preferences.set({ key: PREF_TRANSPORT, value: patch.transport }));
  }
  await Promise.all(tasks);
}

export async function clearBluetoothPrinterProfile(): Promise<void> {
  await Promise.all([
    Preferences.remove({ key: PREF_DEVICE_ID }),
    Preferences.remove({ key: PREF_DEVICE_NAME }),
    Preferences.remove({ key: PREF_TRANSPORT }),
  ]);
}

/** Pure helper — used by unit tests and mobile paper-width resolution. */
export function resolveMobilePaperWidthMm(args: {
  savedPaperWidthMm?: 58 | 80 | null;
  templatePaperWidthMm?: 58 | 80 | null;
}): 58 | 80 {
  if (args.savedPaperWidthMm === 58 || args.savedPaperWidthMm === 80) {
    return args.savedPaperWidthMm;
  }
  if (args.templatePaperWidthMm === 58 || args.templatePaperWidthMm === 80) {
    return args.templatePaperWidthMm;
  }
  return 80;
}
