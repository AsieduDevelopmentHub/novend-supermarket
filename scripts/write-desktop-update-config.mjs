#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "apps", "desktop", "build");
mkdirSync(outDir, { recursive: true });

const convexSiteUrl = (
  process.env.NOVEND_CONVEX_SITE_URL ||
  process.env.CONVEX_SITE_URL ||
  ""
).replace(/\/$/, "");
const channel = process.env.NOVEND_UPDATE_CHANNEL === "beta" ? "beta" : "stable";

writeFileSync(
  join(outDir, "update-config.json"),
  `${JSON.stringify({ convexSiteUrl, channel }, null, 2)}\n`,
);
console.log(
  convexSiteUrl
    ? `Wrote desktop update-config.json → ${convexSiteUrl} (${channel})`
    : "Wrote desktop update-config.json with empty Convex site URL (dev placeholder)",
);
