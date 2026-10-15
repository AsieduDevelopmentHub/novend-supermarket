import { BrowserWindow, nativeImage, shell, type NativeImage } from "electron";
import fs from "node:fs";
import path from "node:path";
import {
  createTrustedOriginPolicy,
  isAllowedExternalUrl,
  isTrustedRendererUrl,
} from "./trusted-origin";

const APP_DISPLAY_NAME = "Millie's Supermarket";
export const PERSIST_PARTITION = "persist:millies";
/** Cold-start route — local Next redirects unauthenticated users to login/setup. */
export const OFFLINE_ENTRY_PATH = "/login";
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

/**
 * Windows taskbar/shortcuts need the multi-size `.ico` file path.
 * Converting via nativeImage.resize() drops ICO sizes and the page favicon
 * can then replace the brand icon after reload — leaving the Electron default.
 */
function browserWindowIcon(): string | NativeImage | undefined {
  const file = iconPath();
  if (!fs.existsSync(file)) return undefined;
  if (process.platform === "win32" && file.toLowerCase().endsWith(".ico")) {
    return file;
  }
  const loaded = nativeImage.createFromPath(file);
  if (loaded.isEmpty()) return undefined;
  if (process.platform === "darwin") {
    return loaded.resize({ width: 512, height: 512, quality: "best" });
  }
  return loaded;
}

function applyWindowIcon(win: BrowserWindow): void {
  if (win.isDestroyed()) return;
  const icon = browserWindowIcon();
  if (!icon) return;
  win.setIcon(icon);
}

function windowIcon() {
  const icon = browserWindowIcon();
  if (!icon) return nativeImage.createEmpty();
  if (typeof icon === "string") return nativeImage.createFromPath(icon);
  return icon;
}

function preloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function isChromeErrorUrl(url: string): boolean {
  return url.startsWith("chrome-error://") || url.startsWith("chrome://");
}

function appEntryFromUrl(appUrl: string, candidateUrl: string): string | null {
  try {
    const app = new URL(appUrl);
    const candidate = new URL(candidateUrl);
    if (candidate.origin !== app.origin) return null;
    candidate.searchParams.delete("fromBoot");
    const search = candidate.searchParams.toString();
    return `${candidate.pathname}${search ? `?${search}` : ""}${candidate.hash}`;
  } catch {
    return null;
  }
}

function shellTarget(appUrl: string, entry: string): string {
  const base = appUrl.replace(/\/$/, "");
  const pathPart = entry.startsWith("/") ? entry : `/${entry}`;
  return `${base}${pathPart}`;
}

/**
 * Millie's loads the local loopback Next server directly (bundled standalone
 * or `pnpm dev` on :3000). No hosted URL / offline-boot trampoline.
 */
async function loadAppShell(
  win: BrowserWindow,
  appUrl: string,
  entry = OFFLINE_ENTRY_PATH,
): Promise<void> {
  await win.loadURL(shellTarget(appUrl, entry));
}

let mainBrowserWindow: BrowserWindow | null = null;
let mainShellEntry = OFFLINE_ENTRY_PATH;
/** Login leave is ours — don't let Chromium's dirty-form dialog block it. */
let suppressUnloadPrompt = false;

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
  suppressUnloadPrompt = true;
  try {
    await loadAppShell(mainBrowserWindow, appUrl, entry);
  } catch {
    return { ok: false };
  } finally {
    suppressUnloadPrompt = false;
  }
  if (mainBrowserWindow.isDestroyed()) return { ok: false };
  return { ok: true };
}

export function createMainWindow(appUrl: string): BrowserWindow {
  mainShellEntry = OFFLINE_ENTRY_PATH;
  const trustedOrigin = createTrustedOriginPolicy(appUrl);

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: APP_DISPLAY_NAME,
    backgroundColor: "#111827",
    show: false,
    icon: browserWindowIcon(),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      partition: PERSIST_PARTITION,
    },
  });

  // Re-assert brand icon after Chromium applies the page favicon (common on Windows).
  win.webContents.on("page-favicon-updated", () => applyWindowIcon(win));
  win.webContents.on("did-finish-load", () => applyWindowIcon(win));

  win.once("ready-to-show", () => {
    applyWindowIcon(win);
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

  win.webContents.on("will-prevent-unload", (event) => {
    if (suppressUnloadPrompt) event.preventDefault();
  });

  win.webContents.on("did-finish-load", () => {
    if (win.isDestroyed()) return;
    const url = win.webContents.getURL();
    if (isChromeErrorUrl(url)) return;
    mainShellEntry = appEntryFromUrl(appUrl, url) ?? mainShellEntry;
  });

  void loadAppShell(win, appUrl);
  return win;
}

export { preloadPath, windowIcon, loadAppShell };
