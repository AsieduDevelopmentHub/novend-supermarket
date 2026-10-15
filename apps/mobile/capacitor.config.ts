import type { CapacitorConfig } from "@capacitor/cli";
import {
  mobileNavigationHosts,
  resolveMobileAppOrigin,
} from "../../scripts/mobile-origin-policy.mjs";

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
 * Production syncs require an approved NOVEND_APP_URL. Development may use a
 * private LAN/emulator HTTP origin for live reload.
 *
 * Local dev (device/emulator): use your machine's LAN IP, not localhost —
 * Android emulator → http://10.0.2.2:3000
 * Also set Convex auth to the same origin:
 *   npx convex env set SITE_URL http://10.0.2.2:3000
 */
const mobileOrigin = resolveMobileAppOrigin();
const appUrl = mobileOrigin.origin;
/** Matches Electron `OFFLINE_ENTRY_PATH` in apps/desktop/src/window.ts */
const APP_ENTRY_PATH = "/dashboard";
const liveReload = mobileOrigin.liveReload;
const allowNavigation = mobileNavigationHosts(mobileOrigin.hostname);

const localServer = {
  androidScheme: "https" as const,
  hostname: "localhost",
  allowNavigation,
  errorPath: "error.html",
};

const config: CapacitorConfig = {
  appId: "com.novend.millies",
  appName: "Millie's Supermarket",
  webDir: "www",
  server: liveReload
    ? {
        url: `${appUrl}${APP_ENTRY_PATH}`,
        cleartext: true,
        allowNavigation,
        errorPath: "error.html",
      }
    : localServer,
  android: {
    allowMixedContent: liveReload,
    appendUserAgent: "MilliesCapacitor/1.0",
  },
  ios: {
    appendUserAgent: "MilliesCapacitor/1.0",
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#012561",
    },
  },
};

export default config;
