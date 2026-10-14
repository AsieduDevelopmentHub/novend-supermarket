import { Notification, app, dialog, ipcMain, shell, type IpcMainInvokeEvent } from "electron";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
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
import { ACK_UPDATE_CHANNEL, acknowledgeUpdatePreparation } from "./update-shutdown";
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
  openDateTimeSettings: "desktop:shell:openDateTimeSettings",
  quitApp: "desktop:app:quit",
  getDefaultBackupFolder: "desktop:backup:getDefaultFolder",
  pickBackupFolder: "desktop:backup:pickFolder",
  writeBackupFile: "desktop:backup:writeFile",
  openBackupFolder: "desktop:backup:openFolder",
} as const;

const DEFAULT_BACKUP_FOLDER_NAME = "Millies-Supermarket-Backups";

function defaultBackupFolderPath() {
  return path.join(app.getPath("documents"), DEFAULT_BACKUP_FOLDER_NAME);
}

function isSafeBackupFileName(fileName: string) {
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return false;
  }
  return fileName.endsWith(".novend-backup");
}

const execFileAsync = promisify(execFile);

async function openOsDateTimeSettings(): Promise<{ ok: boolean; message?: string }> {
  try {
    if (process.platform === "win32") {
      await shell.openExternal("ms-settings:dateandtime");
      return { ok: true };
    }
    if (process.platform === "darwin") {
      try {
        await execFileAsync("open", [
          "x-apple.systempreferences:com.apple.preference.datetime",
        ]);
        return { ok: true };
      } catch {
        await execFileAsync("open", ["-b", "com.apple.systempreferences"]);
        return {
          ok: true,
          message: "Open Date & Time in System Settings.",
        };
      }
    }
    try {
      await execFileAsync("gnome-control-center", ["datetime"]);
      return { ok: true };
    } catch {
      return {
        ok: false,
        message: "Open your system Date & Time settings from the OS control panel.",
      };
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not open date & time settings.",
    };
  }
}

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

  ipcMain.handle(ACK_UPDATE_CHANNEL, (event, payload: unknown) => {
    requireTrustedSender(event);
    if (event.senderFrame !== event.sender.mainFrame) return false;
    return acknowledgeUpdatePreparation(event.sender.id, payload);
  });

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

  ipcMain.handle(CHANNELS.openDateTimeSettings, async (event) => {
    requireTrustedSender(event);
    return openOsDateTimeSettings();
  });

  ipcMain.handle(CHANNELS.quitApp, (event) => {
    requireTrustedSender(event);
    // Defer so the invoke reply can flush before the process exits.
    setImmediate(() => {
      app.quit();
    });
    return { ok: true as const };
  });

  ipcMain.handle(CHANNELS.getDefaultBackupFolder, async (event) => {
    requireTrustedSender(event);
    const folder = defaultBackupFolderPath();
    try {
      await fs.mkdir(folder, { recursive: true });
    } catch {
      /* still return the intended path */
    }
    return { ok: true as const, path: folder };
  });

  ipcMain.handle(CHANNELS.pickBackupFolder, async (event, currentPath?: unknown) => {
    requireTrustedSender(event);
    const defaultPath =
      typeof currentPath === "string" && currentPath.trim().length > 0
        ? currentPath.trim()
        : defaultBackupFolderPath();
    const result = await dialog.showOpenDialog({
      title: "Choose backup folder",
      defaultPath,
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false as const };
    return { ok: true as const, path: result.filePaths[0] };
  });

  ipcMain.handle(
    CHANNELS.writeBackupFile,
    async (
      event,
      payload: unknown,
    ): Promise<{ ok: true; path: string } | { ok: false; message?: string }> => {
      requireTrustedSender(event);
      if (!payload || typeof payload !== "object") {
        return { ok: false, message: "Invalid backup write payload." };
      }
      const folderPath = String((payload as { folderPath?: unknown }).folderPath ?? "").trim();
      const fileName = String((payload as { fileName?: unknown }).fileName ?? "").trim();
      const contents = String((payload as { contents?: unknown }).contents ?? "");
      if (!folderPath || !isSafeBackupFileName(fileName) || !contents) {
        return { ok: false, message: "Invalid backup folder or file name." };
      }
      try {
        const resolvedFolder = path.resolve(folderPath);
        await fs.mkdir(resolvedFolder, { recursive: true });
        const target = path.resolve(resolvedFolder, fileName);
        const folderPrefix = resolvedFolder.endsWith(path.sep)
          ? resolvedFolder
          : `${resolvedFolder}${path.sep}`;
        if (!target.startsWith(folderPrefix)) {
          return { ok: false, message: "Backup path rejected." };
        }
        await fs.writeFile(target, contents, "utf8");
        return { ok: true, path: target };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Could not write backup file.",
        };
      }
    },
  );

  ipcMain.handle(CHANNELS.openBackupFolder, async (event, folderPath?: unknown) => {
    requireTrustedSender(event);
    const target =
      typeof folderPath === "string" && folderPath.trim().length > 0
        ? folderPath.trim()
        : defaultBackupFolderPath();
    try {
      await fs.mkdir(target, { recursive: true });
    } catch {
      /* open anyway */
    }
    const error = await shell.openPath(target);
    if (error) return { ok: false as const, message: error };
    return { ok: true as const };
  });
}

export { CHANNELS, UPDATE_STATUS_CHANNEL };
