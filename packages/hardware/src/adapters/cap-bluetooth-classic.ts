import { registerPlugin } from "@capacitor/core";

export type ClassicBondedDevice = {
  id: string;
  name: string;
  bonded?: boolean;
  transport?: "classic";
};

type NovendBluetoothClassicPlugin = {
  checkPermissions: () => Promise<{ granted: boolean }>;
  requestPermissions: () => Promise<{ granted: boolean }>;
  listBondedDevices: () => Promise<{ devices: ClassicBondedDevice[] }>;
  connect: (options: { address: string }) => Promise<{
    connected: boolean;
    address: string;
    name: string;
  }>;
  disconnect: () => Promise<void>;
  writeEscPos: (options: { data: string }) => Promise<void>;
  getConnectionState: () => Promise<{
    connected: boolean;
    address: string | null;
    name: string | null;
  }>;
  openBluetoothSettings: () => Promise<void>;
};

export const NovendBluetoothClassic =
  registerPlugin<NovendBluetoothClassicPlugin>("NovendBluetoothClassic");
