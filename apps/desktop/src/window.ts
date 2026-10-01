import { BrowserWindow, nativeImage, net, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  createTrustedOriginPolicy,
  isAllowedExternalUrl,
  isTrustedRendererUrl,
} from "./trusted-origin";

const APP_DISPLAY_NAME = "Novend POS";
export const PERSIST_PARTITION = "persist:novend";
/** Cached shell route — warmed after login (not PRECACHE; auth 302). Last route restores via ?fromBoot=1. */
export const OFFLINE_ENTRY_PATH = "/dashboard";
export const CUSTOMER_DISPLAY_ENTRY = "/customer-display";

function iconPath(): string {
  const candidates =
    process.platform === "win32"
      ? [
          path.join(process.resourcesPath, "icon.ico"),
          path.resolve(__dirname, "..", "..", "build", "icon.ico"),
          path.join(process.resourcesPath, "icon.png"),
          path.resolve(__dirname, "..", "..", "build", "icon.png"),
        ]
      : [
          path.join(process.resourcesPath, "icon.png"),
          path.resolve(__dirname, "..", "..", "build", "icon.png"),
        ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0]!;
}

function windowIcon() {
  const loaded = nativeImage.createFromPath(iconPath());
  if (loaded.isEmpty()) return loaded;
  if (process.platform === "win32") {
    return loaded.resize({ width: 256, height: 256, quality: "best" });
  }
  if (process.platform === "darwin") {
    return loaded.resize({ width: 512, height: 512, quality: "best" });
  }
  return loaded;
}

function offlineBootPath(): string {
  const candidates = [
    path.join(process.resourcesPath, "offline-boot.html"),
    path.resolve(__dirname, "..", "offline-boot.html"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0]!;
}

function preloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function isNetworkFailure(errorCode: number): boolean {
  return (
    errorCode === -2 ||
    errorCode === -6 ||
    errorCode === -7 ||
    errorCode === -21 ||
    errorCode === -100 ||
    errorCode === -101 ||
    errorCode === -102 ||
    errorCode === -104 ||
    errorCode === -105 ||
    errorCode === -106 ||
    errorCode === -109 ||
    errorCode === -118 ||
    errorCode === -130
  );
}

function isLocalBootUrl(url: string): boolean {
  return url.startsWith("file:") || url.startsWith("data:");
}

function isChromeErrorUrl(url: string): boolean {
  return url.startsWith("chrome-error://") || url.startsWith("chrome://");
}

function appEntryFromUrl(appUrl: string, candidateUrl: string): string | null {
  try {
    const app = new URL(appUrl);
    const candidate = new URL(candidateUrl);
    if (candidate.origin !== app.origin) return null;
    // The boot page appends this marker itself.
    candidate.searchParams.delete("fromBoot");
    const search = candidate.searchParams.toString();
    return `${candidate.pathname}${search ? `?${search}` : ""}${candidate.hash}`;
  } catch {
    return null;
  }
}

/**
 * Electron loadURL(https) fails offline even when the service worker already
 * cached the document (electron#35112). Load a local boot page, then
 * client-navigate so the SW can serve Cache Storage.
 */
async function loadAppShell(
  win: BrowserWindow,
  appUrl: string,
  entry = OFFLINE_ENTRY_PATH,
  options?: { stay?: boolean },
): Promise<void> {
  const boot = offlineBootPath();
  if (fs.existsSync(boot)) {
    const query: Record<string, string> = {
      appUrl,
      entry,
    };
    if (options?.stay) query.stay = "1";
    await win.loadFile(boot, { query });
    return;
  }
  if (!net.isOnline()) {
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(
        `<!doctype html><title>Novend</title><p style="font-family:system-ui;padding:2rem">Connect once online to cache Novend POS, then use email and password offline.</p>`,
      )}`,
    );
    return;
  }
  await win.loadURL(`${appUrl.replace(/\/$/, "")}${entry}`);
}

let mainBrowserWindow: BrowserWindow | null = null;
let mainShellEntry = OFFLINE_ENTRY_PATH;

export function setMainBrowserWindow(win: BrowserWindow | null) {
  mainBrowserWindow = win;
}

export async function reloadMainWindowShell(
  appUrl: string,
  entry: string,
): Promise<{ ok: boolean }> {
  if (!mainBrowserWindow || mainBrowserWindow.isDestroyed()) {
    return { ok: false };
  }
  mainShellEntry = entry;
  void loadAppShell(mainBrowserWindow, appUrl, entry);
  return { ok: true };
}

export function createMainWindow(appUrl: string): BrowserWindow {
  mainShellEntry = OFFLINE_ENTRY_PATH;
  const icon = windowIcon();
  const trustedOrigin = createTrustedOriginPolicy(appUrl, [pathToFileURL(offlineBootPath()).href]);
  let showingRecovery = false;

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: APP_DISPLAY_NAME,
    backgroundColor: "#111827",
    show: false,
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

  win.once("ready-to-show", () => {
    win.show();
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

  /**
   * Hosted navigation failed (no SW cache / dead radio). Stay on the local
   * boot page — do not auto-navigate to https again (that flickered forever
   * when offlineFailRetries reset on every partial https paint).
   */
  function showRecovery() {
    if (showingRecovery || win.isDestroyed()) return;
    showingRecovery = true;
    void loadAppShell(win, appUrl, mainShellEntry, { stay: true }).finally(() => {
      showingRecovery = false;
    });
  }

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || showingRecovery) return;
      // -3 ERR_ABORTED is normal during redirects / boot navigation.
      if (errorCode === -3) return;
      if (!isNetworkFailure(errorCode)) return;
      if (isLocalBootUrl(validatedURL)) return;
      // Chromium interstitial often reports chrome-error://chromewebdata/.
      if (
        !isTrustedRendererUrl(trustedOrigin, validatedURL) &&
        !isChromeErrorUrl(validatedURL)
      ) {
        return;
      }
      mainShellEntry = appEntryFromUrl(appUrl, validatedURL) ?? mainShellEntry;
      showRecovery();
    },
  );

  win.webContents.on("did-finish-load", () => {
    if (showingRecovery || win.isDestroyed()) return;
    const url = win.webContents.getURL();
    if (isChromeErrorUrl(url)) {
      showRecovery();
      return;
    }
    mainShellEntry = appEntryFromUrl(appUrl, url) ?? mainShellEntry;
  });

  void loadAppShell(win, appUrl);
  return win;
}

export { preloadPath, windowIcon, offlineBootPath, loadAppShell };
