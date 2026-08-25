import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor loads the same hosted Next.js app as Electron.
 *
 * Production / preview HTTPS: start from the local `www/index.html` boot page
 * (same pattern as Electron `offline-boot.html`), then client-navigate to
 * `/dashboard` so the service worker can serve Cache Storage while offline.
 * `server.url` is intentionally omitted — a remote loadUrl fails offline even
 * when the SW already has the document (same Chromium issue as electron#35112).
 *
 * Local HTTP live-reload: keep `server.url` so the WebView hits the LAN/emulator
 * Next server. Offline cold-start testing must use an HTTPS hosted origin.
 *
 * Override host with NOVEND_APP_URL when syncing.
 *
 * Local dev (device/emulator): use your machine's LAN IP, not localhost —
 * Android emulator → http://10.0.2.2:3000
 * Also set Convex auth to the same origin:
 *   npx convex env set SITE_URL http://10.0.2.2:3000
 */
const appUrl = (process.env.NOVEND_APP_URL || "https://novend-pos.vercel.app").replace(/\/$/, "");
/** Matches Electron `OFFLINE_ENTRY_PATH` in apps/desktop/src/window.ts */
const APP_ENTRY_PATH = "/dashboard";
const liveReload = appUrl.startsWith("http://");

function hostedHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "novend-pos.vercel.app";
  }
}

const allowNavigation = Array.from(
  new Set([hostedHostname(appUrl), "novend-pos.vercel.app", "*.vercel.app"]),
);

const config: CapacitorConfig = {
  appId: "com.novend.pos",
  appName: "Novend POS",
  webDir: "www",
  server: liveReload
    ? {
        url: `${appUrl}${APP_ENTRY_PATH}`,
        cleartext: true,
        allowNavigation,
      }
    : {
        androidScheme: "https",
        hostname: "localhost",
        allowNavigation,
      },
  android: {
    allowMixedContent: liveReload,
    appendUserAgent: "NovendCapacitor/1.0",
  },
  ios: {
    appendUserAgent: "NovendCapacitor/1.0",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0B1F33",
    },
  },
};

export default config;
