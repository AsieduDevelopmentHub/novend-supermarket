#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_APP_URL = "https://dashboard.novendpos.app";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "apps", "desktop", "build");
mkdirSync(outDir, { recursive: true });

const convexSiteUrl = (
  process.env.NOVEND_CONVEX_SITE_URL ||
  process.env.CONVEX_SITE_URL ||
  ""
).replace(/\/$/, "");
const appUrl = (process.env.NOVEND_APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
const channel = process.env.NOVEND_UPDATE_CHANNEL === "beta" ? "beta" : "stable";
const usedDefaultAppUrl = !process.env.NOVEND_APP_URL;

writeFileSync(
  join(outDir, "update-config.json"),
  `${JSON.stringify({ appUrl, convexSiteUrl, channel }, null, 2)}\n`,
);

const convexNote = convexSiteUrl
  ? `Convex site configured (${channel})`
  : "Convex site URL empty (dev placeholder)";
const appNote = usedDefaultAppUrl ? `appUrl default ${appUrl}` : "appUrl from NOVEND_APP_URL";
console.log(`Wrote desktop update-config.json — ${appNote}; ${convexNote}`);
