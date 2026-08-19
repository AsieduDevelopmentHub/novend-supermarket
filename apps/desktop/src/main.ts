import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./window";

const APP_USER_MODEL_ID = "com.novend.pos";
const APP_DISPLAY_NAME = "Novend POS";

if (process.platform === "win32") {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

const isDev = !app.isPackaged && process.env.ELECTRON_DEV === "1";

function resolveAppUrl(): string {
  if (process.env.NOVEND_APP_URL) return process.env.NOVEND_APP_URL;
  if (isDev) return process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:3000";
  return process.env.NOVEND_APP_URL || "https://novend.app";
}

let mainWindow: BrowserWindow | null = null;

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
    showWindow();
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
