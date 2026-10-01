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
  "idle" | "disabled" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";

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

const UPDATE_STATUS_CHANNEL = "desktop:updates:status";
const CUSTOMER_DISPLAY_STATE_CHANNEL = "desktop:customerDisplay:state";
const CUSTOMER_DISPLAY_STATUS_CHANNEL = "desktop:customerDisplay:status";
const CUSTOMER_DISPLAY_DISPLAYS_CHANNEL = "desktop:customerDisplay:displaysChanged";

export type CustomerDisplayStatus = {
  open: boolean;
  displayId: number | null;
  displayCount?: number;
  dualDisplayReady?: boolean;
};

export type DesktopDisplayInfo = {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
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
  onPrepareUpdate: (listener: (request: { id: string }) => void) => () => void;
  onCancelUpdatePreparation: (listener: (request: { id: string }) => void) => () => void;
  acknowledgeUpdatePreparation: (id: string, ready: boolean) => Promise<boolean>;
  onUpdateStatus: (listener: (status: DesktopUpdateStatus) => void) => () => void;
  openCustomerDisplay: (options?: {
    displayId?: number | null;
  }) => Promise<{ ok: boolean; message?: string }>;
  closeCustomerDisplay: () => Promise<{ ok: boolean }>;
  getCustomerDisplayStatus: () => Promise<CustomerDisplayStatus>;
  listDisplays: () => Promise<{ ok: boolean; displays: DesktopDisplayInfo[] }>;
  publishCustomerDisplayState: (snapshot: unknown) => Promise<{ ok: boolean }>;
  onCustomerDisplayState: (listener: (snapshot: unknown) => void) => () => void;
  onCustomerDisplayStatus: (listener: (status: CustomerDisplayStatus) => void) => () => void;
  setCustomerDisplayAutoOpen: (enabled: boolean) => Promise<{ ok: boolean }>;
  onDisplaysChanged: (
    listener: (payload: { ok: boolean; displays: DesktopDisplayInfo[] }) => void,
  ) => () => void;
  reloadAuthShell: (entry?: string) => Promise<{ ok: boolean; message?: string }>;
  showNotification: (payload: {
    title: string;
    body: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  openDateTimeSettings: () => Promise<{ ok: boolean; message?: string }>;
};

const bridge: NovendDesktopBridge = {
  getRuntime: () => ipcRenderer.invoke("desktop:getRuntime"),
  getCapabilities: () => ipcRenderer.invoke("desktop:getCapabilities"),
  discoverDevices: () => ipcRenderer.invoke("desktop:hardware:discover"),
  print: (request) => ipcRenderer.invoke("desktop:hardware:print", request),
  testPrint: (partial) => ipcRenderer.invoke("desktop:hardware:testPrint", partial),
  getUpdateStatus: () => ipcRenderer.invoke("desktop:updates:getStatus"),
  checkForUpdates: () => ipcRenderer.invoke("desktop:updates:check"),
  installUpdate: () => ipcRenderer.invoke("desktop:updates:install"),
  onPrepareUpdate: (listener) => {
    const handler = (_event: IpcRendererEvent, request: { id: string }) => {
      listener(request);
    };
    ipcRenderer.on("desktop:updates:prepare", handler);
    return () => {
      ipcRenderer.removeListener("desktop:updates:prepare", handler);
    };
  },
  onCancelUpdatePreparation: (listener) => {
    const handler = (_event: IpcRendererEvent, request: { id: string }) => {
      listener(request);
    };
    ipcRenderer.on("desktop:updates:cancelPreparation", handler);
    return () => {
      ipcRenderer.removeListener("desktop:updates:cancelPreparation", handler);
    };
  },
  acknowledgeUpdatePreparation: (id, ready) =>
    ipcRenderer.invoke("desktop:updates:prepared", { id, ready }),
  onUpdateStatus: (listener) => {
    const handler = (_event: IpcRendererEvent, status: DesktopUpdateStatus) => {
      listener(status);
    };
    ipcRenderer.on(UPDATE_STATUS_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(UPDATE_STATUS_CHANNEL, handler);
    };
  },
  openCustomerDisplay: (options) => ipcRenderer.invoke("desktop:customerDisplay:open", options),
  closeCustomerDisplay: () => ipcRenderer.invoke("desktop:customerDisplay:close"),
  getCustomerDisplayStatus: () => ipcRenderer.invoke("desktop:customerDisplay:getStatus"),
  listDisplays: () => ipcRenderer.invoke("desktop:customerDisplay:listDisplays"),
  publishCustomerDisplayState: (snapshot) =>
    ipcRenderer.invoke("desktop:customerDisplay:publish", snapshot),
  onCustomerDisplayState: (listener) => {
    const handler = (_event: IpcRendererEvent, snapshot: unknown) => {
      listener(snapshot);
    };
    ipcRenderer.on(CUSTOMER_DISPLAY_STATE_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(CUSTOMER_DISPLAY_STATE_CHANNEL, handler);
    };
  },
  onCustomerDisplayStatus: (listener) => {
    void ipcRenderer.invoke("desktop:customerDisplay:onStatus");
    const handler = (_event: IpcRendererEvent, status: CustomerDisplayStatus) => {
      listener(status);
    };
    ipcRenderer.on(CUSTOMER_DISPLAY_STATUS_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(CUSTOMER_DISPLAY_STATUS_CHANNEL, handler);
    };
  },
  setCustomerDisplayAutoOpen: (enabled) =>
    ipcRenderer.invoke("desktop:customerDisplay:setAutoOpen", { enabled }),
  onDisplaysChanged: (listener) => {
    void ipcRenderer.invoke("desktop:customerDisplay:onDisplaysChanged");
    const handler = (
      _event: IpcRendererEvent,
      payload: { ok: boolean; displays: DesktopDisplayInfo[] },
    ) => {
      listener(payload);
    };
    ipcRenderer.on(CUSTOMER_DISPLAY_DISPLAYS_CHANNEL, handler);
    return () => {
      ipcRenderer.removeListener(CUSTOMER_DISPLAY_DISPLAYS_CHANNEL, handler);
    };
  },
  reloadAuthShell: (entry) => ipcRenderer.invoke("desktop:shell:reloadAuth", { entry }),
  showNotification: (payload) => ipcRenderer.invoke("desktop:notifications:show", payload),
  openDateTimeSettings: () => ipcRenderer.invoke("desktop:shell:openDateTimeSettings"),
};

contextBridge.exposeInMainWorld("novendDesktop", bridge);
