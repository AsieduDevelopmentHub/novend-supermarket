import { app, dialog, type BrowserWindow } from "electron";
import { autoUpdater } from "electron-updater";
import { resolveUpdateFeedUrl } from "./update-feed";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

let started = false;

export function startAutoUpdater(getWindow: () => BrowserWindow | null) {
  if (!app.isPackaged) return;
  if (started) return;
  started = true;

  const feedUrl = resolveUpdateFeedUrl();
  if (!feedUrl) {
    console.warn("[updater] No Convex site URL — auto-update disabled");
    return;
  }

  autoUpdater.setFeedURL({ provider: "generic", url: feedUrl });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("error", (error) => {
    console.error("[updater]", error);
  });

  autoUpdater.on("update-downloaded", (info) => {
    const win = getWindow();
    void dialog
      .showMessageBox(win ?? undefined, {
        type: "info",
        title: "Novend POS update",
        message: `Version ${info.version} is ready.`,
        detail: "Restart after you finish the current sale to install the update.",
        buttons: ["Restart now", "Later"],
        defaultId: 1,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  void autoUpdater.checkForUpdates().catch((error) => {
    console.warn("[updater] check failed", error);
  });
  setInterval(() => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.warn("[updater] check failed", error);
    });
  }, CHECK_INTERVAL_MS);
}
