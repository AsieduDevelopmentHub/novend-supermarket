import { Notification, ipcMain, type IpcMainInvokeEvent } from "electron";
import { pathToFileURL } from "node:url";
import {
  discoverDevices,
  getRuntimeInfo,
  listCapabilities,
  printReceiptJob,
  runTestPrint,
} from "./hardware/registry";
import type { PrintJobRequest } from "./hardware/types";
import {
  checkForUpdates,
  getUpdateStatus,
  installDownloadedUpdate,
  UPDATE_STATUS_CHANNEL,
} from "./updater";
import { resolveAppUrl } from "./desktop-config";
import { offlineBootPath, reloadMainWindowShell } from "./window";
import { closeCustomerDisplayWithMainWindow } from "./customer-display";
import {
  assertTrustedIpcSender,
  createTrustedOriginPolicy,
  validateAuthShellEntry,
} from "./trusted-origin";

const CHANNELS = {
  getRuntime: "desktop:getRuntime",
  getCapabilities: "desktop:getCapabilities",
  discover: "desktop:hardware:discover",
  print: "desktop:hardware:print",
  testPrint: "desktop:hardware:testPrint",
  updatesGetStatus: "desktop:updates:getStatus",
  updatesCheck: "desktop:updates:check",
  updatesInstall: "desktop:updates:install",
  reloadAuthShell: "desktop:shell:reloadAuth",
  showNotification: "desktop:notifications:show",
} as const;

function isPrintJobRequest(value: unknown): value is PrintJobRequest {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.escposBase64 === "string" && v.escposBase64.length > 0;
}

/** Register secure IPC handlers. Renderer only reaches these via preload. */
export function registerDesktopIpc() {
  const appUrl = resolveAppUrl();
  const trustedOrigin = createTrustedOriginPolicy(appUrl, [pathToFileURL(offlineBootPath()).href]);
  const requireTrustedSender = (event: IpcMainInvokeEvent) => {
    assertTrustedIpcSender(trustedOrigin, event);
  };

  ipcMain.handle(CHANNELS.getRuntime, (event) => {
    requireTrustedSender(event);
    return getRuntimeInfo();
  });

  ipcMain.handle(CHANNELS.getCapabilities, (event) => {
    requireTrustedSender(event);
    return {
      ok: true,
      capabilities: listCapabilities(),
    };
  });

  ipcMain.handle(CHANNELS.discover, async (event) => {
    requireTrustedSender(event);
    return discoverDevices();
  });

  ipcMain.handle(CHANNELS.print, async (event, payload: unknown) => {
    requireTrustedSender(event);
    if (!isPrintJobRequest(payload)) {
      return { ok: false, message: "Invalid print request" };
    }
    const copies = Math.min(5, Math.max(1, Number(payload.copies) || 1));
    const paperWidthMm = payload.paperWidthMm === 58 ? 58 : 80;
    const connectionType =
      payload.connectionType === "windows" || payload.connectionType === "network"
        ? payload.connectionType
        : "auto";

    return printReceiptJob({
      escposBase64: payload.escposBase64,
      invoiceNumber: String(payload.invoiceNumber || "INV"),
      copies,
      connectionType,
      printerHost: String(payload.printerHost || ""),
      printerPort: Number(payload.printerPort) || 9100,
      windowsPrinterName: String(payload.windowsPrinterName || ""),
      paperWidthMm,
      openCashDrawer: payload.openCashDrawer === true,
    });
  });

  ipcMain.handle(CHANNELS.testPrint, async (event, partial?: unknown) => {
    requireTrustedSender(event);
    const p =
      partial && typeof partial === "object" ? (partial as Partial<PrintJobRequest>) : undefined;
    return runTestPrint(p);
  });

  ipcMain.handle(CHANNELS.updatesGetStatus, (event) => {
    requireTrustedSender(event);
    return getUpdateStatus();
  });

  ipcMain.handle(CHANNELS.updatesCheck, async (event) => {
    requireTrustedSender(event);
    return checkForUpdates();
  });

  ipcMain.handle(CHANNELS.updatesInstall, (event) => {
    requireTrustedSender(event);
    return installDownloadedUpdate();
  });

  ipcMain.handle(CHANNELS.reloadAuthShell, async (event, payload?: unknown) => {
    requireTrustedSender(event);
    const requestedEntry =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { entry?: unknown }).entry === "string" &&
      (payload as { entry: string }).entry.length > 0
        ? (payload as { entry: string }).entry
        : "/login?signedOut=1";
    const entry = validateAuthShellEntry(requestedEntry);
    if (!entry) {
      return { ok: false, message: "Invalid authentication route." };
    }
    closeCustomerDisplayWithMainWindow();
    return reloadMainWindowShell(appUrl, entry);
  });

  ipcMain.handle(CHANNELS.showNotification, (event, payload: unknown) => {
    requireTrustedSender(event);
    if (!payload || typeof payload !== "object") {
      return { ok: false, message: "Invalid notification payload." };
    }
    const title = String((payload as { title?: unknown }).title ?? "").trim();
    const body = String((payload as { body?: unknown }).body ?? "").trim();
    if (!title) return { ok: false, message: "Notification title is required." };
    try {
      const notification = new Notification({ title, body });
      notification.show();
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Could not show notification.",
      };
    }
  });
}

export { CHANNELS, UPDATE_STATUS_CHANNEL };
