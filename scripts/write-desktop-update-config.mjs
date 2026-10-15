#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Millie's packaged Electron serves a local Next standalone server.
 * Do not bake a hosted Novend URL. Optional NOVEND_APP_URL remains a rare override.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "apps", "desktop", "build");
mkdirSync(outDir, { recursive: true });

const convexSiteUrl = (
  process.env.NOVEND_CONVEX_SITE_URL ||
  process.env.CONVEX_SITE_URL ||
  ""
).replace(/\/$/, "");
const appUrl = (process.env.NOVEND_APP_URL || "").replace(/\/$/, "");
const channel = process.env.NOVEND_UPDATE_CHANNEL === "beta" ? "beta" : "stable";

writeFileSync(
  join(outDir, "update-config.json"),
  `${JSON.stringify({ appUrl: appUrl || null, convexSiteUrl, channel }, null, 2)}\n`,
);

const convexNote = convexSiteUrl
  ? `Convex site configured (${channel})`
  : "Convex site URL empty (Millie's offline — no cloud feed)";
const appNote = appUrl
  ? `appUrl override ${appUrl}`
  : "appUrl empty (bundled local Next standalone)";
console.log(`Wrote desktop update-config.json — ${appNote}; ${convexNote}`);
