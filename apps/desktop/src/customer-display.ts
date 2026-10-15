import { BrowserWindow, Display, screen, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { PERSIST_PARTITION, preloadPath, windowIcon } from "./window";
import {
  createTrustedOriginPolicy,
  isAllowedExternalUrl,
  isTrustedRendererUrl,
} from "./trusted-origin";
import { resolveAppUrl } from "./desktop-config";

const CUSTOMER_DISPLAY_TITLE = "Novend Customer Display";

export const CUSTOMER_DISPLAY_STATE_CHANNEL = "desktop:customerDisplay:state";

export const CUSTOMER_DISPLAY_SINGLE_MONITOR_MESSAGE =
  "Connect a second monitor to use the customer display. Novend opens the customer screen on your secondary display only.";

function hasSecondaryDisplay(displayCount: number): boolean {
  return displayCount >= 2;
}

export type DesktopDisplayInfo = {
  id: number;
  label: string;
  bounds: { x: number; y: number; width: number; height: number };
  workArea: { x: number; y: number; width: number; height: number };
  scaleFactor: number;
  isPrimary: boolean;
};

export type CustomerDisplayStatus = {
  open: boolean;
  displayId: number | null;
  displayCount: number;
  dualDisplayReady: boolean;
};

let customerDisplayWindow: BrowserWindow | null = null;
let lastSnapshot: unknown = null;
let autoOpenEnabled = false;
let hotplugRegistered = false;

const statusListeners = new Set<(status: CustomerDisplayStatus) => void>();
const displayListeners = new Set<(displays: DesktopDisplayInfo[]) => void>();

export function customerDisplayShellPath(): string {
  const candidates = [
    path.join(process.resourcesPath, "customer-display", "index.html"),
    path.resolve(__dirname, "..", "customer-display", "index.html"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0]!;
}

function mapDisplay(display: Display, primaryId: number): DesktopDisplayInfo {
  const { bounds, workArea, scaleFactor, id } = display;
  const index = screen.getAllDisplays().findIndex((row) => row.id === id);
  return {
    id,
    label: display.label?.trim() || `Display ${index + 1}`,
    bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
    workArea: {
      x: workArea.x,
      y: workArea.y,
      width: workArea.width,
      height: workArea.height,
    },
    scaleFactor,
    isPrimary: id === primaryId,
  };
}

export function listDesktopDisplays(): DesktopDisplayInfo[] {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display) => mapDisplay(display, primary.id));
}

export function getDesktopDisplayCount(): number {
  return screen.getAllDisplays().length;
}

export function hasDualDisplays(): boolean {
  return hasSecondaryDisplay(getDesktopDisplayCount());
}

function pickDisplay(preferredId?: number | null): Display | null {
  const displays = screen.getAllDisplays();
  if (!hasSecondaryDisplay(displays.length)) return null;

  if (preferredId != null) {
    const match = displays.find((display) => display.id === preferredId);
    if (match && match.id !== screen.getPrimaryDisplay().id) return match;
  }

  const primary = screen.getPrimaryDisplay();
  return displays.find((display) => display.id !== primary.id) ?? null;
}

function buildStatus(): CustomerDisplayStatus {
  const displayCount = getDesktopDisplayCount();
  return {
    open: customerDisplayWindow != null && !customerDisplayWindow.isDestroyed(),
    displayId:
      customerDisplayWindow != null && !customerDisplayWindow.isDestroyed()
        ? (screen.getAllDisplays().find((display) => {
            const bounds = customerDisplayWindow!.getBounds();
            return (
              Math.abs(display.bounds.x - bounds.x) < 8 && Math.abs(display.bounds.y - bounds.y) < 8
            );
          })?.id ?? null)
        : null,
    displayCount,
    dualDisplayReady: hasSecondaryDisplay(displayCount),
  };
}

function notifyStatus() {
  const status = buildStatus();
  for (const listener of statusListeners) {
    listener(status);
  }
}

function notifyDisplays() {
  const displays = listDesktopDisplays();
  for (const listener of displayListeners) {
    listener(displays);
  }
}

function pushSnapshotToWindow(win: BrowserWindow) {
  if (!lastSnapshot || win.isDestroyed()) return;
  win.webContents.send(CUSTOMER_DISPLAY_STATE_CHANNEL, lastSnapshot);
}

export function setCustomerDisplayAutoOpenEnabled(enabled: boolean) {
  autoOpenEnabled = enabled;
  if (enabled) {
    void tryAutoOpenCustomerDisplay();
  }
}

