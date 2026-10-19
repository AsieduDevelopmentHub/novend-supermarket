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

const BOOT_SPLASH_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${APP_DISPLAY_NAME}</title>
  <style>
    html, body {
      margin: 0;
      height: 100%;
      background: #111827;
      color: #f8fafc;
      font-family: "Segoe UI", system-ui, sans-serif;
      display: grid;
      place-items: center;
    }
    .wrap { text-align: center; padding: 24px; }
    .brand { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }
    .hint { margin-top: 10px; font-size: 14px; opacity: 0.72; }
    .pulse {
      width: 36px; height: 36px; margin: 28px auto 0;
      border: 3px solid rgba(248,250,252,0.18);
      border-top-color: #ef4444;
      border-radius: 999px;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="brand">Millie's Supermarket</div>
    <div class="hint">Starting till…</div>
    <div class="pulse" aria-hidden="true"></div>
  </div>
</body>
</html>`;

type CreateMainWindowOptions = {
  /**
   * Show a branded splash immediately and skip loading the till URL.
   * Call `loadAppShell` once the local Next server is healthy.
   */
  deferAppLoad?: boolean;
};

export function createMainWindow(
  appUrl: string,
  options: CreateMainWindowOptions = {},
): BrowserWindow {
  mainShellEntry = OFFLINE_ENTRY_PATH;
  const trustedOrigin = createTrustedOriginPolicy(appUrl);
  const deferAppLoad = options.deferAppLoad === true;

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
    // Allow the local data: splash used while the bundled Next server boots.
    if (url.startsWith("data:text/html")) return;
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
    if (isChromeErrorUrl(url) || url.startsWith("data:")) return;
    mainShellEntry = appEntryFromUrl(appUrl, url) ?? mainShellEntry;
  });

  if (deferAppLoad) {
    void win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(BOOT_SPLASH_HTML)}`);
  } else {
    void loadAppShell(win, appUrl);
  }
  return win;
}

export { preloadPath, windowIcon, loadAppShell };
