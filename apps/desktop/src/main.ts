import { app, BrowserWindow, dialog, session } from "electron";
import { createMainWindow, loadAppShell, setMainBrowserWindow } from "./window";
import { startAutoUpdater } from "./updater";
import {
  PACKAGED_LOCAL_ORIGIN,
  resolveAppUrl,
  setRuntimeAppOrigin,
  shouldStartBundledServer,
} from "./desktop-config";
import { registerDesktopIpc } from "./ipc";
import { registerCustomerDisplayIpc } from "./customer-display-ipc";
import {
  closeCustomerDisplayWithMainWindow,
  registerCustomerDisplayHotplug,
} from "./customer-display";
import { createTrustedOriginPolicy, isAllowedMediaPermission } from "./trusted-origin";
import { startLocalServer, stopLocalServer } from "./local-server";

const APP_USER_MODEL_ID = "com.novend.millies";
const APP_DISPLAY_NAME = "Millie's Supermarket";
const PERSIST_PARTITION = "persist:millies";

if (process.platform === "win32") {
  app.setAppUserModelId(APP_USER_MODEL_ID);
}

let mainWindow: BrowserWindow | null = null;

function allowMediaPermissions(appUrl: string) {
  const ses = session.fromPartition(PERSIST_PARTITION);
  const trustedOrigin = createTrustedOriginPolicy(appUrl);

  // Auto-approve Chromium's media permission so getUserMedia can open the OS
  // camera prompt / stream. Still requires Permissions-Policy camera=(self)
  // on the app (see proxy.ts).
  ses.setPermissionRequestHandler((webContents, permission, callback, details) => {
    callback(
      isAllowedMediaPermission(
        trustedOrigin,
        permission,
        details.requestingUrl || webContents.getURL(),
      ),
    );
  });
  ses.setPermissionCheckHandler((webContents, permission, requestingOrigin) =>
    isAllowedMediaPermission(
      trustedOrigin,
      permission,
      requestingOrigin || webContents?.getURL() || "",
    ),
  );
}

/**
 * Millie's does not use the SaaS PWA service worker. A leftover SW from an older
 * build intercepts /login on cold boot, times out while Next warms, and shows
 * “Novend is offline” until the user restarts. Clear it before first navigation.
 */
async function clearStaleServiceWorkers(appUrl: string) {
  const ses = session.fromPartition(PERSIST_PARTITION);
  try {
    await ses.clearStorageData({
      origin: appUrl.replace(/\/$/, ""),
      storages: ["serviceworkers", "cachestorage"],
    });
  } catch (error) {
    console.warn("[millies-desktop] could not clear stale service workers", error);
  }
}

function showWindow(appUrl: string) {
  if (!mainWindow) {
    mainWindow = createMainWindow(appUrl);
    setMainBrowserWindow(mainWindow);
    mainWindow.on("closed", () => {
      setMainBrowserWindow(null);
      closeCustomerDisplayWithMainWindow();
      mainWindow = null;
    });
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

async function resolveSessionOrigin(): Promise<string> {
  if (shouldStartBundledServer()) {
    const server = await startLocalServer();
    setRuntimeAppOrigin(server.origin);
    return server.origin;
  }
  const origin = resolveAppUrl();
  setRuntimeAppOrigin(origin);
  return origin;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    try {
      showWindow(resolveAppUrl());
    } catch {
      /* origin not ready yet */
    }
  });

  void app.whenReady().then(async () => {
    app.setName(APP_DISPLAY_NAME);

    // Show a branded splash immediately while the bundled Next server boots —
    // packaged cold start spent most of its time with no window visible.
    const startsBundled = shouldStartBundledServer();
    const provisionalOrigin = startsBundled ? PACKAGED_LOCAL_ORIGIN : resolveAppUrl();
    if (!mainWindow) {
      mainWindow = createMainWindow(provisionalOrigin, {
        deferAppLoad: startsBundled,
      });
      setMainBrowserWindow(mainWindow);
      mainWindow.on("closed", () => {
        setMainBrowserWindow(null);
        closeCustomerDisplayWithMainWindow();
        mainWindow = null;
      });
    }

    let appUrl: string;
    try {
      appUrl = await resolveSessionOrigin();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[millies-desktop] failed to start local till server", error);
      dialog.showErrorBox(
        "Millie's Supermarket could not start",
        `The local till server failed to start.\n\n${message}\n\nReinstall from the Setup installer, or contact support with this message.`,
      );
      app.quit();
      return;
    }

    allowMediaPermissions(appUrl);
    await clearStaleServiceWorkers(appUrl);
    registerDesktopIpc();
    registerCustomerDisplayIpc();
    registerCustomerDisplayHotplug();
    // Pre-compile Windows RAW helper so the first receipt is not paying csc cost.
    void import("./hardware/printers/windows-raw.js")
      .then((mod) => mod.warmupWindowsRawPrinter())
      .catch(() => {
        /* best-effort */
      });

    if (startsBundled && mainWindow && !mainWindow.isDestroyed()) {
      try {
        await loadAppShell(mainWindow, appUrl);
      } catch (error) {
        console.error("[millies-desktop] failed to load till UI", error);
        dialog.showErrorBox(
          "Millie's Supermarket could not open",
          error instanceof Error ? error.message : String(error),
        );
        app.quit();
        return;
      }
    } else {
      showWindow(appUrl);
    }

    startAutoUpdater(() => mainWindow);

    app.on("activate", () => {
      showWindow(appUrl);
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  stopLocalServer();
});
