import type { BluetoothPrinterTransportKind } from "../native-types";
import { isAndroid } from "../platform";
import { readLocalPref, removeLocalPref, writeLocalPref } from "./local-prefs";

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
  /** Default classic on Android — Cap BLE hangs on hosted origin. */
  transport: BluetoothPrinterTransportKind;
};

function parseTransport(raw: string | null): BluetoothPrinterTransportKind {
  if (raw === "classic") return "classic";
  if (raw === "ble") return "ble";
  // Unset: Classic survives hosted Cap; BLE Cap plugin often does not.
  return isAndroid() ? "classic" : "ble";
}

export async function readBluetoothPrinterProfile(): Promise<SavedBluetoothPrinterProfile> {
  return {
    deviceId: readLocalPref(PREF_DEVICE_ID),
    deviceName: readLocalPref(PREF_DEVICE_NAME),
    paperWidthMm: readLocalPref(PREF_PAPER) === "58" ? 58 : 80,
    autoReconnect: readLocalPref(PREF_AUTO) !== "false",
    transport: parseTransport(readLocalPref(PREF_TRANSPORT)),
  };
}

export async function writeBluetoothPrinterProfile(
  patch: Partial<SavedBluetoothPrinterProfile>,
): Promise<void> {
  if (patch.deviceId !== undefined) {
    if (patch.deviceId) writeLocalPref(PREF_DEVICE_ID, patch.deviceId);
    else removeLocalPref(PREF_DEVICE_ID);
  }
  if (patch.deviceName !== undefined) {
    if (patch.deviceName) writeLocalPref(PREF_DEVICE_NAME, patch.deviceName);
    else removeLocalPref(PREF_DEVICE_NAME);
  }
  if (patch.paperWidthMm !== undefined) {
    writeLocalPref(PREF_PAPER, String(patch.paperWidthMm));
  }
  if (patch.autoReconnect !== undefined) {
    writeLocalPref(PREF_AUTO, patch.autoReconnect ? "true" : "false");
  }
  if (patch.transport !== undefined) {
    writeLocalPref(PREF_TRANSPORT, patch.transport);
  }
}

export async function clearBluetoothPrinterProfile(): Promise<void> {
  removeLocalPref(PREF_DEVICE_ID);
  removeLocalPref(PREF_DEVICE_NAME);
  removeLocalPref(PREF_TRANSPORT);
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
