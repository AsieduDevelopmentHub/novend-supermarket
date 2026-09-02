import { BrowserWindow, Display, screen, shell } from "electron";
import {
  CUSTOMER_DISPLAY_ENTRY,
  loadAppShell,
  PERSIST_PARTITION,
  preloadPath,
  windowIcon,
} from "./window";

const CUSTOMER_DISPLAY_TITLE = "Novend Customer Display";

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
};

let customerDisplayWindow: BrowserWindow | null = null;
let appUrl = "";
const statusListeners = new Set<(status: CustomerDisplayStatus) => void>();

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

export function setCustomerDisplayAppUrl(url: string) {
  appUrl = url.replace(/\/$/, "");
}

export function listDesktopDisplays(): DesktopDisplayInfo[] {
  const primary = screen.getPrimaryDisplay();
  return screen.getAllDisplays().map((display) => mapDisplay(display, primary.id));
}

function pickDisplay(preferredId?: number | null): Display {
  const displays = screen.getAllDisplays();
  if (preferredId != null) {
    const match = displays.find((display) => display.id === preferredId);
    if (match) return match;
  }
  const primary = screen.getPrimaryDisplay();
  return displays.find((display) => display.id !== primary.id) ?? primary;
}

function notifyStatus() {
  const status = getCustomerDisplayStatus();
  for (const listener of statusListeners) {
    listener(status);
  }
}

export function getCustomerDisplayStatus(): CustomerDisplayStatus {
  return {
    open: customerDisplayWindow != null && !customerDisplayWindow.isDestroyed(),
    displayId:
      customerDisplayWindow != null && !customerDisplayWindow.isDestroyed()
        ? (screen
            .getAllDisplays()
            .find((display) => {
              const bounds = customerDisplayWindow!.getBounds();
              return (
                Math.abs(display.bounds.x - bounds.x) < 8 &&
                Math.abs(display.bounds.y - bounds.y) < 8
              );
            })?.id ?? null)
        : null,
  };
}

export function onCustomerDisplayStatus(listener: (status: CustomerDisplayStatus) => void) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
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

export async function openCustomerDisplayWindow(options?: {
  displayId?: number | null;
}): Promise<{ ok: boolean; message?: string }> {
  if (!appUrl) {
    return { ok: false, message: "App URL is not configured" };
  }

  if (customerDisplayWindow && !customerDisplayWindow.isDestroyed()) {
    customerDisplayWindow.show();
    customerDisplayWindow.focus();
    notifyStatus();
    return { ok: true };
  }

  const targetDisplay = pickDisplay(options?.displayId);
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
    fullscreen: screen.getAllDisplays().length > 1,
    autoHideMenuBar: true,
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

  win.once("ready-to-show", () => {
    win.show();
  });

  win.on("closed", () => {
    if (customerDisplayWindow === win) {
      customerDisplayWindow = null;
    }
    notifyStatus();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  await loadAppShell(win, appUrl, CUSTOMER_DISPLAY_ENTRY);
  notifyStatus();
  return { ok: true };
}

export function relayCustomerDisplayState(payload: unknown) {
  if (!customerDisplayWindow || customerDisplayWindow.isDestroyed()) return;
  customerDisplayWindow.webContents.send("desktop:customerDisplay:state", payload);
}

export function closeCustomerDisplayWithMainWindow() {
  closeCustomerDisplayWindow();
}
