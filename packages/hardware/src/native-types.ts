/**
 * Extended domain types for Phase 4 native services.
 */

import type { HardwareResult } from "./types";

export type BluetoothPrinterDevice = {
  id: string;
  name: string;
  connected?: boolean;
};

export type BluetoothPrinterStatus = {
  available: boolean;
  connected: boolean;
  deviceId: string | null;
  deviceName: string | null;
  paperWidthMm: 58 | 80;
  autoReconnect: boolean;
};

export type BiometricAvailability = {
  /** True when the user can authenticate now (hardware + enrolled). */
  available: boolean;
  /** True when the device has biometric hardware (enrolled or not). */
  supported: boolean;
  /** True when at least one biometric is enrolled. */
  enrolled: boolean;
  biometryType: "fingerprint" | "face" | "iris" | "none" | "unknown";
  /** System reason when not available (e.g. not enrolled). */
  reason?: string;
};

export type NotificationTopic =
  | "stock_alerts"
  | "daily_summary"
  | "branch_transfers"
  | "subscription_alerts";

export type AppInfo = {
  name: string;
  id: string;
  build: string;
  version: string;
};

export type UpdateInfo = {
  available: boolean;
  version?: string;
  notes?: string;
  storeUrl?: string;
  downloadUrl?: string;
};

export type BiometricsAdapter = {
  checkAvailability: () => Promise<HardwareResult<BiometricAvailability>>;
  authenticate: (reason: string) => Promise<HardwareResult>;
};

export type SecureStorageAdapter = {
  get: (key: string) => Promise<HardwareResult<string | null>>;
  set: (key: string, value: string) => Promise<HardwareResult>;
  remove: (key: string) => Promise<HardwareResult>;
};

export type NotificationPermissionState =
  | "granted"
  | "denied"
  /** Permission has not been requested in this app install. */
  | "not-requested"
  /** Android has stopped presenting the runtime permission prompt. */
  | "permanently-denied"
  /** Backward-compatible alias used by older callers. */
  | "prompt"
  | "unavailable"
  | "error";

export type NotificationsAdapter = {
  checkPermissions: () => Promise<
    HardwareResult<{ granted: boolean; state: NotificationPermissionState }>
  >;
  requestPermissions: () => Promise<
    HardwareResult<{ granted: boolean; state: NotificationPermissionState }>
  >;
  scheduleLocal: (args: {
    title: string;
    body: string;
    id?: number;
  }) => Promise<HardwareResult>;
  getTopicPrefs: () => Promise<HardwareResult<Record<NotificationTopic, boolean>>>;
  setTopicPrefs: (
    prefs: Partial<Record<NotificationTopic, boolean>>,
  ) => Promise<HardwareResult>;
};

export type AppUrlOpenHandle = {
  remove: () => Promise<void>;
};

export type AppBackButtonHandle = {
  remove: () => Promise<void>;
};

export type AppServicesAdapter = {
  getInfo: () => Promise<HardwareResult<AppInfo>>;
  getLaunchUrl: () => Promise<HardwareResult<string | null>>;
  openExternalUrl: (url: string) => Promise<HardwareResult>;
  checkForUpdate: () => Promise<HardwareResult<UpdateInfo>>;
  openStoreListing: () => Promise<HardwareResult>;
  addUrlOpenListener: (
    callback: (url: string) => void,
  ) => Promise<AppUrlOpenHandle>;
  addBackButtonListener: (
    callback: (event: { canGoBack: boolean }) => void,
  ) => Promise<AppBackButtonHandle>;
  exitApp: () => Promise<HardwareResult>;
  openAppSettings: () => Promise<HardwareResult>;
  addAppStateListener: (
    callback: (isActive: boolean) => void,
  ) => Promise<AppUrlOpenHandle>;
};

export type BluetoothPrinterControls = {
  getStatus: () => Promise<HardwareResult<BluetoothPrinterStatus>>;
  discover: () => Promise<HardwareResult<{ devices: BluetoothPrinterDevice[] }>>;
  connect: (deviceId: string, deviceName?: string) => Promise<HardwareResult>;
  disconnect: () => Promise<HardwareResult>;
  reconnect: () => Promise<HardwareResult>;
  setPaperWidth: (mm: 58 | 80) => Promise<HardwareResult>;
  setAutoReconnect: (enabled: boolean) => Promise<HardwareResult>;
};
