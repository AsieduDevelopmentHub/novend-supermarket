/** Ambient types for the Electron preload bridge exposed on window. */

export type NovendDesktopRuntime = {
  ok: true;
  runtime: "electron";
  version: string;
  platform: string;
  arch: string;
  packaged: boolean;
};

export type NovendDesktopPrintRequest = {
  escposBase64: string;
  invoiceNumber: string;
  copies: number;
  connectionType: "network" | "windows" | "auto";
  printerHost: string;
  printerPort: number;
  windowsPrinterName: string;
  paperWidthMm: 58 | 80;
  openCashDrawer?: boolean;
};

export type NovendDesktopPrintResult = {
  ok: boolean;
  message: string;
};

export type NovendDesktopDiscoverResult = {
  ok: boolean;
  version: string;
  platform: string;
  message?: string;
  windowsPrinters: Array<{
    name: string;
    driverName: string;
    portName: string;
    isDefault: boolean;
    networkHost: string | null;
    networkPort: number | null;
  }>;
  devices: Array<{
    id: string;
    kind: string;
    label: string;
    meta: Record<string, unknown>;
  }>;
  suggested: {
    connectionType: "network" | "windows" | "auto";
    windowsPrinterName: string;
    printerHost: string;
    printerPort: number;
  } | null;
};

export type NovendDesktopUpdateState =
  "idle" | "disabled" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";

export type NovendDesktopUpdateStatus = {
  state: NovendDesktopUpdateState;
  currentVersion: string;
  availableVersion: string | null;
  releaseNotes: string | null;
  progressPercent: number | null;
  errorMessage: string | null;
  lastCheckedAt: number | null;
  packaged: boolean;
  feedConfigured: boolean;
  canCheck: boolean;
  canInstall: boolean;
};

export type NovendDesktopInstallUpdateResult = {
  ok: boolean;
  message: string;
};

export type NovendDesktopCustomerDisplayStatus = {
  open: boolean;
  displayId: number | null;
  displayCount?: number;
  dualDisplayReady?: boolean;
};

export type NovendDesktopDisplayInfo = {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
};

export type NovendDesktopBridge = {
  getRuntime: () => Promise<NovendDesktopRuntime>;
  getCapabilities: () => Promise<{
    ok: boolean;
    capabilities: Array<{ kind: string; available: boolean; reason?: string }>;
  }>;
  discoverDevices: () => Promise<NovendDesktopDiscoverResult>;
  print: (request: NovendDesktopPrintRequest) => Promise<NovendDesktopPrintResult>;
  testPrint: (partial?: Partial<NovendDesktopPrintRequest>) => Promise<NovendDesktopPrintResult>;
  getUpdateStatus: () => Promise<NovendDesktopUpdateStatus>;
  checkForUpdates: () => Promise<NovendDesktopUpdateStatus>;
  installUpdate: () => Promise<NovendDesktopInstallUpdateResult>;
  onPrepareUpdate?: (listener: (request: { id: string }) => void) => () => void;
  onCancelUpdatePreparation?: (listener: (request: { id: string }) => void) => () => void;
  acknowledgeUpdatePreparation?: (id: string, ready: boolean) => Promise<boolean>;
  onUpdateStatus: (listener: (status: NovendDesktopUpdateStatus) => void) => () => void;
  openCustomerDisplay: (options?: {
    displayId?: number | null;
  }) => Promise<{ ok: boolean; message?: string }>;
  closeCustomerDisplay: () => Promise<{ ok: boolean }>;
  getCustomerDisplayStatus: () => Promise<NovendDesktopCustomerDisplayStatus>;
  listDisplays: () => Promise<{ ok: boolean; displays: NovendDesktopDisplayInfo[] }>;
  publishCustomerDisplayState: (snapshot: unknown) => Promise<{ ok: boolean }>;
  onCustomerDisplayState: (listener: (snapshot: unknown) => void) => () => void;
  onCustomerDisplayStatus: (
    listener: (status: NovendDesktopCustomerDisplayStatus) => void,
  ) => () => void;
  setCustomerDisplayAutoOpen: (enabled: boolean) => Promise<{ ok: boolean }>;
  onDisplaysChanged: (
    listener: (payload: { ok: boolean; displays: NovendDesktopDisplayInfo[] }) => void,
  ) => () => void;
  reloadAuthShell: (entry?: string) => Promise<{ ok: boolean; message?: string }>;
  openDateTimeSettings: () => Promise<{ ok: boolean; message?: string }>;
  quitApp: () => Promise<{ ok: boolean; message?: string }>;
};

declare global {
  interface Window {
    novendDesktop?: NovendDesktopBridge;
  }
}

export {};
