/**
 * Preload bridge — exposes a minimal typed API to the renderer via contextBridge.
 * The renderer never receives Node or Electron internals.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";

export type DesktopRuntime = {
  ok: true;
  runtime: "electron";
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  packaged: boolean;
};

export type DesktopPrintRequest = {
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

export type DesktopPrintResult = {
  ok: boolean;
  message: string;
};

export type DesktopDiscoverResult = {
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

export type DesktopUpdateState =
  | "idle"
  | "disabled"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

export type DesktopUpdateStatus = {
  state: DesktopUpdateState;
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

export type DesktopInstallUpdateResult = {
  ok: boolean;
  message: string;
};

export type NovendDesktopBridge = {
  getRuntime: () => Promise<DesktopRuntime>;
  getCapabilities: () => Promise<{
    ok: boolean;
    capabilities: Array<{ kind: string; available: boolean; reason?: string }>;
  }>;
  discoverDevices: () => Promise<DesktopDiscoverResult>;
  print: (request: DesktopPrintRequest) => Promise<DesktopPrintResult>;
  testPrint: (partial?: Partial<DesktopPrintRequest>) => Promise<DesktopPrintResult>;
  getUpdateStatus: () => Promise<DesktopUpdateStatus>;
  checkForUpdates: () => Promise<DesktopUpdateStatus>;
  installUpdate: () => Promise<DesktopInstallUpdateResult>;
  onUpdateStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
};

const UPDATE_STATUS_CHANNEL = "desktop:updates:status";

const bridge: NovendDesktopBridge = {
  getRuntime: () => ipcRenderer.invoke("desktop:getRuntime"),
  getCapabilities: () => ipcRenderer.invoke("desktop:getCapabilities"),
  discoverDevices: () => ipcRenderer.invoke("desktop:hardware:discover"),
  print: (request) => ipcRenderer.invoke("desktop:hardware:print", request),
  testPrint: (partial) => ipcRenderer.invoke("desktop:hardware:testPrint", partial),
  getUpdateStatus: () => ipcRenderer.invoke("desktop:updates:getStatus"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:updates:check"),
  installUpdate: () => ipcRenderer.invoke("desktop:updates:install"),
  onUpdateStatus: (listener) => {
    const handler = (_event: IpcRendererEvent, status: DesktopUpdateStatus) => {
      listener(status);
    };
    ipcRenderer.on(UPDATE_STATUS_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(UPDATE_STATUS_CHANNEL, handler);
    };
  },
};

contextBridge.exposeInMainWorld("novendDesktop", bridge);
