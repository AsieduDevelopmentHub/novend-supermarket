/** Ambient types for the Electron preload bridge exposed on window. */

export type PrincellenDesktopRuntime = {
  ok: true;
  runtime: "electron";
  version: string;
  platform: string;
  arch: string;
  packaged: boolean;
};

export type PrincellenDesktopPrintRequest = {
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

export type PrincellenDesktopPrintResult = {
  ok: boolean;
  message: string;
};

export type PrincellenDesktopDiscoverResult = {
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

export type PrincellenDesktopUpdateState =
  | "idle"
  | "disabled"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export type PrincellenDesktopUpdateStatus = {
  state: PrincellenDesktopUpdateState;
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

export type PrincellenDesktopInstallUpdateResult = {
  ok: boolean;
  message: string;
};

export type PrincellenDesktopBridge = {
  getRuntime: () => Promise<PrincellenDesktopRuntime>;
  getCapabilities: () => Promise<{
    ok: boolean;
    capabilities: Array<{ kind: string; available: boolean; reason?: string }>;
  }>;
  discoverDevices: () => Promise<PrincellenDesktopDiscoverResult>;
  print: (request: PrincellenDesktopPrintRequest) => Promise<PrincellenDesktopPrintResult>;
  testPrint: (
    partial?: Partial<PrincellenDesktopPrintRequest>,
  ) => Promise<PrincellenDesktopPrintResult>;
  getUpdateStatus: () => Promise<PrincellenDesktopUpdateStatus>;
  checkForUpdates: () => Promise<PrincellenDesktopUpdateStatus>;
  installUpdate: () => Promise<PrincellenDesktopInstallUpdateResult>;
  onUpdateStatus: (listener: (status: PrincellenDesktopUpdateStatus) => void) => () => void;
};

declare global {
  interface Window {
    princellenDesktop?: PrincellenDesktopBridge;
    novendDesktop?: PrincellenDesktopBridge;
  }
}

export {};
