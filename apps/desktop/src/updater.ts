/**
 * Auto-updates via Convex metadata + GitHub Release assets.
 *
 * Flow:
 *   packaged app → Convex feed (latest.yml) → download redirect → GitHub asset CDN
 *
 * Dev runs never check for updates. Settings can check / install manually when packaged.
 */
import { app, dialog, type BrowserWindow } from "electron";
import { autoUpdater, type UpdateInfo, type ProgressInfo } from "electron-updater";
import { resolveUpdateFeedUrl } from "./update-feed";

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const STATUS_CHANNEL = "desktop:updates:status";

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

let started = false;
let promptingRestart = false;
let getWindow: (() => BrowserWindow | null) | null = null;

let status: DesktopUpdateStatus = {
  state: "idle",
  currentVersion: app.getVersion(),
  availableVersion: null,
  releaseNotes: null,
  progressPercent: null,
  errorMessage: null,
  lastCheckedAt: null,
  packaged: app.isPackaged,
  feedConfigured: false,
  canCheck: false,
  canInstall: false,
};

function normalizeReleaseNotes(notes: UpdateInfo["releaseNotes"]): string | null {
  if (typeof notes === "string" && notes.trim()) return notes.trim();
  if (Array.isArray(notes)) {
    const text = notes
      .map((entry) => {
        if (typeof entry === "string") return entry;
        if (entry && typeof entry === "object" && "note" in entry) {
          return typeof entry.note === "string" ? entry.note : "";
        }
        return "";
      })
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\n");
    return text || null;
  }
  return null;
}

function publish(partial: Partial<DesktopUpdateStatus>) {
  const next: DesktopUpdateStatus = {
    ...status,
    ...partial,
  };
  next.canInstall = next.state === "ready";
  next.canCheck =
    next.packaged &&
    next.feedConfigured &&
    next.state !== "checking" &&
    next.state !== "downloading";
  status = next;

  const window = getWindow?.() ?? null;
  window?.webContents.send(STATUS_CHANNEL, status);
}

function applyUpdateInfo(info: UpdateInfo, state: "available" | "ready" | "downloading") {
  publish({
    state,
    availableVersion: info.version,
    releaseNotes: normalizeReleaseNotes(info.releaseNotes),
    errorMessage: null,
    progressPercent: state === "downloading" ? (status.progressPercent ?? 0) : null,
  });
}

function notifyDownloaded(window: BrowserWindow | null, version: string) {
  if (promptingRestart) return;
  promptingRestart = true;

  const options = {
    type: "info" as const,
    buttons: ["Restart now", "Later"],
    defaultId: 0,
    cancelId: 1,
    title: "Update ready",
    message: `Novend POS ${version} is ready to install.`,
    detail:
      "Finish any open sale first — the app will restart to complete the update. You can also install from Settings → Updates.",
  };

  const result = window ? dialog.showMessageBox(window, options) : dialog.showMessageBox(options);

  void result.then(({ response }) => {
    promptingRestart = false;
    if (response === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });
}

function wireUpdaterEvents() {
  autoUpdater.on("checking-for-update", () => {
    publish({
      state: "checking",
      errorMessage: null,
      progressPercent: null,
    });
  });

  autoUpdater.on("update-available", (info) => {
    publish({
      state: autoUpdater.autoDownload ? "downloading" : "available",
      availableVersion: info.version,
      releaseNotes: normalizeReleaseNotes(info.releaseNotes),
      errorMessage: null,
      progressPercent: autoUpdater.autoDownload ? 0 : null,
      lastCheckedAt: Date.now(),
    });
  });

  autoUpdater.on("update-not-available", () => {
    publish({
      state: "up-to-date",
      availableVersion: null,
      releaseNotes: null,
      progressPercent: null,
      errorMessage: null,
      lastCheckedAt: Date.now(),
    });
  });

  autoUpdater.on("download-progress", (progress: ProgressInfo) => {
    publish({
      state: "downloading",
      progressPercent: Math.max(0, Math.min(100, Math.round(progress.percent))),
      errorMessage: null,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    applyUpdateInfo(info, "ready");
    publish({ progressPercent: 100, lastCheckedAt: Date.now() });
    notifyDownloaded(getWindow?.() ?? null, info.version);
  });

  autoUpdater.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[updater]", message);
    publish({
      state: "error",
      errorMessage: message,
      progressPercent: null,
    });
  });
}

export function getUpdateStatus(): DesktopUpdateStatus {
  return status;
}

export function startAutoUpdater(resolveWindow: () => BrowserWindow | null) {
  getWindow = resolveWindow;

  if (!app.isPackaged) {
    publish({
      state: "disabled",
      packaged: false,
      feedConfigured: false,
      errorMessage: "Updates are only available in packaged desktop installs.",
    });
    return;
  }

  if (started) return;
  started = true;

  const feedUrl = resolveUpdateFeedUrl();
  if (!feedUrl) {
    console.warn("[updater] No Convex site URL configured — auto-update disabled");
    publish({
      state: "disabled",
      packaged: true,
      feedConfigured: false,
      errorMessage: "Update feed is not configured for this install.",
    });
    return;
  }

  autoUpdater.setFeedURL({
    provider: "generic",
    url: feedUrl,
  });
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  publish({
    state: "idle",
    packaged: true,
    feedConfigured: true,
    errorMessage: null,
  });

  wireUpdaterEvents();

  void checkForUpdates();
  setInterval(() => void checkForUpdates(), CHECK_INTERVAL_MS);
}

/** Manual or scheduled check. Safe to call when updates are disabled. */
export async function checkForUpdates(): Promise<DesktopUpdateStatus> {
  if (!status.packaged || !status.feedConfigured) {
    return getUpdateStatus();
  }
  if (status.state === "checking" || status.state === "downloading") {
    return getUpdateStatus();
  }

  try {
    publish({ state: "checking", errorMessage: null, progressPercent: null });
    await autoUpdater.checkForUpdates();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[updater] check failed", message);
    publish({
      state: "error",
      errorMessage: message,
      lastCheckedAt: Date.now(),
    });
  }

  return getUpdateStatus();
}

export function installDownloadedUpdate(): { ok: boolean; message: string } {
  if (status.state !== "ready") {
    return {
      ok: false,
      message: "No update is ready to install. Check for updates first.",
    };
  }

  setImmediate(() => autoUpdater.quitAndInstall());
  return { ok: true, message: "Restarting to install the update…" };
}

export { STATUS_CHANNEL as UPDATE_STATUS_CHANNEL };
