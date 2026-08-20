/**
 * Future barcode scanner adapters (HID keyboard wedge, USB, serial, Bluetooth).
 * Scanners that emulate keyboards need no native bridge — the renderer captures keystrokes.
 * Dedicated USB/serial/Bluetooth scanners will register adapters here.
 */

export type ScannerMode = "hid_keyboard" | "usb" | "serial" | "bluetooth";

export type ScannerAdapter = {
  mode: ScannerMode;
  /** Whether this adapter can be auto-discovered on the current OS. */
  discoverable: boolean;
  list: () => Promise<Array<{ id: string; label: string }>>;
};

const hidKeyboardAdapter: ScannerAdapter = {
  mode: "hid_keyboard",
  discoverable: false,
  list: async () => [
    {
      id: "hid-keyboard",
      label: "Keyboard HID scanner (wedge) — captured in the POS UI",
    },
  ],
};

const adapters: ScannerAdapter[] = [hidKeyboardAdapter];

export function listScannerAdapters(): ScannerAdapter[] {
  return adapters;
}

export async function discoverScanners() {
  const devices: Array<{ id: string; label: string; mode: ScannerMode }> = [];
  for (const adapter of adapters) {
    const listed = await adapter.list();
    for (const item of listed) {
      devices.push({ ...item, mode: adapter.mode });
    }
  }
  return devices;
}
