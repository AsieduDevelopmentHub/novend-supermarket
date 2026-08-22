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
  | "idle"
  | "disabled"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

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

export type NovendDesktopBridge = {
  getRuntime: () => Promise<NovendDesktopRuntime>;
  getCapabilities: () => Promise<{
    ok: boolean;
    capabilities: Array<{ kind: string; available: boolean; reason?: string }>;
  }>;
  discoverDevices: () => Promise<NovendDesktopDiscoverResult>;
  print: (request: NovendDesktopPrintRequest) => Promise<NovendDesktopPrintResult>;
  testPrint: (
    partial?: Partial<NovendDesktopPrintRequest>,
  ) => Promise<NovendDesktopPrintResult>;
  getUpdateStatus: () => Promise<NovendDesktopUpdateStatus>;
  checkForUpdates: () => Promise<NovendDesktopUpdateStatus>;
  installUpdate: () => Promise<NovendDesktopInstallUpdateResult>;
  onUpdateStatus: (listener: (status: NovendDesktopUpdateStatus) => void) => () => void;
};

declare global {
  interface Window {
    novendDesktop?: NovendDesktopBridge;
  }
}

export {};
