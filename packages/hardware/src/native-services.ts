import { isCapacitor } from "./platform";
import type { HardwareResult } from "./types";
import type {
  AppInfo,
  AppUrlOpenHandle,
  BiometricAvailability,
  NotificationTopic,
  UpdateInfo,
} from "./native-types";

function unsupported<T = void>(feature = "This feature"): HardwareResult<T> {
  return { ok: false, message: `${feature} is only available in the Novend mobile app` };
}

/** Cap plugins stay out of the web/Electron module graph until native runtime. */
async function capServices() {
  return import("./adapters/cap-services");
}

async function bluetoothFacade() {
  return import("./adapters/bluetooth-printer-facade");
}

export const biometrics = {
  checkAvailability: async (): Promise<HardwareResult<BiometricAvailability>> => {
    if (!isCapacitor()) return unsupported("Biometrics");
    const mod = await capServices();
    return mod.createCapacitorBiometricsAdapter().checkAvailability();
  },
  authenticate: async (reason: string) => {
    if (!isCapacitor()) return unsupported("Biometrics");
    const mod = await capServices();
    return mod.createCapacitorBiometricsAdapter().authenticate(reason);
  },
  getPrefs: async () => {
    if (!isCapacitor()) return { enabled: false, requireOnLaunch: false };
    try {
      const mod = await capServices();
      return await mod.getBiometricPrefs();
    } catch {
      return { enabled: false, requireOnLaunch: false };
    }
  },
  setEnabled: async (enabled: boolean) => {
    if (!isCapacitor()) return unsupported();
    const mod = await capServices();
    return mod.setBiometricEnabled(enabled);
  },
  setRequireOnLaunch: async (require: boolean) => {
    if (!isCapacitor()) return unsupported();
    const mod = await capServices();
    return mod.setBiometricRequireOnLaunch(require);
  },
  storeUnlockToken: async (token: string) => {
    if (!isCapacitor()) return unsupported();
    const mod = await capServices();
    return mod.storeBiometricUnlockToken(token);
  },
  readUnlockToken: async () => {
    if (!isCapacitor()) return { ok: true as const, data: null };
    const mod = await capServices();
    return mod.readBiometricUnlockToken();
  },
};

export const secureStorage = {
  get: async (key: string) => {
    if (!isCapacitor()) return unsupported<string | null>("Secure storage");
    const mod = await capServices();
    return mod.createCapacitorSecureStorageAdapter().get(key);
  },
  set: async (key: string, value: string) => {
    if (!isCapacitor()) return unsupported("Secure storage");
    const mod = await capServices();
    return mod.createCapacitorSecureStorageAdapter().set(key, value);
  },
  remove: async (key: string) => {
    if (!isCapacitor()) return unsupported("Secure storage");
    const mod = await capServices();
    return mod.createCapacitorSecureStorageAdapter().remove(key);
  },
};

export const notifications = {
  checkPermissions: async () => {
    if (!isCapacitor()) return unsupported<{ granted: boolean }>("Notifications");
    const mod = await capServices();
    return mod.createCapacitorNotificationsAdapter().checkPermissions();
  },
  requestPermissions: async () => {
    if (!isCapacitor()) return unsupported<{ granted: boolean }>("Notifications");
    const mod = await capServices();
    return mod.createCapacitorNotificationsAdapter().requestPermissions();
  },
  scheduleLocal: async (args: { title: string; body: string; id?: number }) => {
    if (!isCapacitor()) return unsupported("Notifications");
    const mod = await capServices();
    return mod.createCapacitorNotificationsAdapter().scheduleLocal(args);
  },
  getTopicPrefs: async () => {
    if (!isCapacitor()) {
      return {
        ok: true as const,
        data: {
          stock_alerts: false,
          daily_summary: false,
          branch_transfers: false,
          subscription_alerts: false,
        } as Record<NotificationTopic, boolean>,
      };
    }
    const mod = await capServices();
    return mod.createCapacitorNotificationsAdapter().getTopicPrefs();
  },
  setTopicPrefs: async (prefs: Partial<Record<NotificationTopic, boolean>>) => {
    if (!isCapacitor()) return unsupported("Notifications");
    const mod = await capServices();
    return mod.createCapacitorNotificationsAdapter().setTopicPrefs(prefs);
  },
};

export const appServices = {
  getInfo: async (): Promise<HardwareResult<AppInfo>> => {
    if (!isCapacitor()) {
      return {
        ok: true,
        data: {
          name: "Novend POS",
          id: "web",
          build: "web",
          version: "0.2.0",
        },
      };
    }
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().getInfo();
  },
  getLaunchUrl: async () => {
    if (!isCapacitor()) return { ok: true as const, data: null };
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().getLaunchUrl();
  },
  openExternalUrl: async (url: string) => {
    if (!isCapacitor()) {
      window.open(url, "_blank", "noopener,noreferrer");
      return { ok: true as const };
    }
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().openExternalUrl(url);
  },
  checkForUpdate: async (): Promise<HardwareResult<UpdateInfo>> => {
    if (!isCapacitor()) return { ok: true, data: { available: false } };
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().checkForUpdate();
  },
  openStoreListing: async () => {
    if (!isCapacitor()) return unsupported();
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().openStoreListing();
  },
  addUrlOpenListener: async (callback: (url: string) => void): Promise<AppUrlOpenHandle> => {
    if (!isCapacitor()) {
      return { remove: async () => undefined };
    }
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().addUrlOpenListener(callback);
  },
};

/** Lazy Bluetooth controls — BLE package never loads on web/Electron. */
export const bluetoothPrinter = {
  getStatus: async () => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.getStatus();
  },
  discover: async () => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.discover();
  },
  connect: async (deviceId: string, deviceName?: string) => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.connect(deviceId, deviceName);
  },
  disconnect: async () => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.disconnect();
  },
  reconnect: async () => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.reconnect();
  },
  setPaperWidth: async (mm: 58 | 80) => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.setPaperWidth(mm);
  },
  setAutoReconnect: async (enabled: boolean) => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.setAutoReconnect(enabled);
  },
};
