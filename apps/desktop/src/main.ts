import { app, BrowserWindow, session } from "electron";
import { createMainWindow } from "./window";
import { startAutoUpdater } from "./updater";
import { resolveAppUrl } from "./desktop-config";
import { registerDesktopIpc } from "./ipc";

const APP_USER_MODEL_ID = "com.novend.pos";
const APP_DISPLAY_NAME = "Novend POS";
const PERSIST_PARTITION = "persist:novend";

if (process.platform === "win32") {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

let mainWindow: BrowserWindow | null = null;

function allowMediaPermissions() {
  const ses = session.fromPartition(PERSIST_PARTITION);
  const allow = (permission: string) => permission === "media" || permission === "mediaKeySystem";

  // Auto-approve Chromium's media permission so getUserMedia can open the OS
  // camera prompt / stream. Still requires Permissions-Policy camera=(self)
  // on the hosted app (see proxy.ts).
  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(allow(permission));
  });
  ses.setPermissionCheckHandler((_webContents, permission) => allow(permission));
}

function showWindow() {
  if (!mainWindow) {
    mainWindow = createMainWindow(resolveAppUrl());
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    showWindow();
  });

  void app.whenReady().then(() => {
    app.setName(APP_DISPLAY_NAME);
    allowMediaPermissions();
    registerDesktopIpc();
    showWindow();
    startAutoUpdater(() => mainWindow);
    app.on("activate", () => {
      showWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
