/**
 * @novend/hardware — sole entry for platform hardware access.
 *
 * UI and feature services should call `Hardware.*` (or the named exports below).
 * Never import Electron preload or Capacitor plugins from UI components.
 */

import * as barcode from "./barcode";
import * as camera from "./camera";
import * as filesystem from "./filesystem";
import * as printer from "./printer";
import * as share from "./share";
import {
  appServices,
  biometrics,
  bluetoothPrinter,
  notifications,
  secureStorage,
} from "./native-services";
import { getHardwareAdapters, resetHardwareAdapters } from "./adapters/create";

export type {
  HardwareResult,
  PhotoCapture,
  BarcodeScanResult,
  DiscoveredPrinter,
  PrinterDiscovery,
  PrintReceiptRequest,
  DefaultPrinterInfo,
  SavedFile,
  HardwareAdapters,
  CameraAdapter,
  BarcodeAdapter,
  PrinterAdapter,
  FilesystemAdapter,
  ShareAdapter,
} from "./types";

export type {
  BluetoothPrinterDevice,
  BluetoothPrinterStatus,
  BiometricAvailability,
  NotificationTopic,
  NotificationPermissionState,
  AppInfo,
  UpdateInfo,
} from "./native-types";

export {
  getPlatform,
  isWeb,
  isElectron,
  isCapacitor,
  isAndroid,
  isIOS,
  getElectronBridge,
  type NovendPlatform,
} from "./platform";

export { getHardwareAdapters, resetHardwareAdapters };
export { compareAppVersions, normalizeAppVersion } from "./version";
export {
  mapNotificationDisplayState,
  resolveNotificationPermissionState,
} from "./notification-permission";

export {
  permissionNeedMessage,
  permissionDeniedMessage,
  friendlyHardwareMessage,
  filesystemSaveFailedMessage,
  shareFailedMessage,
  barcodeScanFailedMessage,
  cameraCaptureFailedMessage,
  type HardwarePermissionKind,
  type PermissionOutcome,
} from "./permissions";

export {
  withTimeout,
  withTimeoutFallback,
  isNativeTimeoutError,
  NATIVE_CALL_TIMEOUT_MS,
  NATIVE_SETTINGS_PROBE_MS,
  NATIVE_AVAILABILITY_TIMEOUT_MS,
  NATIVE_SCAN_TIMEOUT_MS,
  NATIVE_BLE_TIMEOUT_MS,
  NATIVE_CAMERA_TIMEOUT_MS,
  NativeTimeoutError,
} from "./timeout";

/** Facade used as `Hardware.printer.printReceipt(...)` etc. */
export const Hardware = {
  camera,
  barcode,
  printer,
  filesystem,
  share,
  biometrics,
  secureStorage,
  notifications,
  app: appServices,
  bluetoothPrinter,
} as const;

export {
  camera,
  barcode,
  printer,
  filesystem,
  share,
  biometrics,
  secureStorage,
  notifications,
  appServices,
  bluetoothPrinter,
};
