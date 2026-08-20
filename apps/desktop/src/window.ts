import { BrowserWindow, nativeImage, net, shell } from "electron";
import fs from "node:fs";
import path from "node:path";
import { isTerminalInitialized, markTerminalInitialized } from "./terminal-state";

const APP_DISPLAY_NAME = "Novend POS";
const PERSIST_PARTITION = "persist:novend";
const OFFLINE_ENTRY_PATH = "/dashboard";

function iconPath(): string {
  const candidates = [
    path.join(process.resourcesPath, "icon.png"),
    path.resolve(__dirname, "..", "..", "..", "..", "public", "icons", "icon-512.png"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0]!;
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

function recoveryHtml(appUrl: string, initialized: boolean): string {
  const target = `${appUrl.replace(/\/$/, "")}${OFFLINE_ENTRY_PATH}`;
  const title = initialized ? "You're offline." : "Novend POS hasn't been initialized on this device.";
  const body = initialized
    ? "This terminal couldn't load the cached app shell. Reconnect once to restore it. After that, Novend runs from local data and syncs when you are back online."
    : "Connect to the internet once to initialize this terminal.";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Novend POS</title>
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#111827; color:#e2e8f0;
      font-family:"Segoe UI",system-ui,sans-serif; text-align:center; padding:2rem; }
    h1 { font-size:1.25rem; margin:0 0 .75rem; }
    p { color:#94a3b8; max-width:28rem; line-height:1.5; margin:0 auto 1.25rem; }
    button { appearance:none; border:0; border-radius:.5rem; background:#38bdf8; color:#111827;
      font:inherit; font-weight:600; padding:.65rem 1.1rem; cursor:pointer; }
  </style>
</head>
<body>
  <div>
    <h1>${title}</h1>
    <p>${body}</p>
    <button type="button" id="retry">Retry</button>
  </div>
  <script>
    document.getElementById("retry").onclick = function () {
      window.location.replace(${JSON.stringify(target)});
    };
  </script>
</body>
</html>`;
}

/**
 * Electron loadURL(https) fails offline even when the service worker already
 * cached the document (electron#35112). Load a local boot page, then
 * client-navigate so the SW can serve Cache Storage.
 */
async function loadAppShell(win: BrowserWindow, appUrl: string): Promise<void> {
  const boot = offlineBootPath();
  const initialized = isTerminalInitialized();
  if (fs.existsSync(boot)) {
    await win.loadFile(boot, {
      query: {
        appUrl,
        entry: OFFLINE_ENTRY_PATH,
        initialized: initialized ? "1" : "0",
      },
    });
    return;
  }
  if (!net.isOnline()) {
    await win.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(recoveryHtml(appUrl, initialized))}`,
    );
    return;
  }
  await win.loadURL(`${appUrl.replace(/\/$/, "")}${OFFLINE_ENTRY_PATH}`);
}

export function createMainWindow(appUrl: string): BrowserWindow {
  const icon = nativeImage.createFromPath(iconPath());
  const origin = appUrl.replace(/\/$/, "");
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
    void shell.openExternal(url);
    return { action: "deny" };
  });

  win.webContents.on("did-finish-load", () => {
    const loaded = win.webContents.getURL();
    if (loaded.startsWith(origin)) {
      markTerminalInitialized(origin);
    }
  });

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || showingRecovery) return;
      if (errorCode === -3) return;
      if (!isNetworkFailure(errorCode)) return;
      if (validatedURL.startsWith("file:") || validatedURL.startsWith("data:")) return;
      if (!validatedURL.startsWith(origin)) return;
      showingRecovery = true;
      void win
        .loadURL(
          `data:text/html;charset=utf-8,${encodeURIComponent(
            recoveryHtml(appUrl, isTerminalInitialized()),
          )}`,
        )
        .finally(() => {
          showingRecovery = false;
        });
    },
  );

  void loadAppShell(win, appUrl);
  return win;
}
