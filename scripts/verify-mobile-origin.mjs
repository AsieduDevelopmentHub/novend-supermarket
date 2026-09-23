#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { APPROVED_MOBILE_HOSTS, resolveMobileAppOrigin } from "./mobile-origin-policy.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const expected = resolveMobileAppOrigin(process.env, { production: true });
const sourceConfig = join(root, "apps/mobile/www/app-config.js");
const nativeConfig = join(root, "apps/mobile/android/app/src/main/assets/public/app-config.js");

function readBakedOrigin(path) {
  if (!existsSync(path)) throw new Error(`Baked mobile config is missing: ${path}`);
  const source = readFileSync(path, "utf8");
  const match = source.match(/window\.NOVEND_APP_URL\s*=\s*("(?:[^"\\]|\\.)*")\s*;/);
  if (!match) throw new Error(`Baked mobile origin is missing from ${path}`);
  return JSON.parse(match[1]);
}

for (const path of [sourceConfig, nativeConfig]) {
  const bakedOrigin = readBakedOrigin(path);
  const baked = new URL(bakedOrigin);
  if (
    baked.origin !== expected.origin ||
    bakedOrigin !== baked.origin ||
    !APPROVED_MOBILE_HOSTS.includes(baked.hostname)
  ) {
    throw new Error(`Unexpected baked mobile application origin in ${path}: ${bakedOrigin}`);
  }
}

console.log(`Baked mobile application origin: ${expected.origin}`);
console.log(`Approved mobile hostname: ${expected.hostname}`);
