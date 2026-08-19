import fs from "node:fs";
import path from "node:path";

type UpdateConfigFile = {
  convexSiteUrl?: string;
  channel?: "stable" | "beta";
};

function readPackagedConfig(): UpdateConfigFile | null {
  try {
    const configPath = path.join(process.resourcesPath, "update-config.json");
    if (!fs.existsSync(configPath)) return null;
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as UpdateConfigFile;
  } catch {
    return null;
  }
}

/** electron-updater generic feed base (appends latest.yml / latest-mac.yml / latest-linux.yml). */
export function resolveUpdateFeedUrl(): string | null {
  const fromEnv = process.env.NOVEND_UPDATE_SITE_URL || process.env.CONVEX_SITE_URL;
  const packaged = readPackagedConfig();
  const site = (fromEnv || packaged?.convexSiteUrl || "").replace(/\/$/, "");
  if (!site) return null;
  const channel = packaged?.channel === "beta" ? "beta" : "stable";
  return `${site}/desktop-updates/feed/${channel}/`;
}
