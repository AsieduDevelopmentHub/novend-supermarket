import { BrowserWindow, nativeImage, net, shell } from "electron";
import fs from "node:fs";
import path from "node:path";

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

function recoveryHtml(appUrl: string): string {
  const target = `${appUrl.replace(/\/$/, "")}${OFFLINE_ENTRY_PATH}`;
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
    <h1>Can't reach Novend POS</h1>
    <p>Connect once so this terminal can cache the app. After that, offline launch uses the local cache.</p>
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

async function loadAppShell(win: BrowserWindow, appUrl: string): Promise<void> {
  const boot = offlineBootPath();
  if (fs.existsSync(boot)) {
    await win.loadFile(boot, {
      query: { appUrl, entry: OFFLINE_ENTRY_PATH },
    });
    return;
  }
  if (!net.isOnline()) {
    await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(recoveryHtml(appUrl))}`);
    return;
  }
  await win.loadURL(`${appUrl.replace(/\/$/, "")}${OFFLINE_ENTRY_PATH}`);
}

export function createMainWindow(appUrl: string): BrowserWindow {
  const icon = nativeImage.createFromPath(iconPath());
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

  win.webContents.on(
    "did-fail-load",
    (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame || showingRecovery) return;
      if (errorCode === -3) return;
      if (!isNetworkFailure(errorCode)) return;
      const origin = appUrl.replace(/\/$/, "");
      if (validatedURL.startsWith("file:") || validatedURL.startsWith("data:")) return;
      if (!validatedURL.startsWith(origin)) return;
      showingRecovery = true;
      void win
        .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(recoveryHtml(appUrl))}`)
        .finally(() => {
          showingRecovery = false;
        });
    },
  );

  void loadAppShell(win, appUrl);
  return win;
}
