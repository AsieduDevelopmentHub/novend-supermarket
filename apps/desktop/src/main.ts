import { app, BrowserWindow } from "electron";
import { createMainWindow } from "./window";
import { startAutoUpdater } from "./updater";
import { resolveAppUrl } from "./desktop-config";

const APP_USER_MODEL_ID = "com.novend.pos";
const APP_DISPLAY_NAME = "Novend POS";

if (process.platform === "win32") {
  app.setAppUserModelId(APP_USER_MODEL_ID);
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
