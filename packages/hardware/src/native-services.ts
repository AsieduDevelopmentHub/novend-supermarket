import { isCapacitor, isElectron, getElectronBridge } from "./platform";
import type { HardwareResult } from "./types";
import type {
  AppBackButtonHandle,
  AppInfo,
  AppUrlOpenHandle,
  BiometricAvailability,
  NotificationTopic,
  UpdateInfo,
} from "./native-types";
import { NATIVE_CALL_TIMEOUT_MS, NATIVE_SETTINGS_PROBE_MS, withTimeoutFallback } from "./timeout";
import {
  DEFAULT_NOTIFICATION_TOPICS,
  readTopicPrefsFromStorage,
  writeTopicPrefsToStorage,
} from "./adapters/notification-prefs";

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

async function notificationsAdapter() {
  if (isCapacitor()) {
    const mod = await capServices();
    return mod.createCapacitorNotificationsAdapter();
  }
  if (isElectron()) {
    const { createElectronNotificationsAdapter } = await import("./adapters/web-notifications");
    type NotifyBridge = {
      showNotification?: (payload: {
        title: string;
        body: string;
      }) => Promise<{ ok: boolean; message?: string }>;
    };
    return createElectronNotificationsAdapter(async (title, body) => {
      const bridge = getElectronBridge<NotifyBridge>();
      if (bridge?.showNotification) {
        const result = await bridge.showNotification({ title, body });
        return { ok: result.ok, message: result.message };
      }
      try {
        new Notification(title, { body });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Could not show notification.",
        };
      }
    });
  }
  const { createWebNotificationsAdapter } = await import("./adapters/web-notifications");
  return createWebNotificationsAdapter();
}

export const biometrics = {
  checkAvailability: async (): Promise<HardwareResult<BiometricAvailability>> => {
    if (!isCapacitor()) return unsupported("Biometrics");
    // Outer budget slightly above adapter probe so import+bridge can settle.
    return withTimeoutFallback(
      async () => {
        const mod = await capServices();
        return mod.createCapacitorBiometricsAdapter().checkAvailability();
      },
      NATIVE_SETTINGS_PROBE_MS + NATIVE_CALL_TIMEOUT_MS,
      {
        ok: false,
        message: "Biometrics took too long to respond on this device.",
        data: {
          available: false,
          supported: false,
          enrolled: false,
          biometryType: "none",
        },
      },
    );
  },
  authenticate: async (reason: string) => {
    if (!isCapacitor()) return unsupported("Biometrics");
    const mod = await capServices();
    return mod.createCapacitorBiometricsAdapter().authenticate(reason);
  },
  getPrefs: async () => {
    if (!isCapacitor()) return { enabled: false, requireOnLaunch: false };
    return withTimeoutFallback(
      async () => {
        const mod = await capServices();
        return mod.getBiometricPrefs();
      },
      NATIVE_CALL_TIMEOUT_MS + 500,
      { enabled: false, requireOnLaunch: false },
    );
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
    return withTimeoutFallback(
      async () => {
        const adapter = await notificationsAdapter();
        return adapter.checkPermissions();
      },
      NATIVE_SETTINGS_PROBE_MS + NATIVE_CALL_TIMEOUT_MS,
      {
        ok: false as const,
        message: "Notification permission check timed out. Try again.",
        data: { granted: false, state: "error" as const },
      },
    );
  },
  requestPermissions: async () => {
    const adapter = await notificationsAdapter();
    return adapter.requestPermissions();
  },
  scheduleLocal: async (args: { title: string; body: string; id?: number }) => {
    const adapter = await notificationsAdapter();
    return adapter.scheduleLocal(args);
  },
  getTopicPrefs: async () => {
    if (isCapacitor()) {
      const mod = await capServices();
      return withTimeoutFallback(
        () => mod.createCapacitorNotificationsAdapter().getTopicPrefs(),
        NATIVE_CALL_TIMEOUT_MS + 500,
        { ok: true as const, data: { ...DEFAULT_NOTIFICATION_TOPICS } },
      );
    }
    return { ok: true as const, data: readTopicPrefsFromStorage() };
  },
  setTopicPrefs: async (prefs: Partial<Record<NotificationTopic, boolean>>) => {
    if (isCapacitor()) {
      const mod = await capServices();
      return mod.createCapacitorNotificationsAdapter().setTopicPrefs(prefs);
    }
    writeTopicPrefsToStorage(prefs);
    return { ok: true as const };
  },
  registerRemote: async (args?: { vapidPublicKey?: string }) => {
    const adapter = await notificationsAdapter();
    return adapter.registerRemote(args);
  },
  unregisterRemote: async () => {
    const adapter = await notificationsAdapter();
    return adapter.unregisterRemote();
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
  addBackButtonListener: async (
    callback: (event: { canGoBack: boolean }) => void,
  ): Promise<AppBackButtonHandle> => {
    if (!isCapacitor()) {
      return { remove: async () => undefined };
    }
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().addBackButtonListener(callback);
  },
  exitApp: async () => {
    if (!isCapacitor()) return unsupported();
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().exitApp();
  },
  openAppSettings: async () => {
    if (!isCapacitor()) return unsupported("App settings");
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().openAppSettings();
  },
  addAppStateListener: async (callback: (isActive: boolean) => void): Promise<AppUrlOpenHandle> => {
    if (!isCapacitor()) {
      return { remove: async () => undefined };
    }
    const mod = await capServices();
    return mod.createCapacitorAppServicesAdapter().addAppStateListener(callback);
  },
};

/** Lazy Bluetooth controls — BLE package never loads on web/Electron. */
export const bluetoothPrinter = {
  getStatus: async () => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.getStatus();
  },
  discover: async (options?: { transport?: "ble" | "classic" }) => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.discover(options);
  },
  connect: async (deviceId: string, deviceName?: string, transport?: "ble" | "classic") => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.connect(deviceId, deviceName, transport);
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
  forget: async () => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.forget();
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
  setTransport: async (transport: "ble" | "classic") => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.setTransport(transport);
  },
  openBluetoothSettings: async () => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.openBluetoothSettings();
  },
  requestBluetoothPermission: async () => {
    const { getBluetoothPrinterControls } = await bluetoothFacade();
    const controls = await getBluetoothPrinterControls();
    return controls.requestBluetoothPermission();
  },
};
