import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor loads the same hosted Next.js app as Electron.
 * Entry is `/dashboard` (not the marketing landing page); unauthenticated
 * users are redirected to `/login` by the app shell — same as desktop.
 * Override host with NOVEND_APP_URL when syncing / running locally.
 *
 * The hosted URL must include the Capacitor mobile shell (bottom nav). Until
 * production is deployed, point NOVEND_APP_URL at a preview deploy or LAN dev:
 *   set NOVEND_APP_URL=http://192.168.1.x:3000 && pnpm mobile:sync
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
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#0B1F33",
    },
  },
};

export default config;
