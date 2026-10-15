import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

/**
 * Dev till UI — must match `pnpm dev` (`constants/dev-server.ts` → :3737).
 * Next does not announce an alternate port to Electron; keep this fixed.
 */
export const DEV_APP_URL = "http://127.0.0.1:3737";

export type DesktopPackagedConfig = {
  /** Optional override only — Millie's packaged shell uses the local standalone server. */
  appUrl?: string;
  convexSiteUrl?: string;
  channel?: "stable" | "beta";
};

let runtimeAppOrigin: string | null = null;

function stripSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function setRuntimeAppOrigin(origin: string) {
  runtimeAppOrigin = stripSlash(origin);
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
 * Renderer origin for this Electron session.
 * Millie's is fully offline: packaged builds use a loopback Next standalone server.
 * Never falls back to a hosted Novend URL.
 */
export function resolveAppUrl(): string {
  if (runtimeAppOrigin) return runtimeAppOrigin;

  const fromEnv = process.env.NOVEND_APP_URL?.trim();
  if (fromEnv) return stripSlash(fromEnv);

  const unpackagedDev = !app.isPackaged && process.env.ELECTRON_DEV === "1";
  if (unpackagedDev) {
    return stripSlash(process.env.ELECTRON_RENDERER_URL || DEV_APP_URL);
  }

  // Unpackaged without ELECTRON_DEV — still prefer local Next when developing.
  if (!app.isPackaged) {
    return stripSlash(process.env.ELECTRON_RENDERER_URL || DEV_APP_URL);
  }

  throw new Error(
    "Local till origin is not ready. startLocalServer() must run before resolveAppUrl() in packaged builds.",
  );
}

/** True when Electron should spawn the bundled Next standalone server. */
export function shouldStartBundledServer(): boolean {
  if (process.env.NOVEND_APP_URL?.trim()) return false;
  if (!app.isPackaged && process.env.ELECTRON_DEV === "1") return false;
  return true;
}

/** electron-updater generic feed base (optional — Millie's usually has none). */
export function resolveUpdateFeedUrl(): string | null {
  const fromEnv = process.env.NOVEND_UPDATE_SITE_URL || process.env.CONVEX_SITE_URL;
  const packaged = readPackagedConfig();
  const site = stripSlash(fromEnv || packaged?.convexSiteUrl || "");
  if (!site) return null;
  const channel = packaged?.channel === "beta" ? "beta" : "stable";
  return `${site}/desktop-updates/feed/${channel}/`;
}
