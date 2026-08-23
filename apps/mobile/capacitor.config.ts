import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor loads the same hosted Next.js app as Electron.
 * Entry is `/dashboard` (not the marketing landing page); unauthenticated
 * users are redirected to `/login` by the app shell — same as desktop.
 * Override host with NOVEND_APP_URL when syncing / running locally.
 *
 * Local dev (device/emulator): use your machine's LAN IP, not localhost —
 * Android emulator → http://10.0.2.2:3000
 * Also set Convex auth to the same origin:
 *   npx convex env set SITE_URL http://10.0.2.2:3000
 * (must match NOVEND_APP_URL exactly or sign-in cookies won't persist)
 */
const appUrl = (process.env.NOVEND_APP_URL || "https://novend-pos.vercel.app").replace(
  /\/$/,
  "",
);
/** Matches Electron `OFFLINE_ENTRY_PATH` in apps/desktop/src/window.ts */
const APP_ENTRY_PATH = "/dashboard";

const config: CapacitorConfig = {
  appId: "com.novend.pos",
  appName: "Novend POS",
  webDir: "www",
  server: {
    url: `${appUrl}${APP_ENTRY_PATH}`,
    cleartext: appUrl.startsWith("http://"),
  },
  android: {
    allowMixedContent: appUrl.startsWith("http://"),
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
