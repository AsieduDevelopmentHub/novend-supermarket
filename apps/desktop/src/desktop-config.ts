import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/** Public hosted web app Electron loads. Override with NOVEND_APP_URL at build or runtime. */
export const DEFAULT_APP_URL = "https://novend-pos.vercel.app";

export type DesktopPackagedConfig = {
  appUrl?: string;
  convexSiteUrl?: string;
  channel?: "stable" | "beta";
};

function stripSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function readPackagedConfig(): DesktopPackagedConfig | null {
  try {
    const configPath = path.join(process.resourcesPath, "update-config.json");
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as DesktopPackagedConfig;
  } catch {
    return null;
  }
}

/**
 * Hosted Next.js origin for the renderer.
 * Packaged apps read the URL baked at build time. CI env vars are not present on cashiers' machines.
 */
export function resolveAppUrl(): string {
  const fromEnv = process.env.NOVEND_APP_URL?.trim();
  if (fromEnv) return stripSlash(fromEnv);
  const unpackagedDev = !app.isPackaged && process.env.ELECTRON_DEV === "1";
  if (unpackagedDev) {
    return stripSlash(process.env.ELECTRON_RENDERER_URL || "http://127.0.0.1:3000");
  }
  const packaged = readPackagedConfig()?.appUrl?.trim();
  if (packaged) return stripSlash(packaged);
  return DEFAULT_APP_URL;
}

/** electron-updater generic feed base (appends latest.yml / latest-mac.yml / latest-linux.yml). */
export function resolveUpdateFeedUrl(): string | null {
  const fromEnv = process.env.NOVEND_UPDATE_SITE_URL || process.env.CONVEX_SITE_URL;
  const packaged = readPackagedConfig();
  const site = stripSlash(fromEnv || packaged?.convexSiteUrl || "");
  if (!site) return null;
  const channel = packaged?.channel === "beta" ? "beta" : "stable";
  return `${site}/desktop-updates/feed/${channel}/`;
}