export function tryAutoOpenCustomerDisplay(): Promise<{ ok: boolean; message?: string }> {
  if (!autoOpenEnabled) {
    return Promise.resolve({ ok: false, message: "Auto-open is disabled" });
  }
  return openCustomerDisplayWindow();
}

export function onCustomerDisplayStatus(listener: (status: CustomerDisplayStatus) => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

export function onDesktopDisplaysChanged(listener: (displays: DesktopDisplayInfo[]) => void) {
  displayListeners.add(listener);
  return () => {
    displayListeners.delete(listener);
  };
}

export function getCustomerDisplayStatus(): CustomerDisplayStatus {
  return buildStatus();
}

export function closeCustomerDisplayWindow() {
  if (!customerDisplayWindow || customerDisplayWindow.isDestroyed()) {
    customerDisplayWindow = null;
    notifyStatus();
    return { ok: true as const };
  }
  const win = customerDisplayWindow;
  customerDisplayWindow = null;
  win.close();
  notifyStatus();
  return { ok: true as const };
}

function configureKioskWindow(win: BrowserWindow, targetDisplay: Display) {
  const { workArea } = targetDisplay;
  win.setBounds({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
  });
  win.setFullScreen(true);
  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setMenuBarVisibility(false);
}

export async function openCustomerDisplayWindow(options?: {
  displayId?: number | null;
}): Promise<{ ok: boolean; message?: string }> {
  if (!hasDualDisplays()) {
    return { ok: false, message: CUSTOMER_DISPLAY_SINGLE_MONITOR_MESSAGE };
  }

  if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
    customerDisplayWindow.show();
    customerDisplayWindow.focus();
    pushSnapshotToWindow(customerDisplayWindow);
    notifyStatus();
    return { ok: true };
  }

  const targetDisplay = pickDisplay(options?.displayId);
  if (!targetDisplay) {
    return { ok: false, message: CUSTOMER_DISPLAY_SINGLE_MONITOR_MESSAGE };
  }

  const shellPath = customerDisplayShellPath();
  if (!fs.existsSync(shellPath)) {
    return { ok: false, message: "Customer display shell is missing from this install." };
  }
  const trustedOrigin = createTrustedOriginPolicy(resolveAppUrl(), [pathToFileURL(shellPath).href]);

  const icon = windowIcon();
  const { workArea } = targetDisplay;

  const win = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    minWidth: 640,
    minHeight: 480,
    title: CUSTOMER_DISPLAY_TITLE,
    backgroundColor: "#f8fafc",
    show: false,
    fullscreen: true,
    autoHideMenuBar: true,
    closable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      partition: PERSIST_PARTITION,
    },
  });

  customerDisplayWindow = win;
  configureKioskWindow(win, targetDisplay);

  win.once("ready-to-show", () => {
    win.show();
    pushSnapshotToWindow(win);
  });

  win.on("closed", () => {
    if (customerDisplayWindow === win) {
      customerDisplayWindow = null;
    }
    notifyStatus();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedRendererUrl(trustedOrigin, url)) {
      event.preventDefault();
    }
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, _errorDescription, _validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      if (errorCode === -3) return;
    },
  );

  await win.loadFile(shellPath);
  notifyStatus();
  return { ok: true };
}

export function relayCustomerDisplayState(payload: unknown) {
  lastSnapshot = payload;
  if (!customerDisplayWindow || customerDisplayWindow.isDestroyed()) return;
  customerDisplayWindow.webContents.send(CUSTOMER_DISPLAY_STATE_CHANNEL, payload);
}

export function closeCustomerDisplayWithMainWindow() {
  closeCustomerDisplayWindow();
}

export function registerCustomerDisplayHotplug() {
  if (hotplugRegistered) return;
  hotplugRegistered = true;

  const onChange = () => {
    notifyDisplays();
    notifyStatus();

    if (!hasDualDisplays()) {
      closeCustomerDisplayWindow();
      return;
    }

    if (autoOpenEnabled) {
      void tryAutoOpenCustomerDisplay();
    }
  };

  screen.on("display-added", onChange);
  screen.on("display-removed", onChange);
  screen.on("display-metrics-changed", onChange);
}

/** @deprecated Customer display no longer loads the hosted app shell. */
export function setCustomerDisplayAppUrl(_url: string) {
  void _url;
}
